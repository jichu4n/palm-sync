import {RawPdbDatabase, RawPrcDatabase} from 'palm-pdb';
import {DlpReadUserInfoRespType} from '../protocols/dlp-commands';

export interface DatabaseStorageInterface {
  /**
   * Creates the file system structure to hold database data for the username provided, may also
   * create identification files regarding the specific PDA used.
   * @param requestedUserName the username of the PDA
   */
  createUsernameInStorage(requestedUserName: string): Promise<void>;
  /**
   * Returns `true` if the requestedUserName was used in the `createUsernameInStorage()` function
   *  in the past and may have data in this computer.
   * @param requestedUserName the username of the PDA
   */
  isUsernameKnownInStorage(requestedUserName: string): Promise<boolean>;
  /**
   * Writes the database in the filesystem for persistance for the supplied user.
   * @param userInfo the user which the database belongs to
   * @param db the database to be written
   */
  writeDatabaseToStorage(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase
  ): Promise<void>;
  /**
   * Read/retrieve a database from the filesystem which was previously written
   * using the `writeDatabaseToStorage()` or any other method for the supplied user.
   * @param userInfo the user which the database belongs to
   * @param dbName the name of the database to retrieve
   */
  readDatabaseFromStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<RawPdbDatabase | RawPrcDatabase>;
  /**
   * Returns `true` if there is a database in the filesystem which matches the
   * supplied database name for the supplied user.
   * @param userInfo the user which the database belongs to
   * @param dbName the name of the database to retrieve
   */
  databaseExistsInStorage(
    userInfo: DlpReadUserInfoRespType,
    dbName: string
  ): Promise<boolean>;
  /**
   * Returns an array of databases which were previously backed-up for the
   * supplied user.
   * @param userInfo the user which the database belongs to
   */
  getAllDatabasesFromStorage(
    userInfo: DlpReadUserInfoRespType
  ): Promise<Array<RawPdbDatabase | RawPrcDatabase>>;
  /**
   * Returns an array of databases which should be installed in the PDA for the
   * supplied user.
   * @param userInfo the user which the database belongs to
   */
  getDatabasesFromInstallList(userInfo: DlpReadUserInfoRespType): Promise<{
    databases: Array<RawPdbDatabase | RawPrcDatabase>;
    filenames: string[];
  }>;
  /**
   * Removes the provided database from the install list for that user, should be called after
   * installation of said database is done.
   *
   * @param userInfo the user which the database belongs to
   * @param db the database to be removed
   * @param filename the precise filename of the database archive
   */
  removeDatabaseFromInstallList(
    userInfo: DlpReadUserInfoRespType,
    db: RawPdbDatabase | RawPrcDatabase,
    filename: string
  ): Promise<void>;
  /**
   * Generates/retrieves a UInt32 that will be stored in the PDA to
   * identify this computer.
   *
   * @returns A UInt32 that roughly uniquely identifies a computer
   */
  getComputerId(): number;
}