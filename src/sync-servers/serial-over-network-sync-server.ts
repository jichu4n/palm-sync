/** Serial-over-TCP HotSync server.
 *
 * This is mainly intended to facilitate development using POSE, which supports
 * bridging serial connections to TCP connections.
 */
import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';
import {SerialSyncConnection} from '../protocols/sync-connections';
import {TcpSyncServer} from './tcp-sync-server';

/** Port to listen on for serial-over-network HotSync.
 *
 * This is an arbitrary value that just has to match the value entered into
 * POSE's serial port field in the form `localhost:XXX`.
 */
export const SERIAL_NETWORK_SYNC_PORT = 6416;

/** Sync server for serial-over-network connections, primarily for use with Palm
 * OS emulators such as POSE.
 *
 * Only available in Node.js.
 */
export class SerialOverNetworkSyncServer extends TcpSyncServer<SerialSyncConnection> {
  connectionType = SerialSyncConnection;
  port = SERIAL_NETWORK_SYNC_PORT;
}

if (require.main === module) {
  const syncServer = new SerialOverNetworkSyncServer(async (dlpConnection) => {
    const readDbListResp = await dlpConnection.execute(
      DlpReadDBListReqType.with({
        srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
      })
    );
    console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));
  });
  syncServer.start();
}
