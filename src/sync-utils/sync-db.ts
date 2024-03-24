/** Two-way database synchronization.
 *
 * References:
 *   - Palm OS Programming, pp. 529-534: https://archive.org/details/palmosprogrammin0000rhod
 *   - Palm OS Programming Bible (2nd ed), pp. 739-741: https://archive.org/details/palmosprogrammin00fost
 *   - pilot-link's sync.c: https://github.com/jichu4n/pilot-link/blob/master/libpisync/sync.c
 *   - Coldsync's GenericConduit.cc: https://github.com/dwery/coldsync/blob/master/src/GenericConduit.cc
 *
 * @module
 */

import debug from 'debug';
import {RawPdbDatabase, RawPdbRecord} from 'palm-pdb';
import {
  DlpCleanUpDatabaseReqType,
  DlpCloseDBReqType,
  DlpDeleteRecordReqType,
  DlpOpenConduitReqType,
  DlpOpenDBMode,
  DlpOpenDBReqType,
  DlpReadNextModifiedRecReqType,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordByIDReqType,
  DlpReadRecordByIndexReqType,
  DlpResetSyncFlagsReqType,
} from '../protocols/dlp-commands';
import {DlpRespErrorCode} from '../protocols/dlp-protocol';
import {DlpConnection} from '../protocols/sync-connections';
import {createRawPdbRecordFromReadRecordResp} from './read-db';
import {createWriteRecordReqFromRawPdbRecord} from './write-db';

const log = debug('palm-sync').extend('sync-db');

/** State of a record. */
enum RecordState {
  /** No matching record in database. */
  NOT_FOUND = 'notFound',
  /** Record is archived and modified. */
  ARCHIVED_CHANGED = 'archivedChanged',
  /** Record is archived but unmodified. */
  ARCHIVED_UNCHANGED = 'archivedUnchanged',
  /** Record is deleted. */
  DELETED = 'deleted',
  /** Record has been modified. */
  CHANGED = 'changed',
  /** Record has not been modified. */
  UNCHANGED = 'unchanged',
}

/** Computes record state for a record. */
function computeRecordState(
  record: RawPdbRecord | null,
  slowSync: Boolean = false,
  otherRecord: RawPdbRecord | null = null
) {
  if (!record) {
    return RecordState.NOT_FOUND;
  }
  const {attributes} = record.entry;
  if (attributes.archive) {
    return attributes.dirty
      ? RecordState.ARCHIVED_CHANGED
      : RecordState.ARCHIVED_UNCHANGED;
  }
  if (attributes.delete) {
    return RecordState.DELETED;
  }

  if (slowSync && otherRecord != null) {
    /** This is a slowSync, thus we cannot trust the dirty flag and must compare it's content
     * byte by byte */
    return compareRec(record, otherRecord) != 0
      ? RecordState.CHANGED
      : RecordState.UNCHANGED;
  }

  return attributes.dirty ? RecordState.CHANGED : RecordState.UNCHANGED;
}

function compareRec(rec1: RawPdbRecord, rec2: RawPdbRecord) {
  /* Compare the category, since that's quick and easy */
  if (rec1.entry.attributes.category < rec2.entry.attributes.category) {
    log(
      `SS compare_rec: ${rec1.entry.uniqueId} < ${rec1.entry.uniqueId} (category)`
    );
    return -1;
  } else if (rec1.entry.attributes.category > rec2.entry.attributes.category) {
    log(
      `SS compare_rec: ${rec1.entry.uniqueId} > ${rec2.entry.uniqueId} (category)`
    );
    return 1;
  }

  /* Check if data is the same */
  const cmp = rec1.data.compare(rec2.data);
  if (cmp != 0) {
    log(`SS cmp: ${cmp}`);
    return cmp;
  }

  /* The two records are equal over the entire length of rec1 */
  if (rec1.data.byteLength < rec2.data.byteLength) {
    log(`SS compare_rec: ${rec1.entry.uniqueId} < ${rec2.entry.uniqueId}`);
    return -1;
  }

  log(`SS compare_rec: ${rec1.entry.uniqueId} == ${rec2.entry.uniqueId}`);
  return 0; /* Length is the same and data is the same */
}

