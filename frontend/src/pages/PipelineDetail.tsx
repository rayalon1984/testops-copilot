import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
type Pipeline = ApiSchemas['Pipeline'];
type TestRun = ApiSchemas['TestRun'];

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Pipeline>>({});
  const [error, setError] = useState('');

  // Fetch pipeline details
  const { data: pipeline, isLoading: isPipelineLoading } = useQuery<Pipeline>({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/pipelines/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    },
  });

  // Fetch recent test runs
  const { data: testRuns, isLoading: isTestRunsLoading} = useQuery<TestRun[]>({
    queryKey: ['pipeline', id, 'test-runs'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/pipelines/${id}/test-runs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch test runs');
      return response.json();
    },
  });

  // Update pipeline mutation
  const updatePipeline = useMutation({
    mutationFn: async (data: Partial<Pipeline>) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/pipelines/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update pipeline');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] });
      setOpenEditDialog(false);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // Delete pipeline mutation
  const deletePipeline = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/pipelines/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete pipeline');
    },
    onSuccess: () => {
      navigate('/pipelines');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePipeline.mutate(editFormData);
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
        <IconButton color="error" onClick={() => deletePipeline.mutate()}>
          <DeleteIcon />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Pipeline Overview */}
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

        {/* Recent Test Runs */}
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

      {/* Edit Pipeline Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
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
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}