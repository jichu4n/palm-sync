import {DlpReadDBListMode, DlpReadDBListRequest, NetSyncConnection} from '..';
import assert from 'assert';

export async function run({dlpConnection}: NetSyncConnection) {
  const readDbListResp = await dlpConnection.execute(
    DlpReadDBListRequest.with({
      mode: DlpReadDBListMode.LIST_RAM | DlpReadDBListMode.LIST_MULTIPLE,
    })
  );
  const dbNames = readDbListResp.metadataList.map(({name}) => name);
  assert.deepStrictEqual(dbNames, [
    'AddressDB',
    'MailDB',
    'MemoDB',
    'ConnectionMgrDB',
    'NetworkDB',
    'npadDB',
    'ToDoDB',
    'psysLaunchDB',
    'Graffiti ShortCuts',
    'Unsaved Preferences',
    'Net Prefs',
    'System MIDI Sounds',
    'Saved Preferences',
  ]);
}
