import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {useState} from 'react';
import Box from '@mui/material/Box';

function ControlPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const onTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setActiveTab(newValue);
  };
  return (
    <Paper elevation={3} sx={{height: '100%'}}>
      <Tabs value={activeTab} onChange={onTabChange}>
        <Tab label="info" />
      </Tabs>

      <Box sx={{padding: 2}}>
        {activeTab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Button variant="contained" fullWidth>
                List databases
              </Button>
            </Grid>
          </Grid>
        )}
      </Box>
    </Paper>
  );
}

export default ControlPanel;