/** Type of sync action to be performed on a record. */
enum RecordActionType {
  /** Add the provided record on the desktop.
   *
   *  If a record with the same ID already exists on the desktop, it will be overwritten.
   */
  ADD_ON_DESKTOP = 'addOnDesktop',
  /** Add the provided record on the Palm OS device.
   *
   * If a record with the same ID already exists on the device, it will be overwritten.
   */
  ADD_ON_DEVICE = 'addOnDevice',
  /** Add the provided record on the Palm OS device with a new record ID. No
   * existing records will be overwritten. */
  ADD_ON_DEVICE_WITH_NEW_ID = 'addOnDeviceWithNewId',
  /** Delete the provided record on the desktop. */
  DELETE_ON_DESKTOP = 'deleteOnDesktop',
  /** Delete the provided record on the Palm OS device. */
  DELETE_ON_DEVICE = 'deleteOnDevice',
  /** Add a record to the archive. */
  ARCHIVE = 'archive',
}

/** Sync action to be performed on a record. */
interface RecordAction {
  /** Type of sync action to perform. */
  type: RecordActionType;
  /** Record to perform the action on. */
  record: RawPdbRecord;
}

type RecordSyncFn = (
  deviceRecord: RawPdbRecord | null,
  desktopRecord: RawPdbRecord | null,
  deviceRecordState: RecordState,
  desktopRecordState: RecordState
) => Array<[RecordActionType, RawPdbRecord | null]>;

const unexpectedRecordState: RecordSyncFn = (
  deviceRecord,
  desktopRecord,
  deviceRecordState,
  desktopRecordState
) => {
  throw new Error(
    'Unexpected record state combination: ' +
      `device record is ${deviceRecordState}, ` +
      `desktop record is ${desktopRecordState}`
  );
};

const {
  ADD_ON_DESKTOP,
  ADD_ON_DEVICE,
  ADD_ON_DEVICE_WITH_NEW_ID,
  DELETE_ON_DESKTOP,
  DELETE_ON_DEVICE,
  ARCHIVE,
} = RecordActionType;

/** Sync logic based on state of device and desktop records.
 *
 * The structure is [deviceRecordState][desktopRecordState].
 */
