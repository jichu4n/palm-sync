import Box from '@mui/material/Box';
import {ActionPanel} from './action-panel';
import {DeviceInfoPanel} from './device-info-panel';
import {LogViewer} from './log-viewer';
import Typography from '@mui/material/Typography';

export function App() {
  if (!navigator.serial || !navigator.usb) {
    const unsupportedApis = [
      ...(navigator.serial ? [] : ['Web Serial']),
      ...(navigator.usb ? [] : ['WebUSB']),
    ].join(' and ');
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Typography variant="h4" gutterBottom>
          This browser does not support {unsupportedApis} APIs.
        </Typography>
        <Typography variant="body1">
          Please use a Chromium-based browser and ensure USB and serial support
          are enabled.
        </Typography>
      </div>
    );
  }

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
