import {action, makeObservable, observable} from 'mobx';

export interface Prefs {
  connectionString: 'usb' | 'serial:web';
}

function getDefaultConnectionString() {
  for (const [isEnabled, connectionString] of [
    [!!navigator.usb, 'usb'],
    [!!navigator.serial, 'serial:web'],
  ] as const) {
    if (isEnabled) {
      return connectionString;
    }
  }
  return 'usb';
}

export const DEFAULT_PREFS: Prefs = Object.freeze({
  connectionString: getDefaultConnectionString(),
});

class PrefsStore {
  constructor() {
    const savedPrefs = localStorage.getItem('prefs');
    if (savedPrefs) {
      try {
        this.prefs = JSON.parse(savedPrefs);
      } catch (e) {
        console.error('Failed to load prefs:', e);
      }
    }
    makeObservable(this, {
      prefs: observable,
      update: action,
      set: action,
    });
  }

  prefs: Partial<Prefs> = {};

  update(prefs: Partial<Prefs>) {
    Object.assign(this.prefs, prefs);
    localStorage.setItem('prefs', JSON.stringify(this.prefs));
  }

  get(key: keyof Prefs): Prefs[keyof Prefs] {
    return this.prefs[key] ?? DEFAULT_PREFS[key];
  }

  set(key: keyof Prefs, value: Prefs[keyof Prefs]) {
    this.update({[key]: value});
  }
}

export const prefsStore = new PrefsStore();
