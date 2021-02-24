import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import Serializable, {SerializableBuffer} from './serializable';

/** Information about a category. */
export interface CategoryInfo {
  /** Name of the category (max 15 bytes). */
  label: string;
  /** ID of the category (1 byte long).
   *
   * Unique IDs generated by the device are between 0 and 127. Unique IDs
   * generated by the desktop computer are between 128 and 255.
   */
  uniqId: number;
  /** Whether this category has been renamed.
   *
   * Usually cleared by a conduit.
   */
  isRenamed: boolean;
}

/** Length of standard category data. */
export const APP_INFO_CATEGORY_DATA_LENGTH = 276;

/** AppInfo block for standard category data.
 *
 * If data is non-null, it will be used to serialize / deserialize extra data in
 * the AppInfo block following standard category data.
 */
export class AppInfoType<T extends Serializable = SerializableBuffer>
  implements Serializable {
  /** Array of category information (max 16 elements). */
  categories: Array<CategoryInfo> = [];
  /** The last unique category ID assigned. */
  lastUniqId: number = 0;
  /** Extra data in the AppInfo block following standard category data.
   *
   * If null, application-specific data will not be serialized / deserialized.
   */
  data: T | null = null;

  /** Finds the category with the given unique ID. */
  getCategoryByUniqId(uniqId: number): CategoryInfo | null {
    return _.find(this.categories, ['categoryUniqId', uniqId]) ?? null;
  }

  /** Finds the category with the given label. */
  getCategoryByLabel(label: string): CategoryInfo | null {
    return _.find(this.categories, ['categoryLabel', label]) ?? null;
  }

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'latin1');
    const renamedCategories = reader.readUInt16BE();
    const categoryLabels: Array<string> = [];
    for (let i = 0; i < 16; ++i) {
      const initialReadOffset = reader.readOffset;
      categoryLabels.push(reader.readStringNT());
      reader.readOffset = initialReadOffset + 16;
    }
    const categoryUniqIds = [];
    for (let i = 0; i < 16; ++i) {
      categoryUniqIds.push(reader.readUInt8());
    }
    this.lastUniqId = reader.readUInt8();

    reader.readUInt8(0); // Padding byte.

    // Denormalize from {renamedCategories, categoryLabels, categoryUniqIds}.
    this.categories.length = 0;
    for (let i = 0; i < 16; ++i) {
      if (!categoryLabels[i]) {
        break;
      }
      this.categories.push({
        label: categoryLabels[i],
        uniqId: categoryUniqIds[i],
        isRenamed: !!(renamedCategories & (1 << i)),
      });
    }

    if (this.data) {
      this.data.parseFrom(reader.readBuffer());
    }

    return reader.readOffset;
  }

  serialize(): Buffer {
    const writer = SmartBuffer.fromOptions({encoding: 'latin1'});

    let renamedCategories = 0;
    for (let i = 0; i < this.categories.length; ++i) {
      if (this.categories[i].isRenamed) {
        renamedCategories |= 1 << i;
      }
    }
    writer.writeUInt16BE(renamedCategories);

    let offset = writer.writeOffset;
    for (const {label: categoryLabel} of this.categories) {
      if (categoryLabel.length > 15) {
        throw new Error(`Category label length exceeds 15: "${categoryLabel}"`);
      }
      writer.writeStringNT(categoryLabel, offset);
      offset += 16;
    }
    for (let i = this.categories.length; i < 16; ++i) {
      writer.writeUInt8(0, offset);
      offset += 16;
    }

    for (const {uniqId: categoryUniqId} of this.categories) {
      if (categoryUniqId < 0 || categoryUniqId > 255) {
        throw new Error(`Invalid category unique ID: ${categoryUniqId}`);
      }
      writer.writeUInt8(categoryUniqId, offset++);
    }
    for (let i = this.categories.length; i < 16; ++i) {
      writer.writeUInt8(0, offset++);
    }

    writer.writeUInt8(this.lastUniqId);

    writer.writeUInt8(0); // Padding byte.

    if (this.data) {
      writer.writeBuffer(this.data.serialize());
    }

    return writer.toBuffer();
  }

  get serializedLength() {
    return (
      APP_INFO_CATEGORY_DATA_LENGTH +
      (this.data ? this.data.serializedLength : 0)
    );
  }
}
