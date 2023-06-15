/** Serial-over-TCP HotSync server.
 *
 * This is mainly intended to facilitate development using POSE, which supports
 * bridging serial connections to TCP connections.
 */
import {MemoRecord} from 'palm-pdb';
import {Duplex} from 'stream';
import {doCmpHandshake} from './cmp-protocol';
import {
  DlpCloseDBReqType,
  DlpOpenConduitReqType,
  DlpOpenDBMode,
  DlpOpenDBReqType,
  DlpReadDBListFlags,
  DlpReadDBListReqType,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordByIDReqType,
  DlpReadRecordIDListReqType,
} from './dlp-commands';
import {PadpStream} from './padp-protocol';
import {NetworkSyncServer, SyncConnection} from './sync-server';

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
      DlpReadDBListReqType.with({
        srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
      })
    );
    console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));

    await dlpConnection.execute(new DlpOpenConduitReqType());
    const {dbId} = await dlpConnection.execute(
      DlpOpenDBReqType.with({
        mode: DlpOpenDBMode.with({read: true}),
        name: 'MemoDB',
      })
    );
    const {numRec: numRecords} = await dlpConnection.execute(
      DlpReadOpenDBInfoReqType.with({dbId})
    );
    const {recordIds} = await dlpConnection.execute(
      DlpReadRecordIDListReqType.with({
        dbId,
        maxNumRecords: 500,
      })
    );
    const memoRecords: Array<MemoRecord> = [];
    for (const recordId of recordIds) {
      const resp = await dlpConnection.execute(
        DlpReadRecordByIDReqType.with({
          dbId,
          recordId,
        })
      );
      const record = MemoRecord.from(resp.data);
      memoRecords.push(record);
    }
    console.log(
      `Memos:\n----------\n${memoRecords
        .map(({value}) => value)
        .filter((value) => !!value.trim())
        .join('\n----------\n')}\n----------\n`
    );

    await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
  });
  syncServer.start();
}
