import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import {useState} from 'react';
import ControlPanelGeneralTab from './control-panel-general-tab';

function ControlPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const onTabChange = (_event: React.ChangeEvent<{}>, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    {
      title: 'general',
      component: <ControlPanelGeneralTab />,
    },
  ];

  return (
    <Paper elevation={3} sx={{height: '100%'}}>
      <Tabs value={activeTab} onChange={onTabChange}>
        {tabs.map(({title}) => (
          <Tab key={title} label={title} />
        ))}
      </Tabs>

      <Box sx={{padding: 2}}>
        <Grid container spacing={2}>
          {tabs[activeTab].component}
        </Grid>
      </Box>
    </Paper>
  );
}

export default ControlPanel;
