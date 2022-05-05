/** USB configuration info for a Palm OS device. */
export interface UsbConfig {
  /** The device's USB vendor ID. */
  vendorId: number;
  /** The device's USB product ID. */
  productId: number;
  /** Label for this type of device. */
  label: string;
  /** Device-specific initialization routine required. */
  initType?: UsbInitType;
}

/** Device-specific initialization routines. */
export enum UsbInitType {
  NONE = 'none',
  VISOR = 'visor',
  SONY_CLIE = 'sonyClie',
  TAPWAVE = 'tapwave',
}

/** USB hardware configuration info for all known Palm OS devices.
 *
 * Information is based on pilot-link, and has not been comprehensively
 * tested.
 */
export const USB_CONFIGS: ReadonlyArray<UsbConfig> = Object.freeze([
  /* Sony */
  {
    vendorId: 0x054c,
    productId: 0x0038,
    label: 'Sony S S320 and other Palm OS 3.5 devices',
    initType: UsbInitType.SONY_CLIE,
  },

  {
    vendorId: 0x054c,
    productId: 0x0066,
    label: 'Sony T, SJ series, and other Palm OS 4.0 devices',
  },

  {
    vendorId: 0x054c,
    productId: 0x0095,
    label: 'Sony S360',
  },

  {
    vendorId: 0x054c,
    productId: 0x000a,
    label: 'Sony NR and other Palm OS 4.1 devices',
  },

  {
    vendorId: 0x054c,
    productId: 0x009a,
    label: 'Sony NR70V/U',
    initType: UsbInitType.SONY_CLIE,
  },

  {
    vendorId: 0x054c,
    productId: 0x00da,
    label: 'Sony NX',
  },

  {
    vendorId: 0x054c,
    productId: 0x00e9,
    label: 'Sony NZ',
  },

  {
    vendorId: 0x054c,
    productId: 0x0144,
    label: 'Sony UX',
  },

  {
    vendorId: 0x054c,
    productId: 0x0169,
    label: 'Sony TJ',
    initType: UsbInitType.SONY_CLIE,
  },

  /* AlphaSmart */
  {
    vendorId: 0x081e,
    productId: 0xdf00,
    label: 'Alphasmart Dana',
  },

  /* HANDSPRING (vendor 0x082d) */
  {
    vendorId: 0x082d,
    productId: 0x0100,
    label: 'Visor, Treo 300',
    initType: UsbInitType.VISOR,
  },

  {
    vendorId: 0x082d,
    productId: 0x0200,
    label: 'Treo',
  },

  {
    vendorId: 0x082d,
    productId: 0x0300,
    label: 'Treo 600',
  },

  /* PalmOne, Palm Inc */
  {
    vendorId: 0x0830,
    productId: 0x0001,
    label: 'm500',
  },

  {
    vendorId: 0x0830,
    productId: 0x0002,
    label: 'm505',
  },

  {
    vendorId: 0x0830,
    productId: 0x0003,
    label: 'm515',
  },

  {
    vendorId: 0x0830,
    productId: 0x0010,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0011,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0020,
    label: 'i705',
  },

  {
    vendorId: 0x0830,
    productId: 0x0030,
    label: 'Tungsten|Z',
  },

  {
    vendorId: 0x0830,
    productId: 0x0031,
    label: 'Tungsten|W',
  },

  {
    vendorId: 0x0830,
    productId: 0x0040,
    label: 'm125',
  },

  {
    vendorId: 0x0830,
    productId: 0x0050,
    label: 'm130',
  },

  {
    vendorId: 0x0830,
    productId: 0x0051,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0052,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0053,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0060,
    label: 'Tungsten series, Zire 71',
  },
  {
    vendorId: 0x0830,
    productId: 0x0061,
    label: 'Zire 31, 72, Z22',
    initType: UsbInitType.TAPWAVE,
  },

  {
    vendorId: 0x0830,
    productId: 0x0062,
    label: 'UNKNOWN',
  },
  {
    vendorId: 0x0830,
    productId: 0x0063,
    label: 'UNKNOWN',
  },
  {
    vendorId: 0x0830,
    productId: 0x0070,
    label: 'Zire',
  },

  {
    vendorId: 0x0830,
    productId: 0x0071,
    label: 'UNKNOWN',
  },
  {
    vendorId: 0x0830,
    productId: 0x0080,
    label: 'm100',
    initType: UsbInitType.NONE,
  },

  {
    vendorId: 0x0830,
    productId: 0x0099,
    label: 'UNKNOWN',
  },

  {
    vendorId: 0x0830,
    productId: 0x0100,
    label: 'UNKNOWN',
  },

  /* GARMIN */
  {
    vendorId: 0x091e,
    productId: 0x0004,
    label: 'IQUE 3600',
  },

  /* Kyocera */
  {
    vendorId: 0x0c88,
    productId: 0x0021,
    label: '7135 Smartphone',
  },

  {
    vendorId: 0x0c88,
    productId: 0xa226,
    label: '6035 Smartphone',
  },

  /* Tapwave */
  {
    vendorId: 0x12ef,
    productId: 0x0100,
    label: 'Zodiac, Zodiac2',
    initType: UsbInitType.TAPWAVE,
  },

  /* ACEECA */
  {
    vendorId: 0x4766,
    productId: 0x0001,
    label: 'MEZ1000',
  },

  /* Samsung */
  {
    vendorId: 0x04e8,
    productId: 0x8001,
    label: 'i330',
  },
]);
