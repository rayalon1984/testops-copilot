import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';

import type { ApiSchemas } from '../api';
type TestRun = ApiSchemas['TestRun'];

import { useDebounce } from '../hooks/useDebounce';
import { keepPreviousData } from '@tanstack/react-query';

export default function TestRunList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce search query to prevent jitter (500ms delay)
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Fetch test runs
  const { data, isLoading, isFetching } = useQuery<TestRun[]>({
    queryKey: ['test-runs', page, rowsPerPage, statusFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/test-runs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch test runs');
      return response.json();
    },
    placeholderData: keepPreviousData, // Keep table data visible while fetching new results
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

  const getStatusChip = (status: string) => {
    const statusProps = {
      success: { color: 'success' as const, label: 'Success' },
      failed: { color: 'error' as const, label: 'Failed' },
      running: { color: 'info' as const, label: 'Running' },
      pending: { color: 'default' as const, label: 'Pending' },
    }[status] || { color: 'default' as const, label: status };

    return (
      <Chip
        size="small"
        icon={getStatusIcon(status)}
        label={statusProps.label}
        color={statusProps.color}
      />
    );
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
      <Typography variant="h5" sx={{ mb: 3 }}>
        Test Runs
      </Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="running">Running</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
          </Select>
        </FormControl>
        <TextField
          placeholder="Search test runs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1 }}
        />
        {isFetching && !isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pipeline</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Errors</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.map((testRun) => (
              <TableRow
                key={testRun.id}
                hover
                onClick={() => navigate(`/test-runs/${testRun.id}`)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <TableCell>{testRun.pipelineName}</TableCell>
                <TableCell>{getStatusChip(testRun.status)}</TableCell>
                <TableCell>{new Date(testRun.startTime).toLocaleString()}</TableCell>
                <TableCell>{testRun.duration}s</TableCell>
                <TableCell>{testRun.errorCount}</TableCell>
                <TableCell align="right">
                  <IconButton
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/test-runs/${testRun.id}`);
                    }}
                  >
                    <ViewIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={-1}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Container>
  );
}