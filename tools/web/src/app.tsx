import Box from '@mui/material/Box';
import ControlPanel from './control-panel';
import {LogViewer} from './log-viewer';

function App() {
  return (
    <Box sx={{position: 'fixed', height: 1, width: 1, display: 'flex'}}>
      <Box sx={{width: '30em'}}>
        <ControlPanel />
      </Box>
      <Box sx={{flex: 1}}>
        <LogViewer />
      </Box>
    </Box>
  );
}

export default App;
