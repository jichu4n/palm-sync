import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import {USB_DEVICE_FILTERS} from 'palm-sync';
import {useCallback} from 'react';

console.log('palmSync', USB_DEVICE_FILTERS);

async function runSync() {
  await navigator.usb.requestDevice({filters: USB_DEVICE_FILTERS});
}

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
    await runSync();
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
