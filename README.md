# palm-sync

<!-- [![NPM Version][npm-version-image]][npm-url] -->

[![Build Status][build-status-image]][github-url]

**palm-sync** is a TypeScript toolkit for HotSync with Palm OS devices.

palm-sync provides a new implementation of Palm OS HotSync in TypeScript, and supports Node.js and browser environments on most current mainstream OS platforms. Its goal is to provide a suite of libraries and tools that can pave the way for a modern cross-platform Palm Desktop alternative.

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

For more information, please see Connecting to Palm OS Devices.

## Web demo

If you have a Palm OS device, you can try out palm-sync right in your browser! The web demo allows you to do a simple HotSync over a USB or serial connection.

👉 [ **jichu4n.github.io/palm-sync/web-demo** ](https://jichu4n.github.io/palm-sync/web-demo/)

Requirements:

- **Connection**: Palm OS device connected via USB or serial, including via a serial-to-USB adapter.
- **OS**: Windows, macOS, Linux, ChromeOS, or Android.
  - For USB on Windows, you'll need to install a WinUSB driver for the Palm device. The easiest way is to use a tool such as [Zadig](https://zadig.akeo.ie/).
  - For serial on Linux, you may need to add yourself to the `dialout` or `uucp` group.
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

# Listen for USB connection and run specified conduit.
#   - For serial, use `--serial /dev/ttyXXX` (or `--serial COMn` on Windows)
#   - For network HotSync (port 14238), use `--net`
./node_modules/.bin/palm-sync run --usb ./dist/list-dbs.js

# Now connect a Palm OS device and initiate HotSync!
```

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
