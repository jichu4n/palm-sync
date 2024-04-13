import Box from '@mui/material/Box';
import {ActionPanel} from './action-panel';
import {DeviceInfoPanel} from './device-info-panel';
import {LogViewer} from './log-viewer';

export function App() {
  return (
    <Box sx={{position: 'fixed', height: 1, width: 1, display: 'flex'}}>
      <Box sx={{width: '30em', display: 'flex', flexDirection: 'column'}}>
        <ActionPanel />
        <Box sx={{mt: 1}} />
        <DeviceInfoPanel />
      </Box>
      <Box sx={{flex: 1}}>
        <LogViewer />
      </Box>
    </Box>
  );
}
