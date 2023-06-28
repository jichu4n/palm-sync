import debug from 'debug';
import {DatabaseHdrType, RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';
import {Serializable, SerializeOptions} from 'serio';
import {
  DlpCloseDBReqType,
  DlpCreateDBReqType,
  DlpDeleteDBReqType,
  DlpResetSystemReqType,
  DlpWriteAppBlockReqType,
  DlpWriteRecordReqType,
  DlpWriteResourceReqType,
  DlpWriteSortBlockReqType,
} from '../protocols/dlp-commands';
import {DlpConnection, DlpRespErrorCode} from '../protocols/dlp-protocol';

const log = debug('palm-sync').extend('writeDb');

/** Options to {@link readDb} and {@link readRawDb}. */
export interface WriteDbOptions {
  /** Card number on the Palm OS device (typically 0). */
  cardNo?: number;
  /** Whether to overwrite an existing database.
   *
   * If false (the default), an error will be thrown if a database with the same
   * name already exists on the device.
   *
   * If true, an existing database on the device with the same name will be overwritten.
   */
  overwrite?: boolean;
}

/** Serialize and install a database to a Palm OS device. */
export async function writeDb<DatabaseT extends Serializable>(
  dlpConnection: DlpConnection,
  /** Database to write.
   *
   * This should typically be a subclass of Database from the palm-pdb package.
   * But we're keeping the signature generic here as that is not a hard
   * requirement.
   */
  db: DatabaseT,
  opts: WriteDbOptions & SerializeOptions = {}
): Promise<void> {
  const buffer = db.serialize(opts);
  const header = DatabaseHdrType.from(buffer);
  const rawDb = header.attributes.resDB
    ? RawPrcDatabase.from(buffer)
    : RawPdbDatabase.from(buffer);
  return await writeRawDb(dlpConnection, rawDb, opts);
}

/** Install a database to a Palm OS device.
 *
 * Based on:
 *   - pilot-link's pi_file_install() function:
 *     https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L784
 *   - coldsync's upload_database() function:
 *     https://github.com/dwery/coldsync/blob/master/src/install.c#L49
 */
export async function writeRawDb(
  dlpConnection: DlpConnection,
  /** Database to write. */
  db: RawPdbDatabase | RawPrcDatabase,
  {cardNo = 0, overwrite}: WriteDbOptions = {}
): Promise<void> {
  log(`Writing database ${db.header.name} to card ${cardNo}`);

  // TODO: pilot-link's pi_file_install() function checks the size of records,
  // and aborts if trying to install records exceeds 64k in size to an older
  // device (DLP version 1.4 / Palm OS 5.2 or later). We should do the same.

  // Whether to reset the device after install.
  let shouldReset =
    db.header.attributes.resetAfterInstall ||
    // All system updates have the creator 'ptch'
    db.header.creator === 'ptch';

  // 1. If we intend to overwrite, delete the database if it already exists.
  if (overwrite) {
    log(`Deleting existing database`);
    await dlpConnection.execute(
      DlpDeleteDBReqType.with({cardNo, name: db.header.name}),
      {ignoreErrorCode: DlpRespErrorCode.NOT_FOUND}
    );
  }

  // 2. Create the database.
  log(`Creating database`);
  const {dbId} = await dlpConnection.execute(
    DlpCreateDBReqType.with({
      creator: db.header.creator,
      type: db.header.type,
      cardNo,
      dbFlags: db.header.attributes,
      version: db.header.version,
      name: db.header.name,
    })
  );

  // 3. Write AppInfo block.
  if (db.appInfo && db.appInfo.getSerializedLength()) {
    log(`Writing AppInfo block`);
    await dlpConnection.execute(
      DlpWriteAppBlockReqType.with({dbId, data: db.appInfo.value})
    );
  }

  // 4. Write SortInfo block.
  if (db.sortInfo && db.sortInfo.getSerializedLength()) {
    log(`Writing SortInfo block`);
    await dlpConnection.execute(
      DlpWriteSortBlockReqType.with({dbId, data: db.sortInfo.value})
    );
  }

  // 5. Write records.
  if (db.header.attributes.resDB) {
    if (!(db instanceof RawPrcDatabase)) {
      throw new Error('Expected PRC database');
    }
    for (let i = 0; i < db.records.length; i++) {
      log(`Writing resource ${i + 1} of ${db.records.length}`);
      const record = db.records[i];
      await dlpConnection.execute(
        DlpWriteResourceReqType.with({
          dbId,
          type: record.entry.type,
          id: record.entry.resourceId,
          data: record.data,
        })
      );
      // If we see a 'boot' section, we should reset the system.
      if (record.entry.type === 'boot') {
        shouldReset = true;
      }
    }
  } else {
    if (!(db instanceof RawPdbDatabase)) {
      throw new Error('Expected PDB database');
    }
    for (let i = 0; i < db.records.length; i++) {
      log(`Writing record ${i + 1} of ${db.records.length}`);
      const record = db.records[i];
      await dlpConnection.execute(
        DlpWriteRecordReqType.with({
          dbId,
          recordId: record.entry.uniqueId,
          attributes: record.entry.attributes,
          data: record.data,
        })
      );
    }
  }

  // 6. Close the database.
  if (shouldReset) {
    log(`Resetting device`);
    await dlpConnection.execute(DlpResetSystemReqType.with());
  }
  log('Closing database');
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
}
