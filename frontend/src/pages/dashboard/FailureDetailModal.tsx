import {
  Typography,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  BugReport as BugIcon,
  Code as CodeIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../../api';
import { categoryLabels } from './FailureCategories';

type RecentFailure = ApiSchemas['RecentFailure'];

export default function FailureDetailModal({
  failure,
  categoryColor,
  onClose,
}: {
  failure: RecentFailure | null;
  categoryColor: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Dialog
      open={!!failure}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      {failure && (
        <>
          <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <BugIcon sx={{ color: theme.palette.error.main }} />
              <Typography variant="h6" fontWeight={600}>
                Failure Analysis
              </Typography>
            </Box>
            <Chip
              label={categoryLabels[failure.category] || failure.category}
              size="small"
              sx={{
                backgroundColor: categoryColor,
                color: '#fff',
                fontWeight: 600,
              }}
            />
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Error Message
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.error.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                }}
              >
                <Typography variant="body2" color="error.main" fontFamily="monospace">
                  {failure.errorMessage}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CodeIcon fontSize="small" />
                Test Name
              </Typography>
              <Typography variant="body2" color="text.primary" fontFamily="monospace">
                {failure.testName || failure.filePath || 'N/A'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <BuildIcon fontSize="small" />
                AI Root Cause Analysis
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.success.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                }}
              >
                <Typography variant="body2" color="success.main">
                  {failure.rootCause || 'Analysis in progress...'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Confidence & Context
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.disabled">
                    Confidence
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="text.primary">
                    {(failure.confidence * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.disabled">
                    Similar Cases
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="text.primary">
                    {failure.similarCount}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.disabled">
                    Detected
                  </Typography>
                  <Typography variant="body2" fontWeight={500} color="text.primary">
                    {new Date(failure.timestamp).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2, gap: 1 }}>
            <Button onClick={onClose} variant="outlined" size="small">
              Close
            </Button>
            <Button variant="contained" size="small">
              View Full Details
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
