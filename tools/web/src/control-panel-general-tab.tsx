import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import {useCallback} from 'react';
import {runSync} from './run-sync';
import {readDbList, debug} from 'palm-sync';

const log = debug('result');

function ListDb() {
  const handleClick = useCallback(async () => {
    await runSync(async (dlpConnection) => {
      const dbInfoList = await readDbList(dlpConnection, {
        ram: true,
        rom: true,
      });
      log(dbInfoList.map(({name}) => `=> ${name}`).join('\n'));
    });
  }, []);
  return (
    <>
      <Button variant="contained" fullWidth onClick={handleClick}>
        List DB
      </Button>
    </>
  );
}

function NoOp() {
  const handleClick = useCallback(async () => {
    await runSync(async () => {});
  }, []);

  return (
    <>
      <Button variant="contained" fullWidth onClick={handleClick}>
        No-op
      </Button>
    </>
  );
}

function ControlPanelGeneralTab() {
  const controls = [
    {width: 4, component: <NoOp />},
    {width: 4, component: <ListDb />},
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
