import debug from 'debug';
import isEqual from 'lodash/isEqual';
import {TypeId} from 'palm-pdb';
import {
  SArray,
  SBitmask,
  SObject,
  SUInt16BE,
  SUInt16LE,
  SUInt8,
  Serializable,
  bitfield,
  field,
} from 'serio';
import {Duplex, DuplexOptions} from 'stream';
import {Device, WebUSBDevice, usb} from 'usb';
import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';
import {
  NetSyncConnection,
  SerialSyncConnection,
  SyncConnection,
  SyncConnectionOptions,
} from '../protocols/sync-connections';
import {SyncServer} from './sync-server';
import {
  USB_DEVICE_CONFIGS_BY_ID,
  UsbDeviceConfig,
  UsbInitType,
  UsbProtocolStackType,
  toUsbId,
} from './usb-device-configs';

/** Vendor USB control requests supported by Palm OS devices. */
enum UsbControlRequestType {
  /** Query for the number of bytes that are available to be transferred to the
   * host for the specified endpoint. Currently not used, and always returns
   * 0x0001. */
  GET_NUM_BYTES_AVAILABLE = 0x01,
  /** Sent by the host to notify the device that the host is closing a pipe. An
   * empty packet is sent in response. */
  CLOSE_NOTIFICATION = 0x02,
  /** Sent by the host during enumeration to get endpoint information.
   *
   * Response type is GetConnectionInfoResponse.
   */
  GET_CONNECTION_INFO = 0x03,
  /** Sent by the host during enumeration to get entpoint information on newer devices.
   *
   * Respones type is GetExtConnectionInfoResponse.
   */
  GET_EXT_CONNECTION_INFO = 0x04,
}

class GetNumBytesAvailableResponse extends SObject {
  @field(SUInt16BE)
  numBytes = 0;
}

/** Port function types in GetConnectionInfoResponse. */
enum ConnectionPortFunctionType {
  GENERIC = 0x00,
  DEBUGGER = 0x01,
  HOT_SYNC = 0x02,
  CONSOLE = 0x03,
  REMOTE_FS = 0x04,
}

/** Information about a port in GetConnectionInfoResponse. */
class ConnectionPortInfo extends SObject {
  @field(SUInt8.enum(ConnectionPortFunctionType))
  functionType = ConnectionPortFunctionType.GENERIC;
  @field(SUInt8)
  portNumber = 0;
}

/** Response type for GET_CONNECTION_INFO control requests. */
class GetConnectionInfoResponse extends SObject {
  /** Number of ports in use (max 2). */
  @field(SUInt8)
  numPorts = 0;

  @field(SUInt8)
  private padding1 = 0;

  /** Port information. */
  @field(SArray.ofLength(2, ConnectionPortInfo))
  ports: Array<ConnectionPortInfo> = [];
}

/** A pair of 4-bit endpoint numbers. */
class ExtConnectionEndpoints extends SBitmask.of(SUInt8) {
  /** In endpoint number. */
  @bitfield(4)
  inEndpoint = 0;
  /** Out endpoint number. */
  @bitfield(4)
  outEndpoint = 0;
}

/** Information abount a port in a GetExtConnectionInfoResponse. */
class ExtConnectionPortInfo extends SObject {
  /** Creator ID of the application that opened	this connection.
   *
   * For HotSync port, this should be equal to HOT_SYNC_PORT_TYPE.
   */
  @field(TypeId)
  type = 'AAAA';

  /** Specifies the in and out endpoint number if `hasDifferentEndpoints`
   * is 0, otherwise 0.  */
  @field(SUInt8)
  portNumber = 0;

  /** Specifies the in and out endpoint numbers if `hasDifferentEndpoints`
   * is 1, otherwise set to 0. */
  @field()
  endpoints = new ExtConnectionEndpoints();

  @field(SUInt16LE)
  private padding1 = 0;
}

/** The type of the HotSync port in ExtConnectionPortInfo. */
const HOT_SYNC_PORT_TYPE = 'cnys';

