import Typography from '@mui/material/Typography';
import {ActionPanel} from './action-panel';
import {DeviceInfoPanel} from './device-info-panel';
import {LogViewer} from './log-viewer';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {CSSProperties} from 'react';

function UnsupportedApisBanner() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        placeContent: 'center',
        textAlign: 'center',
        padding: '2em',
      }}
    >
      <Typography variant="h4" gutterBottom>
        WebUSB and Web Serial APIs are not enabled.
      </Typography>
      <Typography variant="body1">
        Please use a Chromium-based browser, ensure WebUSB or Web Serial
        functionality are enabled, and open this page over HTTPS.
      </Typography>
    </div>
  );
}

export function App() {
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('sm'));

  if (!navigator.serial && !navigator.usb) {
    return <UnsupportedApisBanner />;
  }

  const panelMargins: CSSProperties = isWide
    ? {margin: '10px 10px 0 10px'}
    : {marginBottom: 5};

  return (
    <div
      style={{
        position: 'absolute',
        height: '100vh',
        width: '100vw',
        display: 'grid',
        ...(isWide
          ? {
              gridTemplateAreas: `
                'actionPanel logViewer'
                'deviceInfoPanel logViewer'
                '. logViewer'
              `,
              gridTemplateColumns: '1fr 2fr',
              gridTemplateRows: 'min-content min-content 1fr',
            }
          : {
              gridTemplateAreas: `
                'actionPanel'
                'deviceInfoPanel'
                'logViewer'
              `,
              gridTemplateRows: 'min-content min-content 1fr',
            }),
      }}
    >
      <ActionPanel style={{gridArea: 'actionPanel', ...panelMargins}} />
      <DeviceInfoPanel style={{gridArea: 'deviceInfoPanel', ...panelMargins}} />
      <LogViewer style={{gridArea: 'logViewer', padding: 10}} />
    </div>
  );
}
