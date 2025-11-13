/**
 * Similar Failures Alert
 * Shows when a test failure matches past documented failures
 */

import React, { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Typography,
  Link,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';

interface SimilarFailure {
  failure: {
    id: string;
    testName: string;
    rootCause?: string;
    solution?: string;
    workaround?: string;
    jiraIssueKey?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    tags: string[];
  };
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'pattern';
  matchReason: string;
}

interface SimilarFailuresAlertProps {
  similarFailures: SimilarFailure[];
  onDocumentNew?: () => void;
  onMarkAsSame?: (failureId: string) => void;
}

export const SimilarFailuresAlert: React.FC<SimilarFailuresAlertProps> = ({
  similarFailures,
  onDocumentNew,
  onMarkAsSame
}) => {
  const [expanded, setExpanded] = useState(false);

  if (similarFailures.length === 0) {
    return null;
  }

  const topMatch = similarFailures[0];
  const isExactMatch = topMatch.matchType === 'exact';

  return (
    <Alert
      severity={isExactMatch ? 'info' : 'warning'}
      icon={isExactMatch ? <CheckCircleIcon /> : <TimelineIcon />}
      sx={{ mb: 2 }}
    >
      <AlertTitle>
        {isExactMatch ? '✅ Known Issue Detected' : '⚠️ Similar Failure Found'}
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: 1 }}>
        {topMatch.matchReason}
        {topMatch.similarity < 1.0 && (
          <Chip
            label={`${Math.round(topMatch.similarity * 100)}% match`}
            size="small"
            sx={{ ml: 1 }}
          />
        )}
      </Typography>

      {topMatch.failure.rootCause && (
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 2,
            borderRadius: 1,
            mb: 1
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Root Cause:
          </Typography>
          <Typography variant="body2" paragraph>
            {topMatch.failure.rootCause}
          </Typography>

          {topMatch.failure.solution && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Solution:
              </Typography>
              <Typography variant="body2" paragraph>
                {topMatch.failure.solution}
              </Typography>
            </>
          )}

          {topMatch.failure.workaround && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Quick Workaround:
              </Typography>
              <Typography variant="body2">
                {topMatch.failure.workaround}
              </Typography>
            </>
          )}

          {topMatch.failure.jiraIssueKey && (
            <Box sx={{ mt: 1 }}>
              <Link
                href={`/jira/${topMatch.failure.jiraIssueKey}`}
                target="_blank"
                underline="hover"
              >
                View {topMatch.failure.jiraIssueKey} →
              </Link>
            </Box>
          )}

          {topMatch.failure.tags.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {topMatch.failure.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}

          {topMatch.failure.resolvedBy && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Solved by {topMatch.failure.resolvedBy}
              {topMatch.failure.resolvedAt &&
                ` • ${new Date(topMatch.failure.resolvedAt).toLocaleDateString()}`}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        {isExactMatch && onMarkAsSame && (
          <Button
            size="small"
            variant="contained"
            onClick={() => onMarkAsSame(topMatch.failure.id)}
          >
            Mark as Same Issue
          </Button>
        )}

        {!topMatch.failure.rootCause && onDocumentNew && (
          <Button
            size="small"
            variant="outlined"
            onClick={onDocumentNew}
          >
            Document RCA Now
          </Button>
        )}

        {similarFailures.length > 1 && (
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: '0.3s'
                }}
              />
            }
          >
            {expanded ? 'Hide' : 'Show'} {similarFailures.length - 1} More Similar{' '}
            {similarFailures.length === 2 ? 'Failure' : 'Failures'}
          </Button>
        )}

        <Button
          size="small"
          href={`/failure-archive/${topMatch.failure.id}`}
          target="_blank"
        >
          View Full Details
        </Button>
      </Box>

      {similarFailures.length > 1 && (
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {similarFailures.slice(1).map((similar, index) => (
              <Box
                key={similar.failure.id}
                sx={{
                  bgcolor: 'background.paper',
                  p: 2,
                  borderRadius: 1,
                  borderLeft: '3px solid',
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2">
                    Match #{index + 2}
                  </Typography>
                  <Chip
                    label={`${Math.round(similar.similarity * 100)}% match`}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {similar.matchReason}
                </Typography>

                {similar.failure.rootCause && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Root Cause:</strong> {similar.failure.rootCause.substring(0, 150)}
                    {similar.failure.rootCause.length > 150 && '...'}
                  </Typography>
                )}

                <Button
                  size="small"
                  href={`/failure-archive/${similar.failure.id}`}
                  target="_blank"
                >
                  View Details
                </Button>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Alert>
  );
};
