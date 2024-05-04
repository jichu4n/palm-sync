import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Divider from '@mui/material/Divider';
import Paper, {PaperProps} from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {observer} from 'mobx-react';
import {useCallback, useState} from 'react';

export const Panel = observer(function Panel({
  title,
  children,
  isExpandedByDefault,
  ...props
}: PaperProps & {
  title: string;
  isExpandedByDefault?: boolean;
}) {
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('sm'));

  const [isExpanded, setIsExpanded] = useState(!!isExpandedByDefault);
  const toggleIsExpanded = useCallback(() => setIsExpanded((v) => !v), []);
  const Icon = isExpanded ? ExpandLessIcon : ExpandMoreIcon;

  return (
    <Paper elevation={3} {...props}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" px={2} py={1}>
          {title}
        </Typography>
        {!isWide && (
          <div
            style={{
              display: 'grid',
              placeContent: 'center',
              padding: '0 10px',
              cursor: 'pointer',
            }}
            onClick={toggleIsExpanded}
          >
            <Icon />
          </div>
        )}
      </div>
      {isExpanded && (
        <>
          <Divider />
          {children}
        </>
      )}
    </Paper>
  );

  /* We could use Accordion, but it looks less nice.

  return (
    <Paper elevation={3} {...props}>
      <Accordion defaultExpanded={isExpandedByDefault}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} style={{margin: 0}}>
          {title}
        </AccordionSummary>
        <AccordionDetails>
          <Divider />
          {children}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
  */
});