const RECORD_SYNC_LOGIC: {
  [key in RecordState]: {
    [key in RecordState]: RecordSyncFn;
  };
} = {
  [RecordState.NOT_FOUND]: {
    // Record doesn't exist on device or desktop, so nothing to do.
    [RecordState.NOT_FOUND]: (deviceRecord, desktopRecord) => [],
    // Added then archived on desktop since last sync. Just archive on desktop;
    // no need to push to device.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, desktopRecord],
    ],
    // This shouldn't happen - if record archived but not modified on desktop,
    // it should have been preent on device during last sync.
    [RecordState.ARCHIVED_UNCHANGED]: unexpectedRecordState,
    // Added then deleted on desktop since last sync. Nothing to do.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [],
    // Added then modified on desktop since last sync, so push to device.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DEVICE, desktopRecord],
    ],
    // This should not happen - record was added on desektop but not marked as
    // dirty.
    [RecordState.UNCHANGED]: unexpectedRecordState,
  },
  [RecordState.ARCHIVED_CHANGED]: {
    // Created and archived on device since last sync. Just add to archive.
    [RecordState.NOT_FOUND]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
    ],
    // Modified then archived on both device and desktop. If identical,
    // add to archive. If different, add both to archive.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? [[ARCHIVE, deviceRecord]]
        : [
            [ARCHIVE, deviceRecord],
            [ARCHIVE, desktopRecord],
          ],
    // Ditto.
    [RecordState.ARCHIVED_UNCHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? [[ARCHIVE, deviceRecord]]
        : [
            [ARCHIVE, deviceRecord],
            [ARCHIVE, desktopRecord],
          ],
    // Modified then archived on device, but deleted on desktop. Just archive
    // the device record.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
    ],
    // Modified and archived on device, but modified on desktop.
    //   - If identical, add to archive and delete on desktop.
    //   - If different, don't archive either, but add desktop record to device
    //     and add device record to desktop.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? [
            [ARCHIVE, deviceRecord],
            [DELETE_ON_DESKTOP, desktopRecord],
          ]
        : [
            [ADD_ON_DEVICE_WITH_NEW_ID, deviceRecord],
            [ADD_ON_DEVICE, desktopRecord],
            [ADD_ON_DESKTOP, deviceRecord],
          ],
    // Modified and archived on device, but not modified on desktop. Add device
    // record to archive and delete on desktop.
    [RecordState.UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
      [DELETE_ON_DESKTOP, desktopRecord],
    ],
  },
  [RecordState.ARCHIVED_UNCHANGED]: {
    // This should not happen - if archived but not modified, the record should
    // have been present during the last sync.
    [RecordState.NOT_FOUND]: unexpectedRecordState,
    // Archived on device, but modified then archived on desktop. If identical,
    // add to archive. If different, add both to archive.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? [[ARCHIVE, deviceRecord]]
        : [
            [ARCHIVE, deviceRecord],
            [ARCHIVE, desktopRecord],
          ],
    // Archived unmodified on both device and dekstop. Should be identical so
    // only need to archive on copy.
    [RecordState.ARCHIVED_UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
    ],
    // Archived on device, but deleted on desktop. Just archive the device record.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
    ],
    // Archived but unmodified on device, but modified on desktop. Do not
    // archive but replace with desktop record.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DEVICE, desktopRecord],
    ],
    // Archived on device, but not modified on desktop. Add device record to
    // archive and delete on desktop.
    [RecordState.UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, deviceRecord],
      [DELETE_ON_DESKTOP, desktopRecord],
    ],
  },
  [RecordState.DELETED]: {
    // Created and deleted on device since last sync. Nothing to do.
    [RecordState.NOT_FOUND]: (deviceRecord, desktopRecord) => [],
    // Deleted on device, but modified then archived on desktop. Just archive
    // the desktop record.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, desktopRecord],
    ],
    // Ditto.
    [RecordState.ARCHIVED_UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, desktopRecord],
    ],
    // Deleted on both device and desktop. Nothing to do.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [],
    // Deleted on device, but modified on desktop. Do not delete but add desktop
    // record to device.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DEVICE, desktopRecord],
    ],
    // Deleted on device, but not modified on desktop. Delete on desktop.
    [RecordState.UNCHANGED]: (deviceRecord, desktopRecord) => [
      [DELETE_ON_DESKTOP, desktopRecord],
    ],
  },
  [RecordState.CHANGED]: {
    // Created on device since last sync. Add to desktop.
    [RecordState.NOT_FOUND]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DESKTOP, deviceRecord],
    ],
    // Modified on device, but archived and also modified on desktop.
    //   - If identical, add to archive and delete on device.
    //   - If different, do not archive but add desktop record to device and add
    //     device record to desktop.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? [
            [ARCHIVE, desktopRecord],
            [DELETE_ON_DEVICE, deviceRecord],
          ]
        : [
            [ADD_ON_DEVICE_WITH_NEW_ID, desktopRecord],
            [ADD_ON_DESKTOP, desktopRecord],
            [ADD_ON_DESKTOP, deviceRecord],
          ],
    // Modified on device, but archived and unmodified on desktop. Do not
    // archive but replace with device record.
    [RecordState.ARCHIVED_UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DESKTOP, deviceRecord],
    ],
    // Modified on device, but deleted on desktop. Do not delete but replace
    // with device record.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DESKTOP, deviceRecord],
    ],
    // Modified on both device and desktop.
    //   - If identical, nothing to do.
    //   - If different, add device record to desktop and desktop record to device.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) =>
      deviceRecord?.data === desktopRecord?.data
        ? []
        : [
            [ADD_ON_DEVICE_WITH_NEW_ID, desktopRecord],
            [ADD_ON_DESKTOP, desktopRecord],
            [ADD_ON_DESKTOP, deviceRecord],
          ],
    // Modified on device, but not modified on desktop. Update desktop record.
    [RecordState.UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DESKTOP, deviceRecord],
    ],
  },
  [RecordState.UNCHANGED]: {
    // This should not be possible - if unchanged, the record should have been
    // present during the last sync.
    [RecordState.NOT_FOUND]: unexpectedRecordState,
    // Modified and archived on desktop, but not modified on device. Add desktop
    // record to archive and delete on device.
    [RecordState.ARCHIVED_CHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, desktopRecord],
      [DELETE_ON_DEVICE, deviceRecord],
    ],
    // Archived and unmodified on desktop, but not modified on device. Add
    // desktop record to archive and delete on device.
    [RecordState.ARCHIVED_UNCHANGED]: (deviceRecord, desktopRecord) => [
      [ARCHIVE, desktopRecord],
      [DELETE_ON_DEVICE, deviceRecord],
    ],
    // Deleted on desktop, but not modified on device. Delete on device.
    [RecordState.DELETED]: (deviceRecord, desktopRecord) => [
      [DELETE_ON_DEVICE, deviceRecord],
    ],
    // Modified on desktop, but not modified on device. Update device record.
    [RecordState.CHANGED]: (deviceRecord, desktopRecord) => [
      [ADD_ON_DEVICE, desktopRecord],
    ],
    // Unmodified on both device and desktop. Nothing to do.
    [RecordState.UNCHANGED]: (deviceRecord, desktopRecord) => [],
  },
};

