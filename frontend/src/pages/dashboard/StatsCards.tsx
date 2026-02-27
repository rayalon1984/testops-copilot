import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Grow,
  useTheme,
  alpha,
} from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';

interface StatCard {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

export default function StatsCards({ statCards }: { statCards: StatCard[] }) {
  const theme = useTheme();
  return (
    <Grid container spacing={2.5} sx={{ mb: 4 }}>
      {statCards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={card.label}>
          <Grow in timeout={500 + index * 100}>
            <Card
              sx={{
                cursor: card.onClick ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.25s ease',
                '&:hover': card.onClick
                  ? {
                    transform: 'translateY(-4px)',
                    borderColor: alpha(card.color, 0.3),
                    boxShadow: `0 8px 24px ${alpha(card.color, 0.12)}`,
                  }
                  : {},
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: card.color,
                  borderRadius: '3px 0 0 3px',
                },
              }}
              onClick={card.onClick}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={500}
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {card.label}
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      color="text.primary"
                      sx={{ mb: 0.75, lineHeight: 1.1 }}
                    >
                      {card.value}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {card.trendUp && (
                        <TrendingUpIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {card.trend}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(card.color, 0.1),
                      color: card.color,
                      flexShrink: 0,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      ))}
    </Grid>
  );
}
