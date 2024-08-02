import {RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';

export interface DatabaseStorageInterface {
  createUsernameInStorage(requestedUserName: string): Promise<void>;
  isUsernameKnownInStorage(requestedUserName: string): Promise<boolean>;
  writeDatabaseToStorage(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void>;
  readDatabaseFromStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<RawPdbDatabase | RawPrcDatabase>;
  databaseExistsInStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<boolean>;
  getAllDatabasesFromStorage(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>>;
  getDatabasesFromInstallList(userInfo: DlpReadUserInfoRespType): Promise<{
    databases: Array<RawPdbDatabase | RawPrcDatabase>;
    filenames: string[];
  }>;
  removeDatabaseFromInstallList(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase,
    filename: string
  ): Promise<void>;
}
