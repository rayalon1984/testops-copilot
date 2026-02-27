import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';

import type { ApiSchemas } from '../api';
import { usePageContext } from '../hooks/usePageContext';
import { usePipeline, usePipelineTestRuns, useUpdatePipeline, useDeletePipeline } from '../hooks/api';
type Pipeline = ApiSchemas['Pipeline'];
type TestRun = ApiSchemas['TestRun'];

function PipelineOverview({
  pipeline,
  testRuns,
  getStatusIcon,
}: {
  pipeline: Pipeline;
  testRuns: TestRun[] | undefined;
  getStatusIcon: (status: string) => React.ReactNode;
}) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardHeader title="Overview" />
          <CardContent>
            <List>
              <ListItem>
                <ListItemIcon>{getStatusIcon(pipeline.status)}</ListItemIcon>
                <ListItemText
                  primary="Status"
                  secondary={pipeline.status.toUpperCase()}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><HistoryIcon /></ListItemIcon>
                <ListItemText
                  primary="Last Run"
                  secondary={new Date(pipeline.lastRun).toLocaleString()}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText
                  primary="Type"
                  secondary={pipeline.type}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Recent Test Runs" />
          <CardContent>
            <List>
              {testRuns?.map((run) => (
                <ListItem key={run.id}>
                  <ListItemIcon>{getStatusIcon(run.status)}</ListItemIcon>
                  <ListItemText
                    primary={new Date(run.startTime).toLocaleString()}
                    secondary={`Duration: ${run.duration}s | Errors: ${run.errorCount}`}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function EditPipelineDialog({
  open,
  onClose,
  pipeline,
  error,
  editFormData,
  setEditFormData,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  pipeline: Pipeline;
  error: string;
  editFormData: Partial<Pipeline>;
  setEditFormData: (data: Partial<Pipeline>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit}>
        <DialogTitle>Edit Pipeline</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Pipeline Name"
            fullWidth
            required
            defaultValue={pipeline.name}
            onChange={(e) =>
              setEditFormData({ ...editFormData, name: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Pipeline>>({});
  const [error, setError] = useState('');

  // Shared query hooks
  const { data: pipeline, isLoading: isPipelineLoading } = usePipeline(id);

  usePageContext('pipeline-detail', pipeline ? {
    type: 'pipeline', id: pipeline.id, label: pipeline.name,
    metadata: { type: pipeline.type, status: pipeline.status },
  } : null);

  const { data: testRuns, isLoading: isTestRunsLoading } = usePipelineTestRuns(id);

  const updatePipeline = useUpdatePipeline(id);
  const deletePipelineMutation = useDeletePipeline();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePipeline.mutate(editFormData, {
      onSuccess: () => setOpenEditDialog(false),
      onError: (err: Error) => setError(err.message),
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return null;
    }
  };

  if (isPipelineLoading || isTestRunsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pipeline) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Pipeline not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/pipelines')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {pipeline.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={<RunIcon />}
          sx={{ mr: 1 }}
        >
          Run Pipeline
        </Button>
        <IconButton onClick={() => setOpenEditDialog(true)} sx={{ mr: 1 }}>
          <EditIcon />
        </IconButton>
        <IconButton color="error" onClick={() => deletePipelineMutation.mutate(id!, { onSuccess: () => navigate('/pipelines') })}>
          <DeleteIcon />
        </IconButton>
      </Box>

      <PipelineOverview pipeline={pipeline} testRuns={testRuns} getStatusIcon={getStatusIcon} />

      <EditPipelineDialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        pipeline={pipeline}
        error={error}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        onSubmit={handleSubmit}
      />
    </Container>
  );
}