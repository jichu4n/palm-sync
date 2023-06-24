# How Palm OS HotSync Works

Palm OS HotSync involves a family of communication protocols. Each type of physical connection (serial port, USB, etc) requires a different stack of communication protocols.

## Desktop Link Protocol

The Desktop Link Protocol (DLP) is the application layer protocol in the HotSync family of protocols. As such, it is always the top-most layer in the protocol stack. Desktop-side application (i.e. "conduit") developers will mainly interact with DLP.

DLP functions like a client-server API. The desktop-side application sends requests to the Palm OS device, and gets back a response. The API deals directly with application logic such as reading and writing Palm OS databases and records.

## Serial connections

Serial was the first physical connection type supported by Palm OS devices, starting with the original Pilot. Its protocol stack is fairly complex.

```
      ┌─────┐  ┌─────┐
  ┌───┤ CMP │  │ DLP │
  │   └─┬───┘  └─┬───┘
  │     │        │
  │   ┌─▼────────▼───┐
  │   │ PADP         │
  │   └─┬────────────┘
  │     │
  │   ┌─▼───┐
  │   │ SLP │
  │   └─┬───┘
  │     │
  │   ┌─▼────────────┐
  └───► Serial port  │
      └──────────────┘
```