export function computeRecordActions(
  deviceRecord: RawPdbRecord | null,
  desktopRecord: RawPdbRecord | null,
  slowSync: Boolean = false
): Array<RecordAction> {
  const deviceRecordState = computeRecordState(
    deviceRecord,
    slowSync,
    desktopRecord
  );
  const desktopRecordState = computeRecordState(
    desktopRecord,
    slowSync,
    deviceRecord
  );
  log(`${deviceRecordState} <> ${desktopRecordState}`);
  const actionTuples = RECORD_SYNC_LOGIC[deviceRecordState][desktopRecordState](
    deviceRecord,
    desktopRecord,
    deviceRecordState,
    desktopRecordState
  );
  const actions = actionTuples.map(([type, record]) => {
    if (!record) {
      throw new Error('Unexpected null record');
    }
    return {type, record};
  });
  const deviceRecordString = `${
    deviceRecord ? deviceRecord.entry.uniqueId : 'null'
  } ${deviceRecordState}`;
  const desktopRecordString = `${
    desktopRecord ? desktopRecord.entry.uniqueId : 'null'
  } ${desktopRecordState}`;
  const actionsString =
    actions.length === 0
      ? '[]'
      : '[\n' +
        actions
          .map(({type, record}) => `    ${type} ${record.entry.uniqueId},`)
          .join('\n') +
        '\n]';
  log(`${deviceRecordString} <> ${desktopRecordString} => ${actionsString}`);
  return actions;
}

export interface RecordActionContext {
  device: DbSyncInterface;
  desktop: DbSyncInterface;
  archiveDb: RawPdbDatabase;
}

type RecordActionFn = (
  ctx: RecordActionContext,
  record: RawPdbRecord
) => Promise<void>;
export const RECORD_ACTION_FNS: {[key in RecordActionType]: RecordActionFn} = {
  [ADD_ON_DEVICE]: async ({device}, record) => {
    clearRecordAttrs(record);
    const newRecordId = await device.writeRecord(record);
    if (newRecordId !== record.entry.uniqueId) {
      throw new Error(
        `Error writing record ${record.entry.uniqueId}: ` +
          `device returned record ID ${newRecordId}`
      );
    }
  },
  [ADD_ON_DEVICE_WITH_NEW_ID]: async ({device}, record) => {
    clearRecordAttrs(record);
    record.entry.uniqueId = 0;
    const newRecordId = await device.writeRecord(record);
    if (newRecordId === 0) {
      throw new Error(
        'Error writing record with new ID: device returned record ID 0'
      );
    }
    record.entry.uniqueId = newRecordId;
  },
  [ADD_ON_DESKTOP]: async ({desktop}, record) => {
    clearRecordAttrs(record);
    await desktop.writeRecord(record);
  },
  [DELETE_ON_DEVICE]: async ({device}, record) => {
    await device.deleteRecord(record.entry.uniqueId);
  },
  [DELETE_ON_DESKTOP]: async ({desktop}, record) => {
    await desktop.deleteRecord(record.entry.uniqueId);
  },
  [ARCHIVE]: async ({archiveDb}, record) => {
    if (!record.entry.attributes.archive) {
      throw new Error(
        `Attempting to archive non-archived record ${record.entry.uniqueId}`
      );
    }
    archiveDb.records.push(record);
  },
};

