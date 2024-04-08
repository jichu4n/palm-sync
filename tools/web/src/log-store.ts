import {action, makeObservable, observable} from 'mobx';
import {debug} from 'palm-sync';

export enum LogEntryType {
  LOG = 'log',
  DIVIDER = 'divider',
}

export type LogEntry =
  | {
      type: LogEntryType.LOG;
      module: string;
      message: string;
    }
  | {
      type: LogEntryType.DIVIDER;
    };

class LogStore {
  constructor() {
    makeObservable(this, {
      logs: observable,
      addLog: action,
      addDivider: action,
    });
    debug.enable('*');
    debug.log = this.addLog.bind(this);
  }

  readonly logs: Array<LogEntry> = [];

  addLog(message: string) {
    // eslint-disable-next-line prefer-rest-params
    console.log(...arguments);
    const match = message.match(/^%c([^%]*) %c(.*)/s);
    let module;
    if (match) {
      [module, message] = [match[1], match[2]];
    } else {
      module = '';
    }
    message = message.replace(/%c/g, '').replace(/[+][0-9]+m?s$/, '');
    this.logs.push({
      type: LogEntryType.LOG,
      module,
      message,
    });
  }

  addDivider() {
    console.log('-'.repeat(40));
    this.logs.push({type: LogEntryType.DIVIDER});
  }
}

export const logStore = new LogStore();
