# palm-sync

<!-- [![NPM Version][npm-version-image]][npm-url] -->

[![Build Status][build-status-image]][github-url]

**palm-sync** is a modern, cross-platform toolkit for HotSync with Palm OS devices, built with TypeScript.

palm-sync provides a new implementation of Palm HotSync protocols in TypeScript, and supports Node.js and browser environments. It aspires to be the foundation for a new generation of Palm OS synchronization tools for modern operating systems.

## Supported platforms and features

<table>
  <thead>
    <tr>
      <th rowspan=2 style="text-align: center">OS</th>
      <th colspan=3 style="text-align: center">Node.js 18+</th>
      <th colspan=2 style="text-align: center">Browser (Chromium)</th>
    </tr>
    <tr>
      <th style="text-align: center">Serial</th>
      <th style="text-align: center">USB</th>
      <th style="text-align: center">Network</th>
      <th style="text-align: center">Serial</th>
      <th style="text-align: center">USB</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center">Windows</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
    </tr>
    <tr>
      <td style="text-align: center">macOS</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
    </tr>
    <tr>
      <td style="text-align: center">Linux</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
    </tr>
    <tr>
      <td style="text-align: center">ChromeOS</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
    </tr>
    <tr>
      <td style="text-align: center">Android</td>
      <td style="text-align: center">N/A</td>
      <td style="text-align: center">N/A</td>
      <td style="text-align: center">N/A</td>
      <td style="text-align: center">N</td>
      <td style="text-align: center">Y</td>
    </tr>
  </tbody>
</table>

Not supported:

- **Operating systems**: iOS, iPadOS
- **Connections**: Bluetooth, IR

For more information, please see [Connecting Palm OS Devices](./docs/connecting-palm-os-devices.md).

## Web demo

You can try out palm-sync right in your browser! The web demo allows you to do a simple HotSync with a Palm OS device via USB or serial.

