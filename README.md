# palm-sync

<!-- [![NPM Version][npm-version-image]][npm-url] -->

[![Build Status][build-status-image]][github-url]

**palm-sync** is a TypeScript toolkit for syncing with Palm OS devices.

The goal of palm-sync is to provide an implementation of Palm OS HotSync for modern platforms. It does not aim to become a full-featured Palm Desktop replacement by itself, but rather a set of libraries and tools that enable such applications to be built on top of it. In particular, by supporting the Node and browser environments, palm-sync makes it possible to build a modern cross-platform HotSync solution based on Web technologies.

## Web demo

The web demo allows you to do a no-op HotSync with a real Palm OS device, right from your browser!

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;👉 [ **jichu4n.github.io/palm-sync/web-demo** ](https://jichu4n.github.io/palm-sync/web-demo/)👈

Requirements for the demo:

- **Connection**: Palm OS device connected via USB or serial cable, including via a serial-to-USB adapter.
- **Browser**: A Chromium-based browser such as Google Chrome or Microsoft Edge, with the WebUSB and Web Serial APIs enabled.
- **OS**: Windows, macOS, Linux, ChromeOS, or Android.
  - For USB on Windows, you'll need to install a WinUSB driver for the Palm device. The easiest way is to use a tool such as [Zadig](https://zadig.akeo.ie/).
  - For serial on Linux, you may need to add yourself to the `dialout` or `uucp` group to get access to serial devices.

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
      <td style="text-align: center"></td>
      <td style="text-align: center"></td>
      <td style="text-align: center"></td>
      <td style="text-align: center">Y</td>
      <td style="text-align: center">Y</td>
    </tr>
    <tr>
      <td style="text-align: center">Android</td>
      <td style="text-align: center"></td>
      <td style="text-align: center"></td>
      <td style="text-align: center"></td>
      <td style="text-align: center">N</td>
      <td style="text-align: center">Y</td>
    </tr>
  </tbody>
</table>

For more information, please see OS-specific notes below.

[npm-url]: https://npmjs.org/package/palm-sync
[npm-version-image]: https://badgen.net/npm/v/palm-sync
[github-url]: https://github.com/jichu4n/palm-sync
[build-status-image]: https://github.com/jichu4n/palm-sync/actions/workflows/build.yaml/badge.svg
