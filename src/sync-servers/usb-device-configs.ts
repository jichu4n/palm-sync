/** USB configuration info for a Palm OS device. */
export interface UsbDeviceConfig {
  /** The device's USB vendor ID. */
  vendorId: number;
  /** The device's USB product ID. */
  productId: number;
  /** Full USB ID of the form xxxx:xxxx. */
  usbId: string;
  /** Label for this type of device. */
  label: string;
  /** Device-specific initialization routine required. */
  initType: UsbInitType;
  /** Protocol stack to use on top of USB connection. */
  protocolStackType: UsbProtocolStackType;
}

/** Device-specific initialization routines. */
export enum UsbInitType {
  /** No USB initialization required. */
  NONE = 'none',
  /** Generic initialization routine for most Palm OS devices. */
  GENERIC = 'generic',
  /** Early SONY CLIE devices. */
  EARLY_SONY_CLIE = 'earlySonyClie',
}

/** Protocol stack to use on top of USB connection. */
export enum UsbProtocolStackType {
  /** Use NetSync protocol stack. */
  NET_SYNC = 'netSync',
  /** Use serial protocol stack (SLP, PADP, and CMP). */
  SERIAL = 'serial',
}

/** USB hardware configuration info for all known Palm OS devices.
 *
 * Information is based on pilot-link, and has not been comprehensively
 * tested.
 */
export const USB_DEVICE_CONFIGS: ReadonlyArray<UsbDeviceConfig> = Object.freeze(
  [
    /* Sony */
    {
      vendorId: 0x054c,
      productId: 0x0038,
      label: 'Sony S S300 and other Palm OS 3.5 devices',
      initType: UsbInitType.NONE,
      protocolStackType: UsbProtocolStackType.SERIAL,
    },

    {
      vendorId: 0x054c,
      productId: 0x0066,
      label: 'Sony T, SJ series, and other Palm OS 4.0 devices',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x0095,
      label: 'Sony S360',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x000a,
      label: 'Sony NR and other Palm OS 4.1 devices',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x009a,
      label: 'Sony NR70V/U',
      initType: UsbInitType.EARLY_SONY_CLIE,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x00da,
      label: 'Sony NX',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x00e9,
      label: 'Sony NZ',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x0144,
      label: 'Sony UX',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x054c,
      productId: 0x0169,
      label: 'Sony TJ',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* AlphaSmart */
    {
      vendorId: 0x081e,
      productId: 0xdf00,
      label: 'Alphasmart Dana',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* HANDSPRING (vendor 0x082d) */
    {
      vendorId: 0x082d,
      productId: 0x0100,
      label: 'Visor, Treo 300',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.SERIAL,
    },

    {
      vendorId: 0x082d,
      productId: 0x0200,
      label: 'Treo',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x082d,
      productId: 0x0300,
      label: 'Treo 600',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* PalmOne, Palm Inc */
    {
      vendorId: 0x0830,
      productId: 0x0001,
      label: 'm500',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0002,
      label: 'm505',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0003,
      label: 'm515',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0010,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0011,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0020,
      label: 'i705',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0030,
      label: 'Tungsten|Z',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0031,
      label: 'Tungsten|W',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0040,
      label: 'm125',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0050,
      label: 'm130',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0051,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0052,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0053,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0060,
      label: 'Tungsten series, Zire 71',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0061,
      label: 'Zire 31, 72, Z22',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0062,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0063,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0070,
      label: 'Zire',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0071,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0080,
      label: 'm100',
      initType: UsbInitType.NONE,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0099,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
    {
      vendorId: 0x0830,
      productId: 0x0100,
      label: 'UNKNOWN',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* GARMIN */
    {
      vendorId: 0x091e,
      productId: 0x0004,
      label: 'IQUE 3600',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* Kyocera */
    {
      vendorId: 0x0c88,
      productId: 0x0021,
      label: '7135 Smartphone',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    {
      vendorId: 0x0c88,
      productId: 0xa226,
      label: '6035 Smartphone',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* Tapwave */
    {
      vendorId: 0x12ef,
      productId: 0x0100,
      label: 'Zodiac, Zodiac2',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* ACEECA */
    {
      vendorId: 0x4766,
      productId: 0x0001,
      label: 'MEZ1000',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },

    /* Samsung */
    {
      vendorId: 0x04e8,
      productId: 0x8001,
      label: 'i330',
      initType: UsbInitType.GENERIC,
      protocolStackType: UsbProtocolStackType.NET_SYNC,
    },
  ].map((obj) => ({...obj, usbId: toUsbId(obj)}))
);

/** USB_CONFIGS indexed by `${vendorId}:${productId}`. */
export const USB_DEVICE_CONFIGS_BY_ID = Object.fromEntries(
  USB_DEVICE_CONFIGS.map((config) => [config.usbId, config])
);

/** Convert a {vendorId, productId} tuple to string. */
export function toUsbId(
  t:
    | {vendorId: number; productId: number}
    | {idVendor: number; idProduct: number}
) {
  const vendorId =
    'vendorId' in t ? t.vendorId : 'idVendor' in t ? t.idVendor : 0;
  const productId =
    'productId' in t ? t.productId : 'idProduct' in t ? t.idProduct : 0;
  return (
    vendorId.toString(16).padStart(4, '0') +
    ':' +
    productId.toString(16).padStart(4, '0')
  );
}