/** Response type for GET_EXT_CONNECTION_INFO control requests. */
class GetExtConnectionInfoResponse extends SObject {
  /** Number of ports in use (max 2).*/
  @field(SUInt8)
  numPorts = 0;
  /** Whether in and out endpoint numbers are different.
   *
   * If 0, the `portNumber` field specifies the in and out endpoint numbers, and
   * the `endpoints` field is zero.
   *
   * If 1, the `portNumber` field is zero, and the `endpoints` field
   * specifies the in and out endpoint numbers.
   */
  @field(SUInt8)
  hasDifferentEndpoints = 0;

  @field(SUInt16LE)
  private padding1 = 0;

  /** Port information. */
  @field(SArray.ofLength(2, ExtConnectionPortInfo))
  ports: Array<ExtConnectionPortInfo> = [];
}

/** Configuration for a USB connection, returned from USB device initialization
 * routines. */
export interface UsbConnectionConfig {
  /** In endpoint number. */
  inEndpoint: number;
  /** Out endpoint number. */
  outEndpoint: number;
}

/** Duplex stream for HotSync with an initialized USB device. */
export class UsbConnectionStream extends Duplex {
  constructor(
    /** Device handle. */
    private readonly device: WebUSBDevice,
    /** Connection configuration. */
    private readonly config: UsbConnectionConfig,
    opts?: DuplexOptions
  ) {
    super(opts);
  }

  async _write(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: (error?: Error | null) => void
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }
    const result = await this.device.transferOut(
      this.config.outEndpoint,
      chunk
    );
    if (result.status === 'ok') {
      callback(null);
    } else {
      callback(new Error(`USB write failed with status ${result.status}`));
    }
  }

  async _read(size: number) {
    let result: USBInTransferResult;
    try {
      result = await this.device.transferIn(this.config.inEndpoint, 64);
    } catch (e) {
      this.destroy(
        new Error(
          'USB read error: ' + (e instanceof Error ? e.message : `${e}`)
        )
      );
      return;
    }
    if (result.status === 'ok') {
      this.push(
        result.data ? Buffer.from(result.data.buffer) : Buffer.alloc(0)
      );
    } else {
      this.destroy(new Error(`USB read failed with status ${result.status}`));
    }
  }
}

/** USB device polling interval used in waitForDevice(). */
const USB_DEVICE_POLLING_INTERVAL_MS = 200;

export class UsbSyncServer extends SyncServer {
  override start() {
    if (this.runPromise) {
      throw new Error('Server already started');
    }
    this.runPromise = this.run();
  }

  override async stop() {
    if (!this.runPromise || this.shouldStop) {
      return;
    }
    this.shouldStop = true;
    try {
      await this.runPromise;
    } catch (e) {}
    this.runPromise = null;
    this.shouldStop = false;
  }

  private async run() {
    while (!this.shouldStop) {
      this.log('Waiting for device...');
      const deviceResult = await this.waitForDevice();
      if (!deviceResult) {
        break;
      }

      const {rawDevice, deviceConfig} = deviceResult;
      const {usbId, label, protocolStackType} = deviceConfig;
      this.log(`Found device ${usbId} - ${label}`);

      try {
        const {device, stream} = await this.openDevice(deviceResult);
        if (stream) {
          await this.onConnection(stream, protocolStackType);
        }
        if (device) {
          this.log('Closing device');
          await this.closeDevice(device);
        }
      } catch (e) {
        this.log('Error syncing with device');
      }

      this.log('Waiting for device to disconnect');
      try {
        await this.waitForDeviceToDisconnect(rawDevice);
      } catch (e) {}
    }
  }

  /** Handle a new connection.
   *
   * This method is made public for testing, but otherwise should not be used.
   *
   * @ignore
   */
  public async onConnection(
    rawStream: Duplex,
    protocolStackType: UsbProtocolStackType = UsbProtocolStackType.NET_SYNC
  ) {
    const connection = new this.USB_PROTOCOL_STACKS[protocolStackType](
      rawStream,
      this.opts
    );
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

    await connection.start();

    try {
      await this.syncFn(connection.dlpConnection);
    } catch (e) {
      this.log(
        'Sync error: ' + (e instanceof Error ? e.stack || e.message : `${e}`)
      );
    }

    await connection.end();
    this.emit('disconnect', connection);
  }

