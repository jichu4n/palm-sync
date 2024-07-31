import * as fsExtra from 'fs-extra';
import * as path from 'path';
import {DatabaseStorageInterface} from './db-storage-interface';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';
import {RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';

class NodeDatabaseManager implements DatabaseStorageInterface {
  writeDatabaseToStorage(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase,
    outputDir?: string
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  readDatabaseFromStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string,
    dbPath?: string
  ): Promise<RawPdbDatabase | RawPrcDatabase> {
    throw new Error('Method not implemented.');
  }
  databaseExistsInStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getAllDatabasesFromStorage(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>> {
    throw new Error('Method not implemented.');
  }
  getDatabasesFromInstallList(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>> {
    throw new Error('Method not implemented.');
  }
  removeDatabaseFromInstallList(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // private getPath(deviceId: string, dbName: string): string {
  //   return path.join(deviceId, dbName);
  // }

  // async saveDatabase(deviceId: string, dbName: string, data: Buffer): Promise<void> {
  //   const filePath = this.getPath(deviceId, dbName);
  //   await fsExtra.ensureFile(filePath);
  //   await fsExtra.writeFile(filePath, data);
  // }

  // async readDatabase(deviceId: string, dbName: string): Promise<Buffer> {
  //   const filePath = this.getPath(deviceId, dbName);
  //   return await fsExtra.readFile(filePath);
  // }

  // async databaseExists(deviceId: string, dbName: string): Promise<boolean> {
  //   const filePath = this.getPath(deviceId, dbName);
  //   return await fsExtra.pathExists(filePath);
  // }

  // async getFilesInDirectory(deviceId: string, dirName: string): Promise<AsyncIterableIterator<Dirent>> {
  //   const dirPath = this.getPath(deviceId, dirName);
  //   const dir = await fsExtra.opendir(dirPath);
  //   return dir[Symbol.asyncIterator]();
  // }

  // async moveDatabase(deviceId: string, srcDbName: string, destDbName: string): Promise<void> {
  //   const srcPath = this.getPath(deviceId, srcDbName);
  //   const destPath = this.getPath(deviceId, destDbName);
  //   await fsExtra.move(srcPath, destPath);
  // }

  // async deleteDatabase(deviceId: string, dbName: string): Promise<void> {
  //   const filePath = this.getPath(deviceId, dbName);
  //   await fsExtra.remove(filePath);
  // }
}
