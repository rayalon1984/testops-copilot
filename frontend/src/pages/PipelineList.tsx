import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageContext } from '../hooks/usePageContext';
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
  Schedule as PendingIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../api';
import { usePipelines, useCreatePipeline, useDeletePipeline } from '../hooks/api';

type Pipeline = ApiSchemas['Pipeline'];
type CreatePipelineRequest = ApiSchemas['CreatePipelineRequest'];

function AddPipelineDialog({
  open,
  onClose,
  error,
  formData,
  setFormData,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  error: string;
  formData: CreatePipelineRequest;
  setFormData: (data: CreatePipelineRequest) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit}>
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
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Add
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function PipelineTableRow({
  pipeline,
  navigate,
  getStatusIcon,
  onDelete,
}: {
  pipeline: Pipeline;
  navigate: ReturnType<typeof useNavigate>;
  getStatusIcon: (status: string) => React.ReactNode;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow
      hover
      onClick={() => navigate(`/pipelines/${pipeline.id}`)}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover',
        }
      }}
    >
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
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/pipelines/${pipeline.id}`);
          }}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          color="primary"
          onClick={(e) => e.stopPropagation()}
        >
          <RunIcon />
        </IconButton>
        <IconButton
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pipeline.id);
          }}
        >
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

export default function PipelineList() {
  usePageContext('pipeline-list');
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState<CreatePipelineRequest>({
    name: '',
    type: 'jenkins',
    config: {},
  });
  const [error, setError] = useState('');

  // Shared query hooks
  const { data: pipelines, isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();
  const deletePipeline = useDeletePipeline();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPipeline.mutate(formData, {
      onSuccess: () => {
        setOpenDialog(false);
        setFormData({ name: '', type: 'jenkins', config: {} });
      },
      onError: (err) => setError(err.message),
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
              <PipelineTableRow
                key={pipeline.id}
                pipeline={pipeline}
                navigate={navigate}
                getStatusIcon={getStatusIcon}
                onDelete={(id) => deletePipeline.mutate(id)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <AddPipelineDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        error={error}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
      />
    </Container>
  );
}