import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {observer} from 'mobx-react';
import {deviceInfoStore} from './device-info-store';
import Box from '@mui/material/Box';

export const DeviceInfoViewer = observer(function DeviceInfoViewer() {
  const {sysInfo, userInfo, sysDateTime} = deviceInfoStore;
  return (
    <Paper elevation={3} sx={{padding: 2, paddingTop: 1}}>
      <Typography variant="h6" mb={1}>
        Device Info
      </Typography>
      {!sysInfo || !userInfo || !sysDateTime ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 1,
            opacity: '50%',
          }}
        >
          <Typography variant="overline">Waiting for sync</Typography>
        </Box>
      ) : (
        <Grid container>
          {(
            [
              ['OS', sysInfo.romSWVersion.toString(), 3],
              ['DLP', sysInfo.dlpVer.toString(), 3],
              ['User', userInfo.userName || 'N/A', 6],
              ['Sys time', sysDateTime.dateTime.toISOString(), 12],
            ] as const
          ).map(([label, value, width]) => (
            <Grid
              item
              xs={width}
              key={label}
              sx={{display: 'flex', alignItems: 'center'}}
            >
              <Typography
                variant="body2"
                component="span"
                mr={1}
                sx={{
                  textTransform: 'uppercase',
                  opacity: '50%',
                  fontWeight: 'bold',
                }}
              >
                {label}
              </Typography>
              <Typography variant="body2" component="span">
                {value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      )}
    </Paper>
  );
});
