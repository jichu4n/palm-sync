# Connecting Palm OS Devices

This document will guide you through the process of connecting a Palm OS device to your computer to perform a HotSync with [`palm-sync`](https://github.com/jichu4n/palm-sync/).

## General setup

The following are required regardless of OS:

- **Node.js**: Node.js 18.x or higher.
- **Browser**: WebUSB and/or Web Serial APIs. These APIs are presently only available in Chromium-based browsers, such as Google Chrome and Microsoft Edge.

### Serial

To connect a Palm OS device with a serial cradle or cable to a modern computer, you likely need a serial-to-USB adapter. These are widely available and fairly cheap (typically $5 USD or less on sites like AliExpress), and are generally supported out of the box on modern mainstream OSes.

Recommended way to perform a HotSync over serial:

1. Physically connect the Palm device to the computer via serial cradle / cable and serial-to-USB adapter if needed.
2. Start `palm-sync` sync server.
   - CLI: `--serial ttyXXX` on macOS and Linux, `--serial COMn` on Windows
3. Start HotSync on Palm OS device.

Starting HotSync on the Palm OS device before staring the `palm-sync` sync server generally won't work. In such cases you might need to physically disconnect the Palm device from the computer before trying again.

### Baud rate

Modern serial-to-USB adapters typically support baud rates up to 115200, while early Palm OS devices can only support much lower baud rates. As part of the CMP protocol, the Palm device reports the highest baud rate it can support, and both sides will switch to it. However, depending on the OS, platform, serial adapter and Palm device, this may not always work correctly.

So, if your serial connection stalls, try disconnecting and explicitly selecting a lower maximum baud rate through the API or CLI (e.g. `--maxBaudRate 9600`). You can start with the lowest possible baud rate of 9600 and work your way up.

## Windows

`palm-sync` supports Windows 10 and Windows 11.

### Device setup

#### Serial

Use Device Manager to identify the port number corresponding to the serial port or serial-to-USB adapter, which should look something like `COM5`.

#### USB

`palm-sync` uses either `libusb` (Node.js) or the WebUSB API (browser). In both cases, a generic WinUSB driver must be installed for the connected Palm OS device. The recommended way to install and configure the driver is to use [Zadig](http://zadig.akeo.ie/). See [libusb documentation](https://github.com/libusb/libusb/wiki/Windows#driver-installation) for more information.

To set up a Palm device for the first time using Zadig:

- Install Zadig on the computer and launch it.
- Connect the Palm device to the computer via USB cradle / cable.
- Start HotSync on the Palm device. This is necessary because most Palm devices won't actually show up on the computer until you start a HotSync.
- In Zadig, select the Palm device, select the WinUSB driver, and click on the install button. It's okay if the Palm device disconnects during the process.

The Palm device should be automatically mapped to the WinUSB driver on subsequent connections. However, you should keep Zadig around in case you need to map the driver again.

### palm-sync setup

### WSL

TODO

### Browser

TODO1866-0213

## macOS

TODO

## Linux

TODO

## ChromeOS

TODO

## Android

TODO