/** Clear record attribute flags (except secret.) */
export function clearRecordAttrs(record: RawPdbRecord) {
  const {attributes: attrs} = record.entry;
  if (attrs.archive) {
    attrs.archive = false;
  }
  attrs.delete = false;
  attrs.dirty = false;
  attrs.busy = false;
}

/** Abstract interface for reading / writing for sync. */
interface DbSyncInterface {
  /** Return all modified records. */
  readModifiedRecords(): Promise<Array<RawPdbRecord>>;
  /** Return all records */
  readAllRecords(): Promise<Array<RawPdbRecord>>;
  /** Write a record. */
  writeRecord(record: RawPdbRecord): Promise<number>;
  /** Read a record by ID. */
  readRecord(recordId: number): Promise<RawPdbRecord | null>;
  /** Delete a record by ID. */
  deleteRecord(recordId: number): Promise<void>;
  /** Clean up. Removes deleted records and resets dirty flags. */
  cleanUp(): Promise<void>;
}

/** Sync interface backed by a RawPdbDatabase. */
class RawPdbDatabaseSyncInterface implements DbSyncInterface {
  constructor(private readonly db: RawPdbDatabase) {}

  private findRecordIndex(recordId: number): number {
    return this.db.records.findIndex(
      ({entry: {uniqueId}}) => uniqueId === recordId
    );
  }

  async readModifiedRecords(): Promise<Array<RawPdbRecord>> {
    return this.db.records
      .filter((record) => computeRecordState(record) !== RecordState.UNCHANGED)
      .map(cloneRecord);
  }

  async readAllRecords(): Promise<Array<RawPdbRecord>> {
    return this.db.records.map(cloneRecord);
  }

  async writeRecord(record: RawPdbRecord): Promise<number> {
    const newRecord = cloneRecord(record);
    if (record.entry.uniqueId === 0) {
      do {
        newRecord.entry.uniqueId = Math.floor(
          1 + Math.random() * (0xffffffff - 1)
        );
      } while (this.findRecordIndex(newRecord.entry.uniqueId) >= 0);
      this.db.records.push(newRecord);
    } else {
      const existingRecordIndex = this.findRecordIndex(record.entry.uniqueId);
      if (existingRecordIndex >= 0) {
        this.db.records[existingRecordIndex] = newRecord;
      } else {
        this.db.records.push(newRecord);
      }
    }
    return newRecord.entry.uniqueId;
  }

  async readRecord(recordId: number): Promise<RawPdbRecord | null> {
    const recordIndex = this.findRecordIndex(recordId);
    return recordIndex >= 0 ? cloneRecord(this.db.records[recordIndex]) : null;
  }

  async deleteRecord(recordId: number): Promise<void> {
    const existingRecordIndex = this.findRecordIndex(recordId);
    if (existingRecordIndex >= 0) {
      this.db.records.splice(existingRecordIndex, 1);
    } else {
      throw new Error(`Attempting to delete non-existent record ${recordId}`);
    }
  }

  async cleanUp(): Promise<void> {
    const records: Array<RawPdbRecord> = [];
    for (const record of this.db.records) {
      const {attributes} = record.entry;
      if (attributes.delete || attributes.archive) {
        continue;
      }
      attributes.dirty = false;
      attributes.busy = false;
      records.push(record);
    }
    this.db.records.splice(0, this.db.records.length, ...records);
  }
}

/** Sync interface for actual Palm OS devices. */
class DeviceSyncInterface implements DbSyncInterface {
  constructor(
    private readonly dlpConnection: DlpConnection,
    private readonly dbId: number
  ) {}

