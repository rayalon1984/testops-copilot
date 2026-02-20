import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  AccessTime as TimeIcon,
  BugReport as ErrorsIcon,
} from '@mui/icons-material';
import { api } from '../api';
import type { ApiSchemas } from '../api';

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

export default function TestRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch test run details
  const { data: testRun, isLoading } = useQuery<TestRun>({
    queryKey: ['test-run', id],
    queryFn: () => api.get<TestRun>(`/test-runs/${id}`),
  });

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
        {getStatusIcon(testRun.status)}
      </Box>

      {/* Overview Cards */}
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

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Error Logs" />
          <Tab label="Screenshots" />
        </Tabs>

        {/* Error Logs */}
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

        {/* Screenshots */}
        <TabPanel value={tabValue} index={1}>
          <ImageList cols={3} gap={16}>
            {(testRun.screenshots ?? []).map((screenshot, index) => (
              <ImageListItem
                key={index}
                onClick={() => setSelectedImage(screenshot)}
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