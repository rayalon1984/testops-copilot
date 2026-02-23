import { useState, useMemo, useRef, useEffect } from 'react';
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
  Stack,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  VerticalAlignBottom as ScrollDownIcon,
  UnfoldLess as FoldIcon,
  UnfoldMore as UnfoldIcon,
  FindInPage as RegexIcon,
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
  maxHeight = '600px',
  downloadFileName = 'logs.txt',
}: LogViewerProps) {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [collapsePassed, setCollapsePassed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter and process logs
  const processedLogs = useMemo(() => {
    let result = logs;

    // 1. Smart Folding (Collapse non-error blocks - simplified)
    // Real implementation would need block detection. Here we filter out "PASS" lines if toggled.
    if (collapsePassed) {
      result = result.filter(log =>
        !log.includes('✅') &&
        !log.includes('PASS') &&
        !log.match(/^ok \d+/)
      );
    }

    // 2. Search (Text or Regex)
    if (searchTerm) {
      try {
        const regex = new RegExp(searchTerm, isRegex ? 'i' : 'gi');
        result = result.filter(log => {
          if (isRegex) return regex.test(log);
          return log.toLowerCase().includes(searchTerm.toLowerCase());
        });
      } catch (e) {
        // Invalid regex, ignore filter
      }
    }

    // 3. Error Filter
    if (showOnlyErrors) {
      result = result.filter(log =>
        log.toLowerCase().includes('error') ||
        log.toLowerCase().includes('failed') ||
        log.toLowerCase().includes('exception') ||
        log.toLowerCase().includes('❌')
      );
    }

    return result;
  }, [logs, searchTerm, isRegex, showOnlyErrors, collapsePassed]);

  // Minimap Calculation
  const minimapData = useMemo(() => {
    // Determine relative position of errors for the minimap
    // Map full original logs to find error indices
    const errorIndices: number[] = [];
    logs.forEach((log, index) => {
      if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') || log.includes('❌')) {
        errorIndices.push(index);
      }
    });
    return errorIndices;
  }, [logs]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(processedLogs.join('\n'));
    } catch {
      // Clipboard API may fail in insecure contexts; silently degrade
    }
  };

  const handleDownload = () => {
    const blob = new Blob([processedLogs.join('\n')], { type: 'text/plain' });
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: maxHeight }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: maxHeight,
        borderColor: theme.palette.divider,
        overflow: 'hidden' // Contain child scrolls
      }}
    >
      {/* Toolbar */}
      <Toolbar
        variant="dense"
        sx={{
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: theme.palette.background.paper,
          minHeight: '48px !important'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="subtitle2" fontWeight="bold" color="primary">
            {title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'background.default', borderRadius: 1, px: 1 }}>
            <SearchIcon fontSize="small" color="disabled" sx={{ mr: 1 }} />
            <TextField
              variant="standard"
              placeholder={isRegex ? "Regex search..." : "Search logs..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ disableUnderline: true }}
              sx={{ width: 180, '& input': { fontSize: '0.875rem' } }}
            />
            <Tooltip title="Toggle Regex Mode">
              <IconButton
                size="small"
                color={isRegex ? "primary" : "default"}
                onClick={() => setIsRegex(!isRegex)}
              >
                <RegexIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title={collapsePassed ? "Show All Tests" : "Collapse Passed Tests"}>
            <IconButton
              size="small"
              color={collapsePassed ? "primary" : "default"}
              onClick={() => setCollapsePassed(!collapsePassed)}
            >
              {collapsePassed ? <UnfoldIcon fontSize="small" /> : <FoldIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Show only errors">
            <IconButton
              size="small"
              color={showOnlyErrors ? "error" : "default"}
              onClick={() => setShowOnlyErrors(!showOnlyErrors)}
            >
              <FilterIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Follow Tail">
            <IconButton
              size="small"
              color={autoScroll ? "secondary" : "default"}
              onClick={() => setAutoScroll(!autoScroll)}
            >
              <ScrollDownIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box sx={{ width: 1, height: 24, bgcolor: 'divider', mx: 1 }} />

          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={handleCopy}>
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download logs">
            <IconButton size="small" onClick={handleDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>

      {/* Main Content Area: Logs + Minimap */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Log Lines */}
        <Box
          ref={scrollRef}
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            bgcolor: '#0d0d0d', // Deep editor black
            p: 0,
          }}
        >
          {processedLogs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">No logs found matching your filters.</Typography>
              <Button size="small" onClick={() => { setSearchTerm(''); setShowOnlyErrors(false); setCollapsePassed(false); }}>
                Clear Filters
              </Button>
            </Box>
          ) : (
            <SyntaxHighlighter
              language="log"
              style={vscDarkPlus}
              showLineNumbers
              customStyle={{
                margin: 0,
                padding: '16px',
                fontSize: '13px',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                lineHeight: '1.5',
                background: 'transparent'
              }}
              lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: theme.palette.text.disabled }}
            >
              {processedLogs.join('\n')}
            </SyntaxHighlighter>
          )}
          <div ref={logsEndRef} />
        </Box>

        {/* Minimap Sidebar (Only show if not filtered, for context matching) */}
        {!searchTerm && !showOnlyErrors && !collapsePassed && logs.length > 0 && (
          <Box
            sx={{
              width: 12,
              bgcolor: 'background.paper',
              borderLeft: 1,
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {minimapData.map((errorIndex) => (
              <Box
                key={errorIndex}
                sx={{
                  position: 'absolute',
                  top: `${(errorIndex / logs.length) * 100}%`,
                  left: 0,
                  right: 0,
                  height: 2,
                  bgcolor: 'error.main',
                  opacity: 0.8,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Footer Info */}
      <Box sx={{
        borderTop: 1,
        borderColor: 'divider',
        px: 2,
        py: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
      }}>
        <Typography variant="caption" color="text.secondary">
          {processedLogs.length} lines shown (Total: {logs.length})
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isRegex ? "Regex Mode" : "Normal Mode"}
        </Typography>
      </Box>
    </Paper>
  );
}