import _ from 'lodash';

/** Specification for the fields in a bitmask. */
export type BitmaskFieldSpecMap<T> = {
  [K in keyof T]?: {
    bitmask: number;
    valueType: 'boolean' | 'number';
  };
};

/** Utility function for parsing a bitmask value. */
export function parseFromBitmask<T extends Object>(
  t: T,
  rawValue: number,
  bitmaskFieldSpecMap: BitmaskFieldSpecMap<T>
) {
  Object.assign(
    t,
    _.mapValues(bitmaskFieldSpecMap, (fieldSpec) => {
      const {bitmask, valueType} = fieldSpec!;
      const rawFieldValue = rawValue & bitmask;
      return valueType === 'boolean' ? !!rawFieldValue : rawFieldValue;
    })
  );
}

/** Utility function for serializing fields into a bitmask value. */
export function serializeToBitmask<T extends Object>(
  t: T,
  bitmaskFieldSpecMap: BitmaskFieldSpecMap<T>
): number {
  let rawValue = 0;
  for (const [key, attrSpec] of Object.entries(bitmaskFieldSpecMap)) {
    const {bitmask, valueType} = attrSpec!;
    const fieldValue = t[key as keyof T];
    const fieldValueMask =
      valueType === 'boolean'
        ? fieldValue
          ? ~0
          : 0
        : ((fieldValue as any) as number);
    rawValue |= fieldValueMask & bitmask;
  }
  return rawValue;
}
