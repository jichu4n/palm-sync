/** @file Browser shim for the usb module. */

import debug from 'debug';
import {toUsbId} from './usb-device-configs';

const log = debug('palm-sync:usb');

async function requestDevice({filters}: {filters: Array<USBDeviceFilter>}) {
  log('Requesting device...');
  let device: USBDevice;
  try {
    device = await navigator.usb.requestDevice({filters});
  } catch (e) {
    log(`${e instanceof Error ? e.message : e}`);
    throw e;
  }
  log(`Selected device ${toUsbId(device)}`);
  return device;
}

async function getDeviceList() {
  const devices = await navigator.usb.getDevices();
  return devices.map((device) => {
    const {vendorId, productId, productName, serialNumber} = device;
    (device as any).deviceDescriptor = {
      idVendor: vendorId,
      idProduct: productId,
      iProduct: productName,
      iSerialNumber: serialNumber,
    };
    (device as any).interface = () => ({
      isKernelDriverActive() {
        return false;
      },
      detachKernelDriver() {},
    });
    return device;
  });
}

export const usb = {
  requestDevice,
  getDeviceList,

  LIBUSB_REQUEST_GET_STATUS: 0x00,
  LIBUSB_REQUEST_CLEAR_FEATURE: 0x01,
  LIBUSB_REQUEST_SET_FEATURE: 0x03,
  LIBUSB_REQUEST_SET_ADDRESS: 0x05,
  LIBUSB_REQUEST_GET_DESCRIPTOR: 0x06,
  LIBUSB_REQUEST_SET_DESCRIPTOR: 0x07,
  LIBUSB_REQUEST_GET_CONFIGURATION: 0x08,
  LIBUSB_REQUEST_SET_CONFIGURATION: 0x09,
  LIBUSB_REQUEST_GET_INTERFACE: 0x0a,
  LIBUSB_REQUEST_SET_INTERFACE: 0x0b,
  LIBUSB_REQUEST_SYNCH_FRAME: 0x0c,
  LIBUSB_REQUEST_SET_SEL: 0x30,
  LIBUSB_SET_ISOCH_DELAY: 0x31,
};

export const WebUSBDevice = {
  createInstance(device: USBDevice) {
    return device;
  },
};
