/** Serial-over-TCP HotSync server.
 *
 * This is mainly intended to facilitate development using POSE, which supports
 * bridging serial connections to TCP connections.
 */
import {MemoRecord} from '@palmira/pdb';
import {Duplex} from 'stream';
import {
  DlpCloseDBRequest,
  DlpOpenConduitRequest,
  DlpOpenDBRequest,
  DlpOpenMode,
  DlpReadDBListMode,
  DlpReadDBListRequest,
  DlpReadOpenDBInfoRequest,
  DlpReadRecordByIDRequest,
  DlpReadRecordIDListRequest,
  doCmpHandshake,
  NetworkSyncServer,
  PadpStream,
  SyncConnection,
} from '.';

/** Serial-over-TCP port to listen on.
 *
 * This is an arbitrary value that just has to match the value entered into
 * POSE's serial port field in the form `localhost:XXX`.
 */
export const SERIAL_NETWORK_SYNC_PORT = 6416;

export class SerialNetworkSyncServer extends NetworkSyncServer<SerialNetworkSyncConnection> {
  connectionType = SerialNetworkSyncConnection;
  port = SERIAL_NETWORK_SYNC_PORT;
}

export class SerialNetworkSyncConnection extends SyncConnection<PadpStream> {
  createDlpStream(rawStream: Duplex): PadpStream {
    return new PadpStream(rawStream);
  }
  async doHandshake() {
    await doCmpHandshake(this.dlpStream, 115200);
  }
}

if (require.main === module) {
  const syncServer = new SerialNetworkSyncServer(async ({dlpConnection}) => {
    const readDbListResp = await dlpConnection.execute(
      DlpReadDBListRequest.with({
        mode: DlpReadDBListMode.LIST_RAM | DlpReadDBListMode.LIST_MULTIPLE,
      })
    );
    console.log(readDbListResp.metadataList.map(({name}) => name).join('\n'));

    await dlpConnection.execute(new DlpOpenConduitRequest());
    const {dbHandle} = await dlpConnection.execute(
      DlpOpenDBRequest.with({
        mode: DlpOpenMode.READ,
        name: 'MemoDB',
      })
    );
    const {numRecords} = await dlpConnection.execute(
      DlpReadOpenDBInfoRequest.with({dbHandle})
    );
    const {recordIds} = await dlpConnection.execute(
      DlpReadRecordIDListRequest.with({
        dbHandle,
        maxNumRecords: 500,
      })
    );
    const memoRecords: Array<MemoRecord> = [];
    for (const recordId of recordIds) {
      const resp = await dlpConnection.execute(
        DlpReadRecordByIDRequest.with({
          dbHandle,
          recordId,
        })
      );
      const record = MemoRecord.from(resp.data.value);
      memoRecords.push(record);
    }
    console.log(
      `Memos:\n----------\n${memoRecords
        .map(({value}) => value)
        .filter((value) => !!value.trim())
        .join('\n----------\n')}\n----------\n`
    );

    await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle}));
  });
  syncServer.start();
}
