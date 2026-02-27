/**
 * Team Settings Page
 * Manage team details, members, and pipelines.
 */

import React, { useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader/PageHeader';
import { ApiError } from '../api';
import {
  useTeams,
  useTeamDetail,
  useCreateTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '../hooks/api';

const TeamSettings: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Create team dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '' });

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'MEMBER' });

  // ─── Queries ──────────────────────────────────────────────
  const { data: teams = [], isLoading } = useTeams();

  // Auto-select first team when teams load
  const activeTeamId = selectedTeamId ?? teams[0]?.id;
  const { data: selectedTeam } = useTeamDetail(activeTeamId);

  // ─── Mutations ────────────────────────────────────────────
  const createTeamMutation = useCreateTeam();
  const addMemberMutation = useAddTeamMember(activeTeamId);
  const removeMemberMutation = useRemoveTeamMember(activeTeamId);
  const updateRoleMutation = useUpdateTeamMemberRole(activeTeamId);

  const handleCreateTeam = () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) return;
    createTeamMutation.mutate(createForm, {
      onSuccess: (newTeam) => {
        setCreateOpen(false);
        setCreateForm({ name: '', slug: '', description: '' });
        setSelectedTeamId(newTeam.id);
      },
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to create team');
      },
    });
  };

  const handleAddMember = () => {
    if (!activeTeamId || !addMemberForm.userId.trim()) return;
    addMemberMutation.mutate(addMemberForm, {
      onSuccess: () => {
        setAddMemberOpen(false);
        setAddMemberForm({ userId: '', role: 'MEMBER' });
      },
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to add member');
      },
    });
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate(userId, {
      onError: () => setError('Failed to remove member'),
    });
  };

  const handleRoleChange = (userId: string, role: string) => {
    updateRoleMutation.mutate({ userId, role }, {
      onError: () => setError('Failed to update role'),
    });
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader
        title="Team Settings"
        subtitle="Manage your teams, members, and pipeline assignments"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Team List */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Your Teams</Typography>
          <Button
            variant="contained"
            startIcon={<GroupsIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Team
          </Button>
        </Box>

        {teams.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You don&apos;t belong to any teams yet. Create one to get started.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {teams.map((team) => (
              <Chip
                key={team.id}
                label={`${team.name} (${team.role.toLowerCase()})`}
                onClick={() => setSelectedTeamId(team.id)}
                color={activeTeamId === team.id ? 'primary' : 'default'}
                variant={activeTeamId === team.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Team Details */}
      {selectedTeam && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {selectedTeam.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Slug: {selectedTeam.slug} | Members: {selectedTeam._count.members} | Pipelines: {selectedTeam._count.pipelines}
            </Typography>
            {selectedTeam.description && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedTeam.description}
              </Typography>
            )}
          </Paper>

          {/* Members */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Members</Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={() => setAddMemberOpen(true)}
              >
                Add Member
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User ID</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedTeam.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Typography variant="body2">{member.userId.substring(0, 12)}...</Typography>
                      </TableCell>
                      <TableCell>
                        {member.role === 'OWNER' ? (
                          <Chip label="OWNER" size="small" color="error" />
                        ) : (
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                              sx={{ fontSize: '0.8rem' }}
                            >
                              <MenuItem value="ADMIN">ADMIN</MenuItem>
                              <MenuItem value="MEMBER">MEMBER</MenuItem>
                              <MenuItem value="VIEWER">VIEWER</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {member.role !== 'OWNER' && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveMember(member.userId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Team Name"
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Slug"
            value={createForm.slug}
            onChange={(e) =>
              setCreateForm((prev) => ({
                ...prev,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              }))
            }
            helperText="URL-friendly identifier (lowercase, hyphens only)"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTeam}
            disabled={createTeamMutation.isPending || !createForm.name.trim() || !createForm.slug.trim()}
          >
            {createTeamMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="User ID"
            value={addMemberForm.userId}
            onChange={(e) => setAddMemberForm((prev) => ({ ...prev, userId: e.target.value }))}
            helperText="Enter the user's ID to add them to the team"
            sx={{ mt: 1, mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={addMemberForm.role}
              label="Role"
              onChange={(e) => setAddMemberForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="MEMBER">Member</MenuItem>
              <MenuItem value="VIEWER">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddMember}
            disabled={!addMemberForm.userId.trim()}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TeamSettings;
