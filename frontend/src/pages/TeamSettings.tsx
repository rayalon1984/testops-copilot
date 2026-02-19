/**
 * Team Settings Page
 * Manage team details, members, and pipelines.
 */

import React, { useState, useEffect } from 'react';
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
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader/PageHeader';

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdBy: string;
  members: TeamMember[];
  _count: { members: number; pipelines: number };
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
}

interface TeamListItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
}

const TeamSettings: React.FC = () => {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'MEMBER' });

  const token = localStorage.getItem('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/v1/teams', { headers });
      const json = await res.json();
      if (json.success) {
        setTeams(json.data);
        if (json.data.length > 0 && !selectedTeam) {
          await fetchTeamDetails(json.data[0].id);
        }
      }
    } catch {
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamDetails = async (teamId: string) => {
    try {
      const res = await fetch(`/api/v1/teams/${teamId}`, { headers });
      const json = await res.json();
      if (json.success) {
        setSelectedTeam(json.data);
      }
    } catch {
      setError('Failed to load team details');
    }
  };

  const handleCreateTeam = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/teams', {
        method: 'POST',
        headers,
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.success) {
        setCreateOpen(false);
        setCreateForm({ name: '', slug: '', description: '' });
        await fetchTeams();
        await fetchTeamDetails(json.data.id);
      } else {
        setError(json.error || 'Failed to create team');
      }
    } catch {
      setError('Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !addMemberForm.userId.trim()) return;
    try {
      const res = await fetch(`/api/v1/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify(addMemberForm),
      });
      const json = await res.json();
      if (json.success) {
        setAddMemberOpen(false);
        setAddMemberForm({ userId: '', role: 'MEMBER' });
        await fetchTeamDetails(selectedTeam.id);
      } else {
        setError(json.error || 'Failed to add member');
      }
    } catch {
      setError('Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;
    try {
      await fetch(`/api/v1/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers,
      });
      await fetchTeamDetails(selectedTeam.id);
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!selectedTeam) return;
    try {
      await fetch(`/api/v1/teams/${selectedTeam.id}/members/${userId}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role }),
      });
      await fetchTeamDetails(selectedTeam.id);
    } catch {
      setError('Failed to update role');
    }
  };

  const getRoleColor = (role: string): 'error' | 'warning' | 'primary' | 'default' => {
    switch (role) {
      case 'OWNER': return 'error';
      case 'ADMIN': return 'warning';
      case 'MEMBER': return 'primary';
      default: return 'default';
    }
  };

  if (loading) {
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
            You don't belong to any teams yet. Create one to get started.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {teams.map((team) => (
              <Chip
                key={team.id}
                label={`${team.name} (${team.role.toLowerCase()})`}
                onClick={() => fetchTeamDetails(team.id)}
                color={selectedTeam?.id === team.id ? 'primary' : 'default'}
                variant={selectedTeam?.id === team.id ? 'filled' : 'outlined'}
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
            disabled={creating || !createForm.name.trim() || !createForm.slug.trim()}
          >
            {creating ? <CircularProgress size={20} /> : 'Create'}
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
