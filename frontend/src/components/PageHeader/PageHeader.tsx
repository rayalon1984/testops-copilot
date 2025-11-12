import { ReactNode } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  backButton?: {
    to: string;
    label: string;
  };
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  backButton,
}: PageHeaderProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
          sx={{ mb: 2 }}
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            if (isLast || !item.href) {
              return (
                <Typography
                  key={item.label}
                  color={isLast ? 'text.primary' : 'text.secondary'}
                >
                  {item.label}
                </Typography>
              );
            }

            return (
              <Link
                key={item.label}
                component={RouterLink}
                to={item.href}
                color="inherit"
                underline="hover"
              >
                {item.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Header Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 2,
        }}
      >
        {/* Title Section */}
        <Box sx={{ flex: 1 }}>
          {backButton && (
            <Button
              component={RouterLink}
              to={backButton.to}
              size="small"
              sx={{ mb: 1 }}
              startIcon={<NavigateNextIcon sx={{ transform: 'rotate(180deg)' }} />}
            >
              {backButton.label}
            </Button>
          )}
          <Typography variant="h5" component="h1" gutterBottom={!!subtitle}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="subtitle1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Actions Section */}
        {actions && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              justifyContent: 'flex-end',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
}