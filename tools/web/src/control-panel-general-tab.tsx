import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import {createSyncServerAndRunSync} from 'palm-sync';
import {useCallback} from 'react';

function ListDatabases() {
  return (
    <>
      <Button variant="contained" fullWidth>
        List databases
      </Button>
    </>
  );
}

function NoOpSync() {
  const handleClick = useCallback(async () => {
    await createSyncServerAndRunSync('usb', async () => {});
  }, []);

  return (
    <>
      <Button variant="contained" fullWidth onClick={handleClick}>
        No-op sync
      </Button>
    </>
  );
}

function ControlPanelGeneralTab() {
  const controls = [
    {width: 4, component: <NoOpSync />},
    {width: 4, component: <ListDatabases />},
  ];
  return (
    <>
      {controls.map(({width, component}, idx) => (
        <Grid key={idx} item xs={width}>
          {component}
        </Grid>
      ))}
    </>
  );
}

export default ControlPanelGeneralTab;
