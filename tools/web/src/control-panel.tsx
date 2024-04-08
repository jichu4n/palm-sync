import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {
  DlpGetSysDateTimeReqType,
  DlpSetSysDateTimeReqType,
  debug,
  readDbList,
} from 'palm-sync';
import {useCallback} from 'react';
import {runSync} from './run-sync';
import {deviceInfoStore} from './device-info-store';

const log = debug('result');

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

function SetSysTime() {
  const handleClick = useCallback(async () => {
    await runSync(async (dlpConnection) => {
      await dlpConnection.execute(
        DlpSetSysDateTimeReqType.with({
          dateTime: new Date(),
        })
      );
      const sysDateTime = await dlpConnection.execute(
        DlpGetSysDateTimeReqType.with({})
      );
      deviceInfoStore.update({sysDateTime});
    });
  }, []);
  return (
    <>
      <Button variant="contained" fullWidth onClick={handleClick}>
        Set Sys Time
      </Button>
    </>
  );
}

function ControlPanel() {
  const controls = [
    {width: 5, component: <NoOp />},
    {width: 5, component: <ListDb />},
    {width: 5, component: <SetSysTime />},
  ];

  return (
    <Paper elevation={3} sx={{height: 1, padding: 1}}>
      <Typography variant="h6" mb={1}>
        Sync
      </Typography>
      <Grid container spacing={2} padding={2} justifyContent="center">
        {controls.map(({width, component}, idx) => (
          <Grid key={idx} item xs={width}>
            {component}
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default ControlPanel;