  async readModifiedRecords(): Promise<Array<RawPdbRecord>> {
    const records: Array<RawPdbRecord> = [];
    for (;;) {
      const readRecordResp = await this.dlpConnection.execute(
        DlpReadNextModifiedRecReqType.with({dbId: this.dbId}),
        {ignoreErrorCode: DlpRespErrorCode.NOT_FOUND}
      );
      if (readRecordResp.errorCode === DlpRespErrorCode.NOT_FOUND) {
        break;
      }
      records.push(createRawPdbRecordFromReadRecordResp(readRecordResp));
    }
    return records;
  }

  async readAllRecords(): Promise<Array<RawPdbRecord>> {
    const records: Array<RawPdbRecord> = [];

    const numRecords = (
      await this.dlpConnection.execute(
        DlpReadOpenDBInfoReqType.with({dbId: this.dbId})
      )
    ).numRec;

    for (let i = 0; i < numRecords; ++i) {
      const readRecordResp = await this.dlpConnection.execute(
        DlpReadRecordByIndexReqType.with({dbId: this.dbId, index: i})
      );

      records.push(createRawPdbRecordFromReadRecordResp(readRecordResp));
    }

    return records;
  }

  async writeRecord(record: RawPdbRecord): Promise<number> {
    const {recordId: newRecordId} = await this.dlpConnection.execute(
      createWriteRecordReqFromRawPdbRecord(this.dbId, record)
    );
    return newRecordId;
  }

  async readRecord(recordId: number): Promise<RawPdbRecord | null> {
    if (!recordId) {
      return null;
    }
    const readRecordResp = await this.dlpConnection.execute(
      DlpReadRecordByIDReqType.with({
        dbId: this.dbId,
        recordId,
      }),
      {ignoreErrorCode: DlpRespErrorCode.NOT_FOUND}
    );
    return readRecordResp.errorCode === DlpRespErrorCode.NONE
      ? createRawPdbRecordFromReadRecordResp(readRecordResp)
      : null;
  }

  async deleteRecord(recordId: number): Promise<void> {
    await this.dlpConnection.execute(
      DlpDeleteRecordReqType.with({dbId: this.dbId, recordId})
    );
  }

  async cleanUp(): Promise<void> {
    await this.dlpConnection.execute(
      DlpCleanUpDatabaseReqType.with({dbId: this.dbId})
    );
    await this.dlpConnection.execute(
      DlpResetSyncFlagsReqType.with({dbId: this.dbId})
    );
  }
}

function cloneRecord(record: RawPdbRecord): RawPdbRecord {
  const newRecord = RawPdbRecord.from(record.serialize());
  newRecord.entry.deserialize(record.entry.serialize());
  return newRecord;
}

/** Options for {@link syncRawDb}. */
export interface SyncDbOptions {
  /** Card number on the Palm OS device (typically 0). */
  cardNo?: number;
}

/** Perform a fast sync for a database. */
export async function fastSync(
  device: DbSyncInterface,
  desktop: DbSyncInterface
) {
  const recordIdsModifiedOnDevice = new Set<number>();
  const recordActions: Array<RecordAction> = [];

  // 1. Sync records modified on device.
  for (const deviceRecord of await device.readModifiedRecords()) {
    const {uniqueId: recordId} = deviceRecord.entry;
    const desktopRecord = await desktop.readRecord(recordId);
    recordActions.push(...computeRecordActions(deviceRecord, desktopRecord));
    recordIdsModifiedOnDevice.add(recordId);
  }

  // 2. Sync records modified on the desktop.
  for (const desktopRecord of await desktop.readModifiedRecords()) {
    const {uniqueId: recordId} = desktopRecord.entry;
    if (recordId !== 0 && recordIdsModifiedOnDevice.has(recordId)) {
      continue;
    }
    const deviceRecord =
      desktopRecord.entry.uniqueId === 0
        ? null
        : await device.readRecord(recordId);
    recordActions.push(...computeRecordActions(deviceRecord, desktopRecord));
  }

  // 3. Execute record actions.
  const ctx: RecordActionContext = {
    device,
    desktop,
    archiveDb: new RawPdbDatabase(),
  };
  log(`Executing ${recordActions.length} record actions`);
  for (const {type, record} of recordActions) {
    log(`    ${type} ${record.entry.uniqueId} (${record.data.length})`);
    await RECORD_ACTION_FNS[type](ctx, record);
  }

  log('Cleaning up database');
  await device.cleanUp();
  await desktop.cleanUp();
}

