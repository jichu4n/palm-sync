# How Palm OS HotSync Works

Palm OS HotSync involves a family of communication protocols. Each type of physical connection (serial port, USB, etc) requires a different protocol stack.

## Desktop Link Protocol (DLP)

DLP is the application layer in the HotSync family of protocols. As such, it is the top-most layer exposed by all connection types. Application software will mainly interact with DLP.

DLP functions like a client-server API. The computer sends a DLP request to the Palm OS device, and gets back a response. The API deals with application logic such as reading and writing Palm OS databases and records.

## Serial connections

Serial was the original physical connection type supported by Palm OS devices, starting with the original Pilot. Its protocol stack is a little complex:

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

From the [Palm OS Programmer's Companion](https://www.fuw.edu.pl/~michalj/palmos/SerialCommunication.html#924961):

> - The Serial Link Protocol (SLP) provides best-effort packet send and receive capabilities with CRC-16. SLP does notguarantee packet delivery; this is left to the higher-level protocols.
> - The Packet Assembly/Disassembly Protocol (PADP) sends and receives buffered data. PADP is an efficient protocol featuring variable-size block transfers with robust error checking and automatic retries.
> - The Connection Management Protocol (CMP) provides connection-establishment capabilities featuring baud rate arbitration and exchange of communications software version numbers.

### Serial Link Protocol (SLP)

SLP is the data link layer in the protocol stack. It provides a structure for sending and receiving data packets / frames between a computer and a Palm OS device, including basic error detection.

SLP is documented in the [Palm OS Programmer's Companion](https://www.fuw.edu.pl/~michalj/palmos/SerialCommunication.html#925615). Also see Coldsync's [slp.h](https://github.com/dwery/coldsync/blob/master/include/pconn/slp.h).

Side note: SLP packets have a header signature (`0xbeefed`) that can be used to identify the actual start of communications on a serial port. This is useful because reading from a serial port will return garbage data before the HotSync process starts.

### Packet Assembly / Disassembly Protocol (PADP)