👉 [ **jichu4n.github.io/palm-sync/web-demo** ](https://jichu4n.github.io/palm-sync/web-demo/)

Requirements:

- Palm OS device connected via USB or serial, including via serial-to-USB adapter.
- A Chromium-based browser such as Google Chrome or Microsoft Edge, running on Windows, macOS, Linux, ChromeOS, or Android (USB only). See [Connecting Palm OS Devices](./docs/connecting-palm-os-devices.md) for OS-specific setup instructions.

## Quickstart

### Installation

```
npm install --save palm-sync
```

### Create a conduit

Example conduit to list the databases on a Palm device:

```ts
// ./src/list-dbs.ts
import {
  DlpConnection,
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from 'palm-sync';

export async function run(dlpConnection: DlpConnection) {
  const readDbListResp = await dlpConnection.execute(
    DlpReadDBListReqType.with({
      srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
    })
  );
  const dbNames = readDbListResp.dbInfo.map(({name}) => name);
  console.log(dbNames.join('\n'));
}
```

### Run conduit with CLI

```bash
# Run tsc to produce ./dist/list-dbs.js
npm run build

# Wait for HotSync connection over USB and run specified conduit.
#   - For serial, use `--serial /dev/ttyXXX` (`--serial COMn` on Windows)
#   - For network HotSync (port 14238), use `--net`
#   - For serial-over-network (POSE and other emulators), use `--serial:net`
#     to listen on port 6416
./node_modules/.bin/palm-sync run --usb ./dist/list-dbs.js
```

Now connect and initiate HotSync on the Palm OS device! See [Connecting Palm OS Devices](./docs/connecting-palm-os-devices.md) for OS-specific setup.

## API

### Overview

For a general introduction to HotSync's architecture, please first read [👉 How Palm OS HotSync Works](https://github.com/jichu4n/palm-sync/blob/master/docs/how-palm-os-hotsync-works.md). This will help provide context for the APIs discussed below.

palm-sync's API is organized into the following main components:

- **Sync servers** - Interfacing with OS / hardware and managing the sync process.
- **Protocols** - Implements the various communication protocols in the HotSync protocol stack.
- **Sync utils** - Common sync logic and helpers.
- **Conduits** - General purpose conduits.

Additionally, palm-sync depends on the following sister projects:

- [**palm-pdb**](https://github.com/jichu4n/palm-pdb) - Manipulating Palm OS databases and related data structures.
- [**serio**](https://github.com/jichu4n/serio) - Serializing / deserializing binary data.

### Sync servers

The [`SyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/SyncServer.html) class represents a daemon that listens for incoming HotSync connections. A `SyncServer` is responsible for interfacing with the underlying hardware, setting up a transport protocol stack and passing control to the configured conduit. The various subclasses of `SyncServer` correspond to different types of connections.

A `SyncServer` doesn't perform conduit logic (i.e. business logic for data synchronization) itself. Instead, it takes in a [`SyncFn`](https://jichu4n.github.io/palm-sync/docs/types/SyncFn.html) which it passes control to when a HotSync connection is established. The `SyncFn` is responsible for performing the desired conduit logic over the DLP protocol. This provides a clean connection-agnostic abstraction for conduit logic.

| Connection type                                                                                                    | Node.js                                                        | Browser (Chromium)                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`UsbSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/UsbSyncServer.html)                             | Yes - [`usb`](https://www.npmjs.com/package/usb)               | Yes - [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API)         |
| [`SerialSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/SerialSyncServer.html)                       | Yes - [`serialport`](https://www.npmjs.com/package/serialport) | No                                                                                      |
| [`WebSerialSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/WebSerialSyncServer.html)                 | No                                                             | Yes - [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) |
| [`NetworkSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/NetworkSyncServer.html)                     | Yes - [`net`](https://nodejs.org/api/net.html)                 | No                                                                                      |
| [`SerialOverNetworkSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/SerialOverNetworkSyncServer.html) | Yes - [`net`](https://nodejs.org/api/net.html)                 | No                                                                                      |

To create a `SyncServer`:

- [`createSyncServer()`](https://jichu4n.github.io/palm-sync/docs/functions/createSyncServer.html) - Main entrypoint to create a `SyncServer` instance. The caller can use `start()` and `stop()` to manage the server lifecycle, and subscribe to its `connect` and `disconnect` events.
- [`createSyncServerAndRunSync()`](https://jichu4n.github.io/palm-sync/docs/functions/createSyncServerAndRunSync.html) - Convenience function to run a single HotSync operation - create and start a `SyncServer` instance, run a conduit, and stop the server.

### Protocols

The [`DlpConnection`](https://jichu4n.github.io/palm-sync/docs/classes/DlpConnection.html) class represents a connection to a Palm device over the DLP protocol. It provides a high-level API for executing DLP commands, which is the primary way conduits interact with a connected Palm device.

For the full list of supported DLP commands, see the list of subclasses of [`DlpRequest`](https://jichu4n.github.io/palm-sync/docs/classes/DlpRequest.html). palm-sync provides request and response type definitions for all DLP commands up to DLP version 1.2 (Palm OS 3.0). It does not currently support commands introduced in DLP version 1.3 (Palm OS 4.0) and later.

Under the hood, a `DlpConnection` wraps one of two possible transport protocol stacks, which themselves are implemented as transform streams wrapping the underlying raw data streams. The `SyncServer` subclass for each connection type is responsible for setting up the appropriate transport stack and constructing `DlpConnection`s. Conduit logic generally does not need to directly interact with the transport protocol stacks.

### Sync utils

palm-sync provides a collection of utility functions to help with common conduit tasks. Some key utilities include:

#### Databases and PDB / PRC files

- [`readDbList()`](https://jichu4n.github.io/palm-sync/docs/functions/readDbList.html)
- [`readRawDb()`](https://jichu4n.github.io/palm-sync/docs/functions/readRawDb.html) and [`readDb()`](https://jichu4n.github.io/palm-sync/docs/functions/readDb.html)
- [`writeRawDb()`](https://jichu4n.github.io/palm-sync/docs/functions/writeRawDb.html) and [`writeDb()`](https://jichu4n.github.io/palm-sync/docs/functions/writeDb.html)

#### Two-way sync

These functions provide a generic implementation of Palm OS's two-way synchronization logic.

- [`fastSync()`](https://jichu4n.github.io/palm-sync/docs/functions/fastSync.html) and [`fastSyncDb()`](https://jichu4n.github.io/palm-sync/docs/functions/fastSyncDb.html)
- [`slowSync()`](https://jichu4n.github.io/palm-sync/docs/functions/slowSync.html) and [`slowSyncDb()`](https://jichu4n.github.io/palm-sync/docs/functions/slowSyncDb.html)

#### Conduits

TODO

### Logs

palm-sync uses the [`debug`](https://www.npmjs.com/package/debug) library for logging messages. All messages are logged under the `palm-sync` namespace.

To enable verbose logging, set the `DEBUG` environment variable to `palm-sync:*` or call `debug.enable('palm-sync:*')` to enable logging programmatically. You can capture logs by overriding `debug.log`. See [`debug` documentation](https://www.npmjs.com/package/debug) for more information.

Note that on Web, you will need to import `debug` from `palm-sync` itself as it is bundled with the library using Browserify. See [`log-store.ts`](https://github.com/jichu4n/palm-sync/blob/master/tools/web-demo/src/log-store.ts) for an example.

### Reference

- [👉 How Palm OS HotSync Works](https://github.com/jichu4n/palm-sync/blob/master/docs/how-palm-os-hotsync-works.md)
- [👉 API reference ](https://jichu4n.github.io/palm-sync/docs/)

## Contributors

- Chuan Ji ([@jichu4n](https://github.com/jichu4n))
- Otávio Pinheiro ([@Tavisco](https://github.com/Tavisco))

[npm-url]: https://npmjs.org/package/palm-sync
[npm-version-image]: https://badgen.net/npm/v/palm-sync
[github-url]: https://github.com/jichu4n/palm-sync
[build-status-image]: https://github.com/jichu4n/palm-sync/actions/workflows/build.yaml/badge.svg
