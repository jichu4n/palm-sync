import Box, {BoxProps} from '@mui/material/Box';
import {observer} from 'mobx-react';
import {useEffect, useRef} from 'react';
import {logStore} from './log-store';

export const LogViewer = observer(function LogViewer(props: BoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = useRef(true);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (isScrolledToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  });
  return (
    <Box
      sx={{overflowY: 'scroll', height: 1, padding: 1}}
      ref={containerRef}
      onScroll={() => {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        isScrolledToBottom.current =
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
          2;
      }}
      {...props}
    >
      {logStore.logs.map((entry, i) => (
        <div key={i}>
          {entry.type === 'log' ? (
            <>
              <code
                style={{
                  fontSize: '0.8em',
                  wordBreak: 'break-all',
                  whiteSpace: 'preserve',
                }}
              >
                {entry.module && (
                  <span style={{opacity: '50%', marginRight: '1em'}}>
                    {entry.module}
                  </span>
                )}
                {entry.message}
              </code>
            </>
          ) : (
            <hr style={{margin: '1em 0'}} />
          )}
        </div>
      ))}
    </Box>
  );
});
