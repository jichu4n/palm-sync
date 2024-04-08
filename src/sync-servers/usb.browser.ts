/** @file Browser shim for the usb module. */

export const {usb} = navigator;

// Shim for legacy API getDeviceList(). Only functionality used by palm-sync is implemented.
async function getDeviceList() {
  console.log('Running shim for getDeviceList()');
  const devices = await usb.getDevices();
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