  /** Wait for a supported USB device.
   *
   * Returns device and matching config if found, or null if stop() was called.
   *
   * We use the usb package's legacy API because
   *
   *   1. The WebUSB API (with allowAllDevices = true) only returns devices the
   *      current user has permission to access, whereas the legacy API returns
   *      all connected devices regardless of permissions. If a compatible Palm
   *      OS device is connected but the user doesn't have permission to access
   *      it (e.g. they haven't installed the udev rules), we'd rather throw an
   *      explicit error than not know about it.
   *   2. We may need to detach the kernal driver on the device, which is only
   *      supported by the legacy API, so we need the legacy device object
   *      anyway.
   */
  private async waitForDevice() {
    while (!this.shouldStop) {
      const rawDevices = usb.getDeviceList();
      for (const rawDevice of rawDevices) {
        const usbId = toUsbId(rawDevice.deviceDescriptor);
        if (usbId in USB_DEVICE_CONFIGS_BY_ID) {
          return {
            rawDevice,
            deviceConfig: USB_DEVICE_CONFIGS_BY_ID[usbId],
          };
        }
      }
      await new Promise((resolve) =>
        setTimeout(resolve, USB_DEVICE_POLLING_INTERVAL_MS)
      );
    }
    return null;
  }

  /** Initialize device and return a UsbConnectionStream. */
  private async openDevice({
    rawDevice,
    deviceConfig,
  }: {
    rawDevice: Device;
    deviceConfig: UsbDeviceConfig;
  }): Promise<{
    device: WebUSBDevice | null;
    stream: UsbConnectionStream | null;
  }> {
    // 1. Open device.
    let device: WebUSBDevice | null;
    try {
      device = await WebUSBDevice.createInstance(rawDevice);
      await device.open();
    } catch (e) {
      this.log(`Could not open device: ${e}`);
      return {device: null, stream: null};
    }
    // 2. Claim device interface.
    if (!device.configuration) {
      this.log('No configurations available for USB device');
      return {device, stream: null};
    }
    if (device.configuration.interfaces.length < 1) {
      this.log(
        `No interfaces available in configuration ${device.configuration.configurationValue}`
      );
      return {device, stream: null};
    }
    const {interfaceNumber} = device.configuration.interfaces[0];
    const rawInterface = rawDevice.interface(interfaceNumber);
    if (rawInterface.isKernelDriverActive()) {
      this.log(`Detaching kernel driver for interface ${interfaceNumber}`);
      rawInterface.detachKernelDriver();
    }
    try {
      await device.claimInterface(interfaceNumber);
    } catch (e) {
      this.log(`Could not claim interface ${interfaceNumber}: ${e}`);
      return {device, stream: null};
    }

    // 2. Get device config.
    let connectionConfigFromInitFn: UsbConnectionConfig | null = null;
    let connectionConfigFromUsbDeviceInfo: UsbConnectionConfig | null = null;
    try {
      connectionConfigFromInitFn =
        await this.USB_INIT_FNS[deviceConfig.initType](device);
      connectionConfigFromUsbDeviceInfo =
        await this.getConnectionConfigFromUsbDeviceInfo(device);
    } catch (e) {
      this.log(`Could not identify connection configuration: ${e}`);
      return {device, stream: null};
    }
    if (
      connectionConfigFromInitFn &&
      connectionConfigFromUsbDeviceInfo &&
      !isEqual(connectionConfigFromInitFn, connectionConfigFromUsbDeviceInfo)
    ) {
      this.log(
        'Connection config from init fn and from USB device info do not match: ' +
          JSON.stringify(connectionConfigFromInitFn) +
          ' vs ' +
          JSON.stringify(connectionConfigFromUsbDeviceInfo)
      );
    }
    const connectionConfig =
      connectionConfigFromInitFn || connectionConfigFromUsbDeviceInfo;
    if (!connectionConfig) {
      this.log('Could not identify connection configuration');
      return {device, stream: null};
    }
    this.log(`Connection configuration: ${JSON.stringify(connectionConfig)}`);

    // 3. Create stream.
    return {
      device,
      stream: new UsbConnectionStream(device, connectionConfig, this.log),
    };
  }

