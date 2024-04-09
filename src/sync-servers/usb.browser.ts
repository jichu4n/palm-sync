/** @file Browser shim for the usb module. */

import {USB_DEVICE_FILTERS} from './usb-device-configs';
import debug from 'debug';

const log = debug('palm-sync:usb');

export const {usb} = navigator;
async function getDeviceList() {
  let devices = await usb.getDevices();
  if (devices.length === 0) {
    log('No USB devices found, prompting user');
    await usb.requestDevice({filters: USB_DEVICE_FILTERS});
    devices = await usb.getDevices();
  }
  return devices.map((device) => {
    const {vendorId, productId, productName, serialNumber} = device;
    (device as any).deviceDescriptor = {
      idVendor: vendorId,
      idProduct: productId,
      iProduct: productName,
      iSerialNumber: serialNumber,
    };
    (device as any).interface = () => ({
      isKernelDriverActive() {
        return false;
      },
      detachKernelDriver() {},
    });
    return device;
  });
}
(usb as any).getDeviceList = getDeviceList;

export const WebUSBDevice = {
  createInstance(device: USBDevice) {
    return device;
  },
};
