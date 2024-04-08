import Box from '@mui/material/Box';
import ControlPanel from './control-panel';
import {DeviceInfoViewer} from './device-info-viewer';
import {LogViewer} from './log-viewer';

function App() {
  return (
    <Box sx={{position: 'fixed', height: 1, width: 1, display: 'flex'}}>
      <Box sx={{width: '30em', display: 'flex', flexDirection: 'column'}}>
        <ControlPanel />
        <Box sx={{mt: 1}} />
        <DeviceInfoViewer />
      </Box>
      <Box sx={{flex: 1}}>
        <LogViewer />
      </Box>
    </Box>
  );
}

export default App;
