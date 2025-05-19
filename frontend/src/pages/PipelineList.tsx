import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';

interface Pipeline {
  id: string;
  name: string;
  type: 'jenkins' | 'github-actions';
  status: 'success' | 'failed' | 'running' | 'pending';
  lastRun: string;
  successRate: number;
  config: Record<string, any>;
}

interface PipelineFormData {
  name: string;
  type: 'jenkins' | 'github-actions';
  config: Record<string, any>;
}

export default function PipelineList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState<PipelineFormData>({
    name: '',
    type: 'jenkins',
    config: {},
  });
  const [error, setError] = useState('');

  // Fetch pipelines
  const { data: pipelines, isLoading } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const response = await fetch('/api/v1/pipelines');
      if (!response.ok) throw new Error('Failed to fetch pipelines');
      return response.json();
    },
  });

  // Create pipeline mutation
  const createPipeline = useMutation({
    mutationFn: async (data: PipelineFormData) => {
      const response = await fetch('/api/v1/pipelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create pipeline');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setOpenDialog(false);
      setFormData({ name: '', type: 'jenkins', config: {} });
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Delete pipeline mutation
  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/pipelines/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete pipeline');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPipeline.mutate(formData);
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Pipelines</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Pipeline
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Success Rate</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pipelines?.map((pipeline) => (
              <TableRow key={pipeline.id}>
                <TableCell>{pipeline.name}</TableCell>
                <TableCell>
                  <Chip
                    label={pipeline.type}
                    size="small"
                    color={pipeline.type === 'jenkins' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>{getStatusIcon(pipeline.status)}</TableCell>
                <TableCell>
                  {new Date(pipeline.lastRun).toLocaleString()}
                </TableCell>
                <TableCell>{pipeline.successRate}%</TableCell>
                <TableCell align="right">
                  <IconButton
                    color="primary"
                    onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton color="primary">
                    <RunIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => deletePipeline.mutate(pipeline.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Pipeline Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Add Pipeline</DialogTitle>
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              select
              margin="dense"
              label="Pipeline Type"
              fullWidth
              required
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'jenkins' | 'github-actions',
                })
              }
            >
              <MenuItem value="jenkins">Jenkins</MenuItem>
              <MenuItem value="github-actions">GitHub Actions</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}