/** Perform a slow sync for a database. */
export async function slowSync(
  device: DbSyncInterface,
  desktop: DbSyncInterface
) {
  const recordIdsModifiedOnDevice = new Set<number>();
  const recordActions: Array<RecordAction> = [];

  // 1. Sync records modified on device.
  for (const deviceRecord of await device.readAllRecords()) {
    const {uniqueId: recordId} = deviceRecord.entry;
    const desktopRecord = await desktop.readRecord(recordId);
    recordActions.push(
      ...computeRecordActions(deviceRecord, desktopRecord, true)
    );
    recordIdsModifiedOnDevice.add(recordId);
  }

  // 2. Sync records modified on the desktop.
  for (const desktopRecord of await desktop.readAllRecords()) {
    const {uniqueId: recordId} = desktopRecord.entry;
    if (recordId !== 0 && recordIdsModifiedOnDevice.has(recordId)) {
      continue;
    }
    const deviceRecord =
      desktopRecord.entry.uniqueId === 0
        ? null
        : await device.readRecord(recordId);

    if (deviceRecord == null) {
      log('No device record! Skipping...');
      continue;
    }

    recordActions.push(
      ...computeRecordActions(deviceRecord, desktopRecord, true)
    );
  }

  // 3. Execute record actions.
  const ctx: RecordActionContext = {
    device,
    desktop,
    archiveDb: new RawPdbDatabase(),
  };
  log(`Executing ${recordActions.length} record actions`);
  for (const {type, record} of recordActions) {
    log(`    ${type} ${record.entry.uniqueId} (${record.data.length})`);
    await RECORD_ACTION_FNS[type](ctx, record);
  }

  log('Cleaning up database');
  await device.cleanUp();
  await desktop.cleanUp();
}

/** Perform a fast sync for a database. */
export async function fastSyncDb(
  dlpConnection: DlpConnection,
  desktopDb: RawPdbDatabase,
  {cardNo = 0}: SyncDbOptions = {},
  openConduit: Boolean = true
) {
  log(`Fast sync database ${desktopDb.header.name} on card ${cardNo}`);
  if (openConduit) await dlpConnection.execute(DlpOpenConduitReqType.with({}));

  const {dbId} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      cardNo,
      name: desktopDb.header.name,
      mode: DlpOpenDBMode.with({read: true, write: true, secret: true}),
    })
  );

  await fastSync(
    new DeviceSyncInterface(dlpConnection, dbId),
    new RawPdbDatabaseSyncInterface(desktopDb)
  );

  log('Closing database');
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
  log('DB Closed');
}

/** Perform a slow sync for a database. */
export async function slowSyncDb(
  dlpConnection: DlpConnection,
  desktopDb: RawPdbDatabase,
  {cardNo = 0}: SyncDbOptions = {},
  openConduit: Boolean = true
) {
  log(`Slow sync database ${desktopDb.header.name} on card ${cardNo}`);
  if (openConduit) await dlpConnection.execute(DlpOpenConduitReqType.with({}));

  const {dbId} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      cardNo,
      name: desktopDb.header.name,
      mode: DlpOpenDBMode.with({read: true, write: true, secret: true}),
    })
  );

  await slowSync(
    new DeviceSyncInterface(dlpConnection, dbId),
    new RawPdbDatabaseSyncInterface(desktopDb)
  );

  log('Closing database');
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
  log('DB Closed');
}

export async function cleanUpDb(rawDb: RawPdbDatabase) {
  log(`Cleaning up database [${rawDb.header.name}]`);
  await new RawPdbDatabaseSyncInterface(rawDb).cleanUp();
}
