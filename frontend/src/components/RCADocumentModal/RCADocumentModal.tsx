/**
 * RCA Documentation Modal
 * Form to document root cause analysis for a failure
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { api, ApiError } from '../../api';

interface RCADocumentModalProps {
  open: boolean;
  onClose: () => void;
  failureId: string;
  testName: string;
  errorMessage: string;
  rcaVersion?: number;
  onSuccess?: () => void;
}

export const RCADocumentModal: React.FC<RCADocumentModalProps> = ({
  open,
  onClose,
  failureId,
  testName,
  errorMessage,
  rcaVersion,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    rootCause: '',
    detailedAnalysis: '',
    solution: '',
    preventionSteps: '',
    workaround: '',
    jiraIssueKey: '',
    prUrl: '',
    timeToResolve: '',
    tagInput: '',
    editSummary: ''
  });

  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddTag = () => {
    const tag = formData.tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
      setFormData(prev => ({ ...prev, tagInput: '' }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async () => {
    if (!formData.rootCause.trim()) {
      setError('Root cause is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.put(`/failure-archive/${failureId}/document-rca`, {
        rootCause: formData.rootCause,
        detailedAnalysis: formData.detailedAnalysis || undefined,
        solution: formData.solution || undefined,
        preventionSteps: formData.preventionSteps || undefined,
        workaround: formData.workaround || undefined,
        jiraIssueKey: formData.jiraIssueKey || undefined,
        prUrl: formData.prUrl || undefined,
        timeToResolve: formData.timeToResolve ? parseInt(formData.timeToResolve) : undefined,
        tags: tags.length > 0 ? tags : undefined,
        expectedVersion: rcaVersion,
        editSummary: formData.editSummary || undefined,
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Conflict: This RCA was modified by another user. Please reload and try again.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to save RCA');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Document Root Cause Analysis</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Test: <strong>{testName}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Error: {errorMessage.substring(0, 100)}...
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          required
          label="Root Cause"
          multiline
          rows={3}
          value={formData.rootCause}
          onChange={handleChange('rootCause')}
          placeholder="What caused this failure? Be specific."
          helperText="Required: Explain the underlying cause of the failure"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Detailed Analysis"
          multiline
          rows={4}
          value={formData.detailedAnalysis}
          onChange={handleChange('detailedAnalysis')}
          placeholder="How did you investigate? What did you find?"
          helperText="Optional: Detailed investigation notes"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Solution Applied"
          multiline
          rows={3}
          value={formData.solution}
          onChange={handleChange('solution')}
          placeholder="What steps were taken to fix this?"
          helperText="Optional: How was this resolved?"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Prevention Steps"
          multiline
          rows={3}
          value={formData.preventionSteps}
          onChange={handleChange('preventionSteps')}
          placeholder="How can we prevent this from happening again?"
          helperText="Optional: Future prevention measures"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Workaround"
          multiline
          rows={2}
          value={formData.workaround}
          onChange={handleChange('workaround')}
          placeholder="Temporary workaround until permanent fix"
          helperText="Optional: Quick fix instructions"
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Jira Issue Key"
            value={formData.jiraIssueKey}
            onChange={handleChange('jiraIssueKey')}
            placeholder="PROJ-1234"
            helperText="Optional: Link to Jira ticket"
            sx={{ flex: 1 }}
          />

          <TextField
            label="PR/Commit URL"
            value={formData.prUrl}
            onChange={handleChange('prUrl')}
            placeholder="https://github.com/..."
            helperText="Optional: Link to fix"
            sx={{ flex: 1 }}
          />
        </Box>

        <TextField
          label="Time to Resolve (minutes)"
          type="number"
          value={formData.timeToResolve}
          onChange={handleChange('timeToResolve')}
          placeholder="120"
          helperText="Optional: How long did it take to fix?"
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              label="Add Tag"
              value={formData.tagInput}
              onChange={handleChange('tagInput')}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="e.g., auth, database, ui"
              sx={{ flex: 1 }}
            />
            <Button onClick={handleAddTag} variant="outlined">
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => handleRemoveTag(tag)}
                size="small"
              />
            ))}
          </Box>
        </Box>

        {rcaVersion !== undefined && rcaVersion > 0 && (
          <TextField
            fullWidth
            label="Edit Summary"
            value={formData.editSummary}
            onChange={handleChange('editSummary')}
            placeholder="Brief description of changes made"
            helperText="Optional: Describe what you changed in this revision"
            sx={{ mb: 2 }}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !formData.rootCause.trim()}
        >
          {submitting ? <CircularProgress size={24} /> : 'Save RCA & Mark Documented'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
