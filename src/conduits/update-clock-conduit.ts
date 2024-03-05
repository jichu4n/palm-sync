import { DlpDBInfoType, DlpOpenConduitReqType, DlpSetSysDateTimeReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { SyncType } from "../sync-utils/sync-device";
import { ConduitInterface } from "./conduit-interface";

export class UpdateClockConduit implements ConduitInterface {
    getName(): String {
        return "Updating clock on Palm OS Device";
    }
    async execute(dlpConnection: DlpConnection, dbList: DlpDBInfoType[] | null, palmDir: String | null, syncType: SyncType | null): Promise<void> {
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        let setDateTimeReq = new DlpSetSysDateTimeReqType();
        setDateTimeReq.dateTime = new Date();
        await dlpConnection.execute(setDateTimeReq);
    }
}