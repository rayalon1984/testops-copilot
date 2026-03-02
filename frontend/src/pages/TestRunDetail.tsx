import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  Dialog,
  DialogContent,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  AccessTime as TimeIcon,
  BugReport as ErrorsIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../api';
import { usePageContext } from '../hooks/usePageContext';
import { useTestRun, useXraySyncTestRun } from '../hooks/api';

type TestRun = ApiSchemas['TestRunDetail'];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`test-run-tabpanel-${index}`}
      aria-labelledby={`test-run-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function TestRunOverviewCards({ testRun }: { testRun: TestRun }) {
  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardHeader title="Pipeline Info" />
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Pipeline"
                  secondary={testRun.pipelineName}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><TimeIcon /></ListItemIcon>
                <ListItemText
                  primary="Duration"
                  secondary={`${testRun.duration} seconds`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><ErrorsIcon /></ListItemIcon>
                <ListItemText
                  primary="Errors"
                  secondary={testRun.errorCount}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Execution Timeline" />
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Start Time"
                  secondary={new Date(testRun.startTime).toLocaleString()}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="End Time"
                  secondary={new Date(testRun.endTime).toLocaleString()}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function TestRunTabs({
  testRun,
  tabValue,
  onTabChange,
  onImageClick,
}: {
  testRun: TestRun;
  tabValue: number;
  onTabChange: (value: number) => void;
  onImageClick: (src: string) => void;
}) {
  return (
    <Paper sx={{ width: '100%' }}>
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => onTabChange(newValue)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label="Error Logs" />
        <Tab label="Screenshots" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <List>
          {(testRun.errorLogs ?? []).map((log, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary={log}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  },
                }}
              />
            </ListItem>
          ))}
          {(testRun.errorLogs ?? []).length === 0 && (
            <ListItem>
              <ListItemText primary="No errors found" />
            </ListItem>
          )}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ImageList cols={3} gap={16}>
          {(testRun.screenshots ?? []).map((screenshot, index) => (
            <ImageListItem
              key={index}
              onClick={() => onImageClick(screenshot)}
              sx={{ cursor: 'pointer' }}
            >
              <img
                src={screenshot}
                alt={`Test Screenshot ${index + 1}`}
                loading="lazy"
              />
            </ImageListItem>
          ))}
        </ImageList>
        {(testRun.screenshots ?? []).length === 0 && (
          <Typography>No screenshots available</Typography>
        )}
      </TabPanel>
    </Paper>
  );
}

export default function TestRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [syncResult, setSyncResult] = useState<{ status: string; xrayExecutionId: string | null } | null>(null);
  const [syncError, setSyncError] = useState('');

  // Fetch test run details via shared hook
  const { data: testRun, isLoading } = useTestRun(id);
  const syncToXray = useXraySyncTestRun();

  const handleSyncToXray = () => {
    if (!id) return;
    setSyncResult(null);
    setSyncError('');
    syncToXray.mutate(id, {
      onSuccess: (data) => {
        setSyncResult({ status: data.status, xrayExecutionId: data.xrayExecutionId });
      },
      onError: (err: Error) => {
        setSyncError(err.message || 'Sync failed');
      },
    });
  };

  usePageContext('testrun-detail', testRun ? {
    type: 'testrun', id: testRun.id, label: testRun.pipelineName || testRun.id,
    metadata: { status: testRun.status, errorCount: testRun.errorCount },
  } : null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!testRun) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h6" color="error">
          Test run not found
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/test-runs')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Test Run Details
        </Typography>

        {/* Xray sync button + result chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          {syncResult && (
            <Chip
              size="small"
              color="success"
              label={syncResult.xrayExecutionId ?? 'Synced'}
              variant="outlined"
            />
          )}
          {syncError && (
            <Tooltip title={syncError}>
              <Chip size="small" color="error" label="Sync failed" variant="outlined" />
            </Tooltip>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={syncToXray.isPending ? <CircularProgress size={14} /> : <SyncIcon />}
            onClick={handleSyncToXray}
            disabled={syncToXray.isPending}
          >
            {syncToXray.isPending ? 'Syncing…' : 'Sync to Xray'}
          </Button>
        </Box>

        {getStatusIcon(testRun.status)}
      </Box>

      <TestRunOverviewCards testRun={testRun} />

      <TestRunTabs
        testRun={testRun}
        tabValue={tabValue}
        onTabChange={setTabValue}
        onImageClick={setSelectedImage}
      />

      {/* Screenshot Dialog */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Test Screenshot"
              style={{ width: '100%', height: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}