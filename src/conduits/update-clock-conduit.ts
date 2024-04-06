import {
  DlpOpenConduitReqType,
  DlpSetSysDateTimeReqType,
} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {ConduitData, ConduitInterface} from './conduit-interface';
import debug from 'debug';

const log = debug('palm-sync').extend('conduit').extend('update-clock');

/**
 * This conduit sets the PDA's clock to the same date and time
 * of the machine that palm-sync is running
 */
export class UpdateClockConduit implements ConduitInterface {
  name = 'update clock';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void> {
    await dlpConnection.execute(DlpOpenConduitReqType.with({}));
    let setDateTimeReq = new DlpSetSysDateTimeReqType();
    setDateTimeReq.dateTime = new Date();
    await dlpConnection.execute(setDateTimeReq);
    log(`Done! Successfully updated the device clock`);
  }
}
