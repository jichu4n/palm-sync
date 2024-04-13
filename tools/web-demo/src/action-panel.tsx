import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {observer} from 'mobx-react';
import {debug, readDbList} from 'palm-sync';
import {Fragment, useCallback} from 'react';
import {SerialIcon, UsbIcon} from './icons';
import {prefsStore} from './prefs-store';
import {runSync} from './run-sync';
import SvgIcon from '@mui/material/SvgIcon';

const log = debug('result');

const ConnectionSelector = observer(function ConnectionSelector() {
  const connectionString = prefsStore.get('connectionString');
  const onChange = useCallback((_: unknown, newConnectionString: string) => {
    if (newConnectionString === 'usb' || newConnectionString === 'web-serial') {
      prefsStore.set('connectionString', newConnectionString);
    }
  }, []);
  const buttons = [
    ['usb', UsbIcon, 'USB'],
    ['web-serial', SerialIcon, 'Serial'],
  ] as const;
  return (
    <ToggleButtonGroup
      value={connectionString}
      exclusive
      onChange={onChange}
      color="primary"
    >
      {buttons.map(([value, Icon, label]) => (
        <ToggleButton
          key={value}
          value={value}
          sx={{width: '10em'}}
          size="small"
        >
          <SvgIcon sx={{marginRight: 1}}>
            <Icon />
          </SvgIcon>
          <span
            style={{
              // Hack to center the text vertically compared to icon
              lineHeight: '24px',
            }}
          >
            {label}
          </span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
});

function NoOp() {
  const handleClick = useCallback(async () => {
    await runSync(async () => {});
  }, []);

  return (
    <Button variant="contained" fullWidth onClick={handleClick}>
      No-op
    </Button>
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
    <Button variant="contained" fullWidth onClick={handleClick}>
      List DB
    </Button>
  );
}

export function ActionPanel() {
  const controls = [NoOp, ListDb];
  return (
    <Paper elevation={3}>
      <Typography variant="h6" px={2} py={1}>
        Sync
      </Typography>
      <Divider />
      <Grid container spacing={1} p={2} justifyContent="center">
        <Grid item>
          <ConnectionSelector />
        </Grid>
        <Grid item xs={12} />
        {controls.map((Component, idx) => (
          <Fragment key={idx}>
            <Grid item xs={5}>
              <Component />
            </Grid>
            <Grid item xs={12} />
          </Fragment>
        ))}
      </Grid>
    </Paper>
  );
}
