import fs from 'fs-extra';
import * as path from 'path';
import os from 'os';
import crypto from 'crypto';
import debug from 'debug';
import {DatabaseStorageInterface} from './database-storage-interface';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';
import {DatabaseHdrType, RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';

const log = debug('palm-sync').extend('node-db-stg');
export const READ_WRITE_TO_BASE_DIR_DIRECTLY = true;

export class NodeDatabaseStorage implements DatabaseStorageInterface {
  baseDir?: string;
  readWriteToBasedir: boolean;

  constructor(baseDir?: string, readWriteToBasedir: boolean = false) {
    this.baseDir = baseDir;
    this.readWriteToBasedir = readWriteToBasedir;

    if (readWriteToBasedir) {
      if (!baseDir) {
        throw new Error('set to readWriteToBasedir, but basedir it is null!');
      }

      fs.ensureDirSync(baseDir);
    }
  }

  getComputerId(): number {
    const hostname = os.hostname();
    const cpus = os
      .cpus()
      .map((cpu) => cpu.model)
      .join(';');
    const totalMemory = os.totalmem();

    const combinedInfo = `${hostname}:${cpus}:${totalMemory}`;

    const hash = crypto.createHash('sha256').update(combinedInfo).digest('hex');
    const truncatedHash = parseInt(hash.substring(0, 8), 16) >>> 0; // Truncate to 32 bits

    log(
      `This computer ID is [0x${truncatedHash}] parsed from [${combinedInfo}]`
    );

    return truncatedHash;
  }

  async createUser(requestedUserName: string): Promise<void> {
    await fs.ensureDir(this.getBackupPath(requestedUserName));
    await fs.ensureDir(this.getInstallPath(requestedUserName));
  }

  async userExists(requestedUserName: string): Promise<boolean> {
    const userDir = this.getBackupPath(requestedUserName);
    return await fs.pathExists(userDir);
  }

  async writeDatabase(
    requestedUserName: string,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void> {
    const filePath = this.readWriteToBasedir
      ? path.join(this.baseDir as string, this.getDbFullName(db))
      : this.getBackupPathForDatabase(
          requestedUserName,
          this.getDbFullName(db)
        );

    await fs.ensureFile(filePath);
    await fs.writeFile(filePath, db.serialize());
  }

  async readDatabase(
    requestedUserName: string,
    dbName: string
  ): Promise<RawPdbDatabase | RawPrcDatabase> {
    let filePath: string | undefined;

    if (this.readWriteToBasedir) {
      filePath = path.join(this.baseDir as string, dbName);
    } else {
      filePath = this.getBackupPathForDatabase(requestedUserName, dbName);
      const backupFileExists = await fs.pathExists(filePath);

      if (!backupFileExists) {
        filePath = this.getInstallPathForDatabase(requestedUserName, dbName);
        const installFileExists = await fs.pathExists(filePath);

        if (!installFileExists) {
          throw new Error(
            `Database file [${dbName}] does not exist in the backup nor in the install dir.`
          );
        }
      }
    }

    const fileBuffer = await fs.readFile(filePath);
    const header = DatabaseHdrType.from(fileBuffer);
    return header.attributes.resDB
      ? RawPrcDatabase.from(fileBuffer)
      : RawPdbDatabase.from(fileBuffer);
  }

  async databaseExists(
    requestedUserName: string,
    dbName: string
  ): Promise<boolean> {
    const filePath = this.getBackupPathForDatabase(requestedUserName, dbName);
    return await fs.pathExists(filePath);
  }

  async getAllDatabases(
    requestedUserName: string
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>> {
    const userDir = this.getBackupPath(requestedUserName);
    const dbFiles = await fs.readdir(userDir);

    const databases: Array<RawPdbDatabase | RawPrcDatabase> = [];

    for (const dbFile of dbFiles) {
      const db = await this.readDatabase(requestedUserName, dbFile);
      databases.push(db);
    }

    return databases;
  }

  async getDatabasesFromInstallList(requestedUserName: string): Promise<{
    databases: Array<RawPdbDatabase | RawPrcDatabase>;
    filenames: string[];
  }> {
    const installDir = this.getInstallPath(requestedUserName);
    const installFiles = await fs.readdir(installDir);

    const databases: Array<RawPdbDatabase | RawPrcDatabase> = [];
    const filenames: string[] = [];

    // Sort filenames alphabetically
    const sortedFiles = installFiles
      .filter((file) => file.endsWith('.prc') || file.endsWith('.pdb'))
      .sort();

    for (const dbFile of sortedFiles) {
      const db = await this.readDatabase(requestedUserName, dbFile);
      databases.push(db);
      filenames.push(dbFile);
    }

    return {databases, filenames};
  }

  async removeDatabaseFromInstallList(
    requestedUserName: string,
    db: RawPdbDatabase | RawPrcDatabase,
    filename: string
  ): Promise<void> {
    const installDir = this.getInstallPath(requestedUserName);
    const installFilePath = path.join(installDir, filename);

    const dbName = this.getDbFullName(db);
    const backupFilePath = this.getBackupPathForDatabase(
      requestedUserName,
      dbName
    );

    await fs.move(installFilePath, backupFilePath, {overwrite: true});
  }

  private getDbFullName(db: RawPdbDatabase | RawPrcDatabase): string {
    const ext = db.header.attributes.resDB ? 'prc' : 'pdb';
    return `${db.header.name}.${ext}`;
  }

  private getBackupPath(deviceId: string): string {
    return this.baseDir
      ? path.join(this.baseDir, deviceId, 'backup')
      : path.join(deviceId, 'backup');
  }

  private getBackupPathForDatabase(deviceId: string, dbName: string): string {
    return path.join(this.getBackupPath(deviceId), dbName);
  }

  private getInstallPath(deviceId: string): string {
    return this.baseDir
      ? path.join(this.baseDir, deviceId, 'install')
      : path.join(deviceId, 'install');
  }

  private getInstallPathForDatabase(deviceId: string, dbName: string): string {
    return path.join(this.getInstallPath(deviceId), dbName);
  }
}
