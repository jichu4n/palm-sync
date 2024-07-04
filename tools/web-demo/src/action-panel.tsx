import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import {PaperProps} from '@mui/material/Paper';
import SvgIcon from '@mui/material/SvgIcon';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {observer} from 'mobx-react';
import {debug, readDbList} from 'palm-sync';
import {Fragment, useCallback} from 'react';
import {SerialIcon, UsbIcon} from './icons';
import {Panel} from './panel';
import {prefsStore} from './prefs-store';
import {runSync} from './run-sync';

const log = debug('result');

const ConnectionSelector = observer(function ConnectionSelector() {
  const connectionString = prefsStore.get('connectionString');
  const onChange = useCallback((_: unknown, newConnectionString: string) => {
    if (newConnectionString === 'usb' || newConnectionString === 'serial:web') {
      prefsStore.set('connectionString', newConnectionString);
    }
  }, []);
  const buttons = [
    ['usb', UsbIcon, 'USB', !!navigator.usb],
    ['serial:web', SerialIcon, 'Serial', !!navigator.serial],
  ] as const;
  return (
    <ToggleButtonGroup
      value={connectionString}
      exclusive
      onChange={onChange}
      color="primary"
    >
      {buttons.map(([value, Icon, label, isEnabled]) => (
        <ToggleButton
          key={value}
          value={value}
          sx={{width: '10em'}}
          size="small"
          disabled={!isEnabled}
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

export function ActionPanel(props: PaperProps) {
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('sm'));

  const controls = [NoOp, ListDb];
  return (
    <Panel title="Sync" isExpandedByDefault={true} {...props}>
      <Grid container spacing={1} p={2} justifyContent="center">
        <Grid item>
          <ConnectionSelector />
        </Grid>
        <Grid item xs={12} />
        {controls.map((Component, idx) => (
          <Fragment key={idx}>
            <Grid
              item
              xs={4}
              sm={5}
              {...(!isWide && idx > 0 ? {sx: {marginLeft: 1}} : {})}
            >
              <Component />
            </Grid>
            {isWide && <Grid item xs={12} />}
          </Fragment>
        ))}
      </Grid>
    </Panel>
  );
}
