import {EventEmitter} from 'events';
import {
  DlpConnection,
  SyncConnection,
  SyncConnectionOptions,
} from '../protocols/sync-connections';

/** A function that implements HotSync business logic. */
export type SyncFn = (connection: DlpConnection) => Promise<void>;

/** Base class for HotSync servers.
 *
 * Emits the following events:
 *
 *   - connect ({@link SyncConnection}) - When new HotSync connection is established
 *   - disconnect ({@link SyncConnection}) - When HotSync connection is complete
 */
export abstract class SyncServer extends EventEmitter {
  constructor(
    /** HotSync logic to run when a connection is made. */
    protected readonly syncFn: SyncFn,
    /** Options for SyncConnection. */
    protected readonly opts: SyncConnectionOptions = {}
  ) {
    super();
  }

  /** Start listening for HotSync connections. */
  abstract start(): void;

  /** Stop listening for HotSync connections.
   *
   * Waits for existing HotSync operation to complete and any additional clean up.
   */
  abstract stop(): Promise<void>;
}

/** Events emitted by SyncServer. */
export interface SyncServerEvents {
  connect: (connection: SyncConnection) => void;
  disconnect: (connection: SyncConnection) => void;
}

// Bind events to SyncServer type signature.
export declare interface SyncServer {
  on<U extends keyof SyncServerEvents>(
    event: U,
    listener: SyncServerEvents[U]
  ): this;
  emit<U extends keyof SyncServerEvents>(
    event: U,
    ...args: Parameters<SyncServerEvents[U]>
  ): boolean;
}
