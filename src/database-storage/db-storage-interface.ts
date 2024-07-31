import {RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';

export interface DatabaseStorageInterface {
  writeDatabaseToStorage(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void>;
  readDatabaseFromStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string,
    dbPath?: string
  ): Promise<RawPdbDatabase | RawPrcDatabase>;
  databaseExistsInStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<boolean>;
  getAllDatabasesFromStorage(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>>;
  getDatabasesFromInstallList(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>>;
  removeDatabaseFromInstallList(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void>;
}
