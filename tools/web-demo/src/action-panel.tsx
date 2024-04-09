import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {debug, readDbList} from 'palm-sync';
import {useCallback} from 'react';
import {runSync} from './run-sync';

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

export function ActionPanel() {
  const controls = [
    {width: 5, component: <NoOp />},
    {width: 5, component: <ListDb />},
  ];

  return (
    <Paper elevation={3} sx={{padding: 2, paddingTop: 1}}>
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
