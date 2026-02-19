/**
 * Failure Activity Feed
 * Timeline of revisions + comments for collaborative RCA
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';

interface ActivityItem {
  type: 'revision' | 'comment' | 'status_change';
  timestamp: string;
  userId: string;
  content: string;
}

interface FailureActivityFeedProps {
  failureId: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: 'primary' | 'secondary' | 'default' }> = {
  revision: { icon: <EditIcon fontSize="small" />, color: 'primary' },
  comment: { icon: <CommentIcon fontSize="small" />, color: 'secondary' },
  status_change: { icon: <EditIcon fontSize="small" />, color: 'default' },
};

const FailureActivityFeed: React.FC<FailureActivityFeedProps> = ({ failureId }) => {
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`/api/v1/failure-archive/${failureId}/activity?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          setFeed(json.data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [failureId]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (feed.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
        Activity Feed
      </Typography>

      {feed.map((item, index) => {
        const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.status_change;
        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              gap: 1.5,
              py: 1,
              '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
            }}
          >
            <Box sx={{ pt: 0.5 }}>{config.icon}</Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label={item.type} size="small" color={config.color} variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  {item.userId.substring(0, 8)} &middot; {new Date(item.timestamp).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {item.content.length > 300 ? `${item.content.substring(0, 300)}...` : item.content}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
};

export default FailureActivityFeed;
