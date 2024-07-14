# Connecting Palm OS Devices

This document will guide you through the process of connecting a Palm OS device to your computer to perform a HotSync with [`palm-sync`](https://github.com/jichu4n/palm-sync/).

## General setup

The following are required regardless of OS:

- **Node.js**: Node.js 18.x or higher.
- **Browser**: WebUSB and/or Web Serial APIs. These APIs are presently only available in Chromium-based browsers, such as Google Chrome and Microsoft Edge.

### Serial

#### Hardware

To connect a Palm OS device with a serial cradle or cable to a modern computer, you'll likely need a serial-to-USB adapter. These are widely available and fairly cheap (typically $5 USD or less on sites like AliExpress), and are generally supported out of the box on modern OSes.

#### Performing a HotSync

The recommended way to perform a HotSync with `palm-sync` over serial:

1. Physically connect the Palm device to the computer via serial cradle / cable and serial-to-USB adapter if needed.
2. Start `palm-sync` sync server on the computer.
   - CLI: `--serial ttyXXX` on macOS and Linux, `--serial COMn` on Windows
   - Browser: Start sync, select the serial port in the popup, and click `Connect`.
3. Start HotSync on the Palm OS device.

The order is important here. If you perform steps 2 and 3 in the reverse order, the sync will most likely fail and you may need to physically disconnect the Palm device from the computer before trying again.

#### Baud rate

Modern serial-to-USB adapters typically support baud rates up to 115200, while early Palm OS devices can only support much lower baud rates. During the initial handshake phase of a HotSync session, the Palm device and the computer negotiate the highest baud rate supported on both sides, and switch to that baud rate for the remainder of the session.

However, the negotiated baud rate may not actually work correctly on your hardware and platform. So if your serial connection stalls, try explicitly specifying a lower maximum baud rate through the API or CLI (e.g. `--maxBaudRate 9600`).

### USB

#### Performing a HotSync

The recommended way to perform a HotSync with `palm-sync` over USB:

1. Physically connect the Palm device to the computer via USB cradle / cable.
2. Start HotSync on the Palm OS device.
3. Start `palm-sync` sync server.
   - CLI: `--usb`
   - Browser: Start sync, select the Palm device in the popup, and click `Connect`.

For most Palm devices with a USB cradle / cable, steps 2 and 3 can be performed in either order. However, some models like the LifeDrive and Z22 might only work when following the order above.

## Windows

`palm-sync` supports Windows 10 and Windows 11:

- **Node.js**: Official build of Node.js for Windows (installed directly or via a tool like nvm). Node.js installed inside WSL is also supported (see [WSL section below](#wsl)).
- **Browser**: Tested in Chrome or Edge; will likely work in other Chromium-based browsers as long as WebUSB and / or Web Serial APIs are enabled.

### Serial

Use Device Manager to identify the port number corresponding to the serial port or serial-to-USB adapter, which should look something like `COM5`.

![Windows Device Manager](./windows-serial-to-usb-adapter.png)

### USB

`palm-sync` uses either `libusb` (Node.js) or the WebUSB API (browser). In both cases, a generic WinUSB driver must be installed for the connected Palm OS device. The recommended way to install and configure the driver is to use [Zadig](http://zadig.akeo.ie/). See [libusb documentation](https://github.com/libusb/libusb/wiki/Windows#driver-installation) for more information.

To set up a Palm device using Zadig:

- Install Zadig on the computer and launch it.
- Select `Options` > `List All Devices` from the menu: ![Zadig Options menu](./windows-zadig-options.png)
- Connect the Palm device to the computer via USB cradle / cable.
- Start HotSync on the Palm device. This is necessary because most Palm devices won't actually show up on the computer until you start a HotSync.
- In Zadig, select the Palm device, select the WinUSB driver, and click on `Replace Driver`. It's normal for this step to take a while and it's okay if the Palm device disconnects during the process. ![Zadig WinUSB driver](./windows-zadig.png)
- The Palm device should be automatically mapped to the WinUSB driver on subsequent connections. However, you should keep Zadig around in case the driver needs to be replaced again.

You can now start HotSync on the Palm device, and run `palm-sync` in Node.js or the browser. If the WinUSB driver is correctly installed for the device, `palm-sync` should now be able to detect and communicate with it.

### WSL

You can forward the relevant USB device (either the Palm device or the serial-to-USB adapter) to the Linux distribution inside WSL, then run `palm-sync` just like on regular Linux.

- See [Microsoft documentation](https://learn.microsoft.com/en-us/windows/wsl/connect-usb) for detailed instructions on forwarding USB devices to WSL.
- See the [Linux section below](#linux) for instructions on setting up `palm-sync` on Linux.

Caveat: Since WSL does not support forwarding actual serial ports, you will need to use a USB-to-serial adapter if you want to use WSL.

## macOS

TODO

## Linux

TODO

## ChromeOS

TODO

## Android

TODO
