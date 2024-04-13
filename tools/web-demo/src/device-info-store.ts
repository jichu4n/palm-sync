import {action, makeObservable, observable} from 'mobx';
import {
  DlpGetSysDateTimeRespType,
  DlpReadSysInfoRespType,
  DlpReadUserInfoRespType,
} from 'palm-sync';

class DeviceInfoStore {
  constructor() {
    makeObservable(this, {
      sysInfo: observable,
      userInfo: observable,
      sysDateTime: observable,
      update: action,
    });
  }

  sysInfo: DlpReadSysInfoRespType | null = null;
  userInfo: DlpReadUserInfoRespType | null = null;
  sysDateTime: DlpGetSysDateTimeRespType | null = null;

  update({
    sysInfo,
    userInfo,
    sysDateTime,
  }: {
    sysInfo?: DlpReadSysInfoRespType;
    userInfo?: DlpReadUserInfoRespType;
    sysDateTime?: DlpGetSysDateTimeRespType;
  }) {
    if (sysInfo) {
      this.sysInfo = sysInfo;
    }
    if (userInfo) {
      this.userInfo = userInfo;
    }
    if (sysDateTime) {
      this.sysDateTime = sysDateTime;
    }
    console.log('Device info: ', sysInfo, userInfo, sysDateTime);
  }
}

export const deviceInfoStore = new DeviceInfoStore();