  /** Clean up a device opened by openDevice(). */
  private async closeDevice(device: WebUSBDevice) {
    // Release interface.
    try {
      if (device.configuration?.interfaces[0]?.claimed) {
        await device.releaseInterface(
          device.configuration.interfaces[0].interfaceNumber
        );
      }
    } catch (e) {
      this.log(`Could not release interface: ${e}`);
    }
    // Close device. This currently always fails with a an error "Can't close
    // device with a pending request", so we don't really need it but keeping it
    // here for now.
    // https://github.com/node-usb/node-usb/issues/254
    try {
      await device.close();
    } catch (e) {
      this.log(`Could not close device: ${e}`);
    }
  }

  private async waitForDeviceToDisconnect(rawDeviceToWait: Device) {
    const {idVendor, idProduct} = rawDeviceToWait.deviceDescriptor;
    while (!this.shouldStop) {
      const rawDevices = usb.getDeviceList();
      if (
        !rawDevices.find(
          ({deviceDescriptor: d}) =>
            d.idVendor === idVendor && d.idProduct === idProduct
        )
      ) {
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, USB_DEVICE_POLLING_INTERVAL_MS)
      );
    }
  }

  /** Send a USB control read request and parse the result. */
  private async sendUsbControlRequest<ResponseT extends Serializable>(
    device: USBDevice,
    setup: USBControlTransferParameters,
    responseT: new () => ResponseT
  ): Promise<ResponseT> {
    const response = new responseT();
    const requestName = response.constructor.name.replace(/Response$/, '');
    this.log(`>>> ${requestName}`);

    const result = await device.controlTransferIn(
      setup,
      response.getSerializedLength()
    );
    if (result.status !== 'ok') {
      const message = `${requestName} failed with status ${result.status}`;
      this.log(`--- ${message}`);
      throw new Error(message);
    }
    if (!result.data) {
      const message = `${requestName} returned no data`;
      this.log(`--- ${message}`);
      throw new Error(message);
    }
    const responseData = Buffer.from(result.data.buffer);
    this.log(`<<< ${responseData.toString('hex')}`);
    try {
      response.deserialize(Buffer.from(result.data.buffer));
    } catch (e: any) {
      const message = `Failed to parse ${requestName} response: ${e.message}`;
      this.log(`--- ${message}`);
      throw new Error(message);
    }
    this.log(`<<< ${JSON.stringify(response)}`);
    return response;
  }

  private async getConnectionConfigUsingGetConnectionInfo(
    device: WebUSBDevice
  ): Promise<UsbConnectionConfig | null> {
    let response: GetConnectionInfoResponse;
    try {
      response = await this.sendUsbControlRequest(
        device,
        {
          requestType: 'vendor',
          recipient: 'endpoint',
          request: UsbControlRequestType.GET_CONNECTION_INFO,
          index: 0,
          value: 0,
        },
        GetConnectionInfoResponse
      );
    } catch (e) {
      return null;
    }
    const portInfo = response.ports
      .slice(0, response.numPorts)
      .find(
        ({functionType}) => functionType === ConnectionPortFunctionType.HOT_SYNC
      );
    if (!portInfo) {
      this.log('Could not identify HotSync port in GetConnectionInfo response');
      return null;
    }
    return {inEndpoint: portInfo.portNumber, outEndpoint: portInfo.portNumber};
  }

  private async getConnectionConfigUsingGetExtConnectionInfo(
    device: WebUSBDevice
  ): Promise<UsbConnectionConfig | null> {
    let response: GetExtConnectionInfoResponse;
    try {
      response = await this.sendUsbControlRequest(
        device,
        {
          requestType: 'vendor',
          recipient: 'endpoint',
          request: UsbControlRequestType.GET_EXT_CONNECTION_INFO,
          index: 0,
          value: 0,
        },
        GetExtConnectionInfoResponse
      );
    } catch (e) {
      return null;
    }
    const portInfo = response.ports
      .slice(0, response.numPorts)
      .find(({type}) => type === HOT_SYNC_PORT_TYPE);
    if (!portInfo) {
      this.log(
        'Could not identify HotSync port in GetExtConnectionInfo response'
      );
      return null;
    }
    if (response.hasDifferentEndpoints) {
      return {
        inEndpoint: portInfo.endpoints.inEndpoint,
        outEndpoint: portInfo.endpoints.outEndpoint,
      };
    } else {
      return {
        inEndpoint: portInfo.portNumber,
        outEndpoint: portInfo.portNumber,
      };
    }
  }

  private async getConnectionConfigFromUsbDeviceInfo(
    device: WebUSBDevice
  ): Promise<UsbConnectionConfig | null> {
    if (!device.configuration) {
      this.log('No configurations available for USB device');
      return null;
    }
    if (device.configuration.interfaces.length < 1) {
      this.log(
        `No interfaces available in configuration ${device.configuration.configurationValue}`
      );
      return null;
    }
    const {alternate} = device.configuration.interfaces[0];
    const validEndpoints = alternate.endpoints.filter(
      ({type, packetSize}) => type === 'bulk' && packetSize === 0x40
    );
    const inEndpoint = validEndpoints.find(
      (endpoint) => endpoint.direction === 'in'
    );
    const outEndpoint = validEndpoints.find(
      (endpoint) => endpoint.direction === 'out'
    );
    if (!inEndpoint || !outEndpoint) {
      this.log(
        'Could not find HotSync endpoints in USB device interface: ' +
          JSON.stringify(alternate.endpoints)
      );
      return null;
    }
    return {
      inEndpoint: inEndpoint.endpointNumber,
      outEndpoint: outEndpoint.endpointNumber,
    };
  }

  /** USB device initialization routines. */
  USB_INIT_FNS: {
    [key in UsbInitType]: (
      device: WebUSBDevice
    ) => Promise<UsbConnectionConfig | null>;
  } = {
    [UsbInitType.NONE]: async () => {
      return null;
    },
    [UsbInitType.GENERIC]: async (device) => {
      let config: UsbConnectionConfig | null;

      // First try GetExtConnectionInfo. Some devices may have different in and
      // out endpoints, which can only be fetched with GetExtConnectionInfo.
      config = await this.getConnectionConfigUsingGetExtConnectionInfo(device);
      if (config) {
        return config;
      }

      // If GetExtConnectionInfo isn't supported, fall back to GetConnectionInfo.
      config = await this.getConnectionConfigUsingGetConnectionInfo(device);
      if (config) {
        // Query the number of bytes available. We ignore the response because
        // we don't actually need it, but older devices may expect this call
        // before sending data.
        await this.sendUsbControlRequest(
          device,
          {
            requestType: 'vendor',
            recipient: 'endpoint',
            request: UsbControlRequestType.GET_NUM_BYTES_AVAILABLE,
            index: 0,
            value: 0,
          },
          GetNumBytesAvailableResponse
        );
        return config;
      }

      return null;
    },
    [UsbInitType.EARLY_SONY_CLIE]: async (device) => {
      // Based on pilot-link implementation, which is in turn based on Linux
      // kernel module implementation.
      await this.sendUsbControlRequest(
        device,
        {
          requestType: 'standard',
          recipient: 'device',
          request: usb.LIBUSB_REQUEST_GET_CONFIGURATION,
          index: 0,
          value: 0,
        },
        SUInt8
      );
      await this.sendUsbControlRequest(
        device,
        {
          requestType: 'standard',
          recipient: 'device',
          request: usb.LIBUSB_REQUEST_GET_INTERFACE,
          index: 0,
          value: 0,
        },
        SUInt8
      );
      return null;
    },
  };

  /** USB protocol stacks indexed by UsbProtocolStackType. */
  USB_PROTOCOL_STACKS: {
    [key in UsbProtocolStackType]: new (
      stream: Duplex,
      opts?: SyncConnectionOptions
    ) => SyncConnection;
  } = {
    [UsbProtocolStackType.NET_SYNC]: NetSyncConnection,
    [UsbProtocolStackType.SERIAL]: SerialSyncConnection,
  };

  private log = debug('palm-sync').extend('usb');
  /** Promise returned by the currently running run() function. */
  private runPromise: Promise<void> | null = null;
  /** Flag indicating that stop() has been invoked. */
  private shouldStop = false;
}

if (require.main === module) {
  (async () => {
    const syncServer = new UsbSyncServer(async (dlpConnection) => {
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListReqType.with({
          srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
        })
      );
      console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));
    });
    syncServer.start();
  })();
}
