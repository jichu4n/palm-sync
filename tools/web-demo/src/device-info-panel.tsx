import Box from '@mui/material/Box';
import {PaperProps} from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {observer} from 'mobx-react';
import {deviceInfoStore} from './device-info-store';
import {Panel} from './panel';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export const DeviceInfoPanel = observer(function DeviceInfoPanel(
  props: PaperProps
) {
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('sm'));

  const {sysInfo, userInfo, sysDateTime} = deviceInfoStore;

  return (
    <Panel title="Device Info" isExpandedByDefault={isWide} {...props}>
      {!sysInfo || !userInfo || !sysDateTime ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            opacity: '50%',
          }}
          p={3}
        >
          <Typography variant="overline">Waiting for sync</Typography>
        </Box>
      ) : (
        <Box p={2}>
          {(
            [
              ['OS version', sysInfo.romSWVersion.toString()],
              ['DLP version', sysInfo.dlpVer.toString()],
              ['User name', userInfo.userName || 'N/A'],
              ['Last sync PC ID', userInfo.lastSyncPc],
              ['User ID', userInfo.userId],
              ['Last sync', userInfo.lastSyncDate.toLocaleString()],
              ['Last sync succ', userInfo.succSyncDate.toLocaleString()],
              ['System time', sysDateTime.dateTime.toLocaleString()],
            ] as const
          ).map(([label, value]) => (
            <Box
              key={label}
              sx={{display: 'flex', alignItems: 'center'}}
              py="0.1em"
            >
              <Typography
                variant="body2"
                component="span"
                mr={1}
                sx={{
                  textTransform: 'uppercase',
                  opacity: '50%',
                  fontWeight: 'bold',
                  width: '10em',
                }}
              >
                {label}
              </Typography>
              <Typography variant="body2" component="span">
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  );
});
