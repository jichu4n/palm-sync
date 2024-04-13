import Box from '@mui/material/Box';
import {ActionPanel} from './action-panel';
import {DeviceInfoPanel} from './device-info-panel';
import {LogViewer} from './log-viewer';

export function App() {
  return (
    <Box sx={{position: 'fixed', height: 1, width: 1, display: 'flex'}}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '30em',
          minWidth: '20em',
        }}
      >
        <ActionPanel />
        <Box sx={{mt: 1}} />
        <DeviceInfoPanel />
      </Box>
      <Box sx={{flex: 1, minWidth: '30em'}}>
        <LogViewer />
      </Box>
    </Box>
  );
}
