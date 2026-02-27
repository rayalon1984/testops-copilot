/**
 * Failure Comments
 * Comments list + add form for collaborative RCA discussion
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useFailureComments, useAddFailureComment, useDeleteFailureComment } from '../../hooks/api';

interface FailureCommentsProps {
  failureId: string;
}

const FailureComments: React.FC<FailureCommentsProps> = ({ failureId }) => {
  const [newComment, setNewComment] = useState('');

  const { data: comments = [], isLoading } = useFailureComments(failureId);
  const addComment = useAddFailureComment(failureId);
  const deleteComment = useDeleteFailureComment(failureId);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment.trim(), {
      onSuccess: () => setNewComment(''),
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
        Comments ({comments.length})
      </Typography>

      {/* Add comment form */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          multiline
          maxRows={3}
          disabled={addComment.isPending}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={addComment.isPending || !newComment.trim()}
          sx={{ minWidth: 40, px: 1 }}
        >
          {addComment.isPending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
        </Button>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Comments list */}
      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No comments yet. Be the first to add one.
        </Typography>
      ) : (
        comments.map((comment) => (
          <Box
            key={comment.id}
            sx={{
              py: 1,
              '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" fontWeight="bold">
                    {comment.userId.substring(0, 8)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => deleteComment.mutate(comment.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))
      )}
    </Paper>
  );
};

export default FailureComments;
