import {action, makeObservable, observable} from 'mobx';
import {
  DlpGetSysDateTimeRespType,
  DlpReadSysInfoRespType,
  DlpReadUserInfoRespType,
} from 'palm-sync';

export interface UsbDeviceInfo {
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
}

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
  usbDeviceInfo: UsbDeviceInfo | null = null;

  update({
    sysInfo,
    userInfo,
    sysDateTime,
    usbDeviceInfo,
  }: {
    sysInfo?: DlpReadSysInfoRespType;
    userInfo?: DlpReadUserInfoRespType;
    sysDateTime?: DlpGetSysDateTimeRespType;
    usbDeviceInfo?: UsbDeviceInfo;
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
    if (usbDeviceInfo) {
      this.usbDeviceInfo = usbDeviceInfo;
    }
    console.log('Device info: ', sysInfo, userInfo, sysDateTime, usbDeviceInfo);
  }
}

export const deviceInfoStore = new DeviceInfoStore();
