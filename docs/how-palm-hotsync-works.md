# How Palm HotSync Works

This document describes the architecture of Palm HotSync, which is the mechanism that enables Palm OS devices to communicate with software running on a computer.

## Overview

Here's a high level diagram illustrating the high level components involved in HotSync:

<img src="./architecture.svg" width="500">

- **Conduit**: Palm's terminology for application logic that runs on the computer.

- **Desktop Link Protocol (DLP)**: The main API that conduits use to communicate with a Palm device. The protocol operates in a familiar request-response style, where a conduit can send a request to the Palm and get back a response. A modern analogy would be a custom gRPC or REST API.

- **Two-way sync**: Standard logic for synchronizing records that may be manipulated on the Palm device, on the computer, or both. Most Palm apps and their corresponding conduits follow the standard way of marking records as new / dirty / deleted, and can thus rely on the standard two-way sync logic without reinventing the wheel. A modern analogy might be OT or CRDT.

- **Transport protocols**: Depending on the physical connection and the particular device, one of two transport protocol stacks is used to trasmit DLP requests and responses between the computer and the Palm device. A modern analogy would be the HTTP / TCP / IP stack.

- **Sync server**: For lack of a better term, this is the low level component that interacts with the computer's operating system and device drivers. It's responsible for things like setting up serial / USB / network ports, and of course actually sending and receiving data through these connections.

Now let's dive into each component.

## Desktop Link Protocol (DLP)

The DLP protocol is HotSync's application level protocol and provides a request-response style API to conduits. DLP is agnostic of the underlying physical connection; from a conduit's perspective, DLP works the same whether the Palm OS device is connected over serial, USB, modem, Bluetooth, or Wi-Fi.

Each DLP request performs a specific action such as getting / setting the system time, opending / closing a database, and reading / writing a record. The initial version of Palm OS supported about 30 different requests, and each subsequent major version of Palm OS added more and more requests, culminating in a total of ~80 by Palm OS 5.

Overall DLP requests and responses are fairly straightforward. Note that, unlike modern web APIs, DLP is stateful. For example, the conduit might send a 1st request to open a database, a 2nd request to read its records, then a 3rd request to close it.

For the full list of DLP requests, see [dlp-commants.ts](../src/protocols/dlp-commands.ts).
