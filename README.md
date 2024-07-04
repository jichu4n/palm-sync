# palm-sync

<!-- [![NPM Version][npm-version-image]][npm-url] -->

[![Build Status][build-status-image]][github-url]

**palm-sync** is a TypeScript toolkit for performing HotSync with Palm OS devices.

palm-sync provides a new implementation of HotSync in TypeScript, and supports Node.js and browser environments on current mainstream OS platforms. Its goal is to provide a suite of libraries and tools that can pave the way for a modern cross-platform Palm Desktop alternative.

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

- **Platforms**: iOS, iPadOS
- **Connections**: Bluetooth, IR

For more information, please see Connecting Palm OS Devices.

## Web demo

If you have a Palm OS device, you can try out palm-sync right in your browser! The web demo allows you to do a simple HotSync over a USB or serial connection.

👉 [ **jichu4n.github.io/palm-sync/web-demo** ](https://jichu4n.github.io/palm-sync/web-demo/)

Requirements:

- **Connection**: Palm OS device connected via USB or serial, including via a serial-to-USB adapter.
- **OS**: Windows, macOS, Linux, ChromeOS, or Android. See Connecting Palm OS Devices for OS-specific configuration.
- **Browser**: A Chromium-based browser such as Google Chrome or Microsoft Edge.

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

Now connect and initiate HotSync on the Palm OS device! See Connecting Palm OS Devices for OS-specific configuration steps.

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

The [`SyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/SyncServer.html) class represents a daemon that listens for incoming HotSync connections. A `SyncServer` is responsible for interfacing with the underlying hardware, setting up a transport protocol stack and passing control to the configured conduit. The various subclasses of `SyncServer` correspond to different types of connections, such as [`UsbSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/UsbSyncServer.html), [`SerialSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/SerialSyncServer.html) and [`NetworkSyncServer`](https://jichu4n.github.io/palm-sync/docs/classes/NetworkSyncServer.html).

The main APIs for setting up a `SyncServer` are:

- [`createSyncServer()`](https://jichu4n.github.io/palm-sync/docs/functions/createSyncServer.html) - Main entrypoint to create a `SyncServer` instance. The caller can use `start()` and `stop()` to manage the server lifecycle, and subscribe to its `connect` and `disconnect` events.
- [`createSyncServerAndRunSync()`](https://jichu4n.github.io/palm-sync/docs/functions/createSyncServerAndRunSync.html) - Convenience function to run a single HotSync operation - create and start a `SyncServer` instance, run a conduit, and stop the server.

`SyncServer`s themselves don't contain specific conduit logic (i.e. business logic for data synchronization). Instead, they take in a [`SyncFn`](https://jichu4n.github.io/palm-sync/docs/types/SyncFn.html) to be invoked when a HotSync connection is established. The `SyncFn` is responsible for performing the desired conduit logic using the DLP protocol. This provides a clean layer of abstraction between conduit logic and the various types of physical connections.

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

TODO

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
