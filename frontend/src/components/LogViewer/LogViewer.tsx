import { useState, useMemo } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  IconButton,
  Toolbar,
  Tooltip,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface LogViewerProps {
  logs: string[];
  isLoading?: boolean;
  title?: string;
  maxHeight?: string | number;
  downloadFileName?: string;
}

export default function LogViewer({
  logs,
  isLoading = false,
  title = 'Logs',
  maxHeight = '500px',
  downloadFileName = 'logs.txt',
}: LogViewerProps) {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  // Filter logs based on search term and error filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = searchTerm
        ? log.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesErrorFilter = showOnlyErrors
        ? log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')
        : true;
      return matchesSearch && matchesErrorFilter;
    });
  }, [logs, searchTerm, showOnlyErrors]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filteredLogs.join('\n'));
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([filteredLogs.join('\n')], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: maxHeight,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper variant="outlined">
      <Toolbar
        variant="dense"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
            sx={{ width: 200 }}
          />
          <Tooltip title="Show only errors">
            <IconButton
              color={showOnlyErrors ? 'error' : 'default'}
              onClick={() => setShowOnlyErrors(!showOnlyErrors)}
            >
              <FilterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy to clipboard">
            <IconButton onClick={handleCopy}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download logs">
            <IconButton onClick={handleDownload}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>

      <Box
        sx={{
          maxHeight,
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? '#011627' : '#f5f5f5',
        }}
      >
        <SyntaxHighlighter
          language="log"
          style={tomorrow}
          customStyle={{
            margin: 0,
            padding: theme.spacing(2),
            fontSize: '0.875rem',
          }}
        >
          {filteredLogs.join('\n')}
        </SyntaxHighlighter>
      </Box>

      <Toolbar
        variant="dense"
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {filteredLogs.length} of {logs.length} lines
        </Typography>
        {searchTerm && (
          <Typography variant="caption" color="text.secondary">
            Filtered by: &quot;{searchTerm}&quot;
          </Typography>
        )}
      </Toolbar>
    </Paper>
  );
}