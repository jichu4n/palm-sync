import fs from 'fs-extra';
import * as path from 'path';
import {DatabaseStorageInterface} from './db-storage-interface';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';
import {DatabaseHdrType, RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';

export class NodeDatabaseStorageImplementation
  implements DatabaseStorageInterface
{
  constructor(baseDir?: string) {
    this.baseDir = baseDir;
  }

  baseDir?: string;

  async writeDatabaseToStorage(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void> {
    const filePath = this.getBackupPath(userInfo.userName, this.getDbFullName(db));
    await fs.ensureFile(filePath);
    await fs.writeFile(filePath, db.serialize());
  }

  async readDatabaseFromStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<RawPdbDatabase | RawPrcDatabase> {
    const filePath = this.getBackupPath(userInfo.userName, dbName);
    const fileExists = await fs.pathExists(filePath);

    if (!fileExists) {
      throw new Error(`Database file ${dbName} does not exist.`);
    }

    const fileBuffer = await fs.readFile(filePath);
    const header = DatabaseHdrType.from(fileBuffer);
    return header.attributes.resDB
      ? RawPrcDatabase.from(fileBuffer)
      : RawPdbDatabase.from(fileBuffer);
  }

  async databaseExistsInStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<boolean> {
    const filePath = this.getBackupPath(userInfo.userName, dbName);
    return await fs.pathExists(filePath);
  }

  async getAllDatabasesFromStorage(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>> {
    const userDir = this.getBackupPath(userInfo.userName, '');
    const dbFiles = await fs.readdir(userDir);

    const databases: Array<RawPdbDatabase | RawPrcDatabase> = [];

    for (const dbFile of dbFiles) {
      const db = await this.readDatabaseFromStorage(userInfo, dbFile);
      databases.push(db);
    }

    return databases;
  }

  async getDatabasesFromInstallList(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>> {
    const installDir = this.getInstallPath(userInfo.userName);
    const installFiles = await fs.readdir(installDir);

    const databases: Array<RawPdbDatabase | RawPrcDatabase> = [];

    for (const dbFile of installFiles) {
      const db = await this.readDatabaseFromStorage(userInfo, dbFile);
      databases.push(db);
    }

    return databases;
  }

  async removeDatabaseFromInstallList(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void> {
    const installDir = this.getInstallPath(userInfo.userName);
    const dbName = this.getDbFullName(db);
    const filePath = path.join(installDir, dbName);

    const fileExists = await fs.pathExists(filePath);
    if (fileExists) {
      await fs.remove(filePath);
    }
  }

  private getDbFullName(db: RawPdbDatabase | RawPrcDatabase): string {
    const ext = db.header.attributes.resDB ? 'prc' : 'pdb';
    return `${db.header.name}.${ext}`;
  }

  private getBackupPath(deviceId: string, dbName: string): string {
    const backupDir = this.baseDir ? path.join(this.baseDir, deviceId, 'backup') : path.join(deviceId, 'backup');
    return path.join(backupDir, dbName);
  }

  private getInstallPath(deviceId: string): string {
    return this.baseDir ? path.join(this.baseDir, deviceId, 'install') : path.join(deviceId, 'install');
  }

}
