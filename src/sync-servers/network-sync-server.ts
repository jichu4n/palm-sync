import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';
import {NetSyncConnection} from '../protocols/sync-connections';
import {TcpSyncServer} from './tcp-sync-server';

/** HotSync port to listen on. */
export const NET_SYNC_PORT = 14238;

/** Sync server for network HotSync connections.
 *
 * Only available in Node.js.
 */
export class NetworkSyncServer extends TcpSyncServer<NetSyncConnection> {
  connectionType = NetSyncConnection;
  port = NET_SYNC_PORT;
}

if (require.main === module) {
  const syncServer = new NetworkSyncServer(async (dlpConnection) => {
    const readDbListResp = await dlpConnection.execute(
      DlpReadDBListReqType.with({
        srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
      })
    );
    console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));
  });
  syncServer.start();
}
