import {
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Button,
  Fade,
  Grow,
  useTheme,
  alpha,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import type { ApiSchemas } from '../../api';
import { categoryLabels } from './FailureCategories';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];
type RecentFailure = ApiSchemas['RecentFailure'];

export default function RecentFailures({
  metrics,
  onViewAll,
  onSelectFailure,
}: {
  metrics: DashboardMetrics;
  onViewAll: () => void;
  onSelectFailure: (failure: RecentFailure) => void;
}) {
  const theme = useTheme();
  return (
    <Grow in timeout={900}>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              Recent Failures
            </Typography>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
              onClick={onViewAll}
              sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.8rem' }}
            >
              View all
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
            Intelligent log summarization with root cause detection
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {metrics.recentFailures.slice(0, 3).map((failure, index) => {
              const catColor =
                metrics.failureCategories.find((c) => c.category === failure.category)
                  ?.color || theme.palette.text.disabled;

              return (
                <Fade in timeout={1000 + index * 200} key={failure.id}>
                  <Box
                    onClick={() => onSelectFailure(failure)}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: alpha(catColor, 0.5),
                        bgcolor: alpha(catColor, 0.06),
                        boxShadow: `0 2px 8px ${alpha(catColor, 0.12)}`,
                        transform: 'translateX(4px)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 2,
                        backgroundColor: catColor,
                      },
                    }}
                  >
                    <Box sx={{ pl: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="text.primary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            mr: 1.5,
                          }}
                        >
                          {failure.errorMessage}
                        </Typography>
                        <Chip
                          label={categoryLabels[failure.category] || failure.category}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            backgroundColor: alpha(catColor, 0.12),
                            color: catColor,
                            border: `1px solid ${alpha(catColor, 0.2)}`,
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {failure.rootCause || 'Analysis in progress...'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="caption" color="text.disabled">
                          {(failure.confidence * 100).toFixed(0)}% confidence
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          &middot;
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {failure.similarCount} similar
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          &middot;
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {failure.filePath || failure.testName}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Fade>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
