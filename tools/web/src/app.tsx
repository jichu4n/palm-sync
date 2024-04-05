import Grid from '@mui/material/Grid';
import ControlPanel from './control-panel';

function App() {
  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} xl={8}>
          <ControlPanel />
        </Grid>
        <Grid item xs={12} md={6} xl={4}>
          Logs
        </Grid>
      </Grid>
    </>
  );
}

export default App;
