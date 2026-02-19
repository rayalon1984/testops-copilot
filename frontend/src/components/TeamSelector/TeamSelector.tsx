/**
 * Team Selector
 * Dropdown to switch between teams in the sidebar.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Groups as GroupsIcon,
} from '@mui/icons-material';

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
}

interface TeamSelectorProps {
  onTeamChange?: (teamId: string | null) => void;
}

const TeamSelector: React.FC<TeamSelectorProps> = ({ onTeamChange }) => {
  const theme = useTheme();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('personal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/v1/teams', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          setTeams(json.data);
        }
      } catch {
        // Silently fail — no teams available
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  const handleChange = (value: string) => {
    setSelectedTeam(value);
    onTeamChange?.(value === 'personal' ? null : value);
  };

  if (loading) {
    return (
      <Box sx={{ px: 2.5, py: 1, textAlign: 'center' }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <FormControl fullWidth size="small">
        <Select
          value={selectedTeam}
          onChange={(e) => handleChange(e.target.value)}
          displayEmpty
          sx={{
            borderRadius: 2,
            fontSize: '0.8rem',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            '& .MuiSelect-select': { py: 0.8, px: 1.5, display: 'flex', alignItems: 'center', gap: 1 },
          }}
        >
          <MenuItem value="personal">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2">Personal</Typography>
            </Box>
          </MenuItem>
          {teams.map((team) => (
            <MenuItem key={team.id} value={team.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <GroupsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ flex: 1 }}>{team.name}</Typography>
                <Chip
                  label={team.role.toLowerCase()}
                  size="small"
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default TeamSelector;
