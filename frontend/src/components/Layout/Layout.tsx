import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  useTheme,
  useMediaQuery,
  Chip,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PlayArrow as PipelineIcon,
  Assignment as TestRunIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  BugReport as BugReportIcon,
  AttachMoney as CostIcon,
} from '@mui/icons-material';
import { useDesignMode } from '../../contexts/DesignModeContext';

const drawerWidth = 260;

interface NavItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ],
  },
  {
    label: 'Testing',
    items: [
      { text: 'Pipelines', icon: <PipelineIcon />, path: '/pipelines' },
      { text: 'Test Runs', icon: <TestRunIcon />, path: '/test-runs' },
      { text: 'Failure Knowledge Base', icon: <BugReportIcon />, path: '/failure-knowledge-base' },
    ],
  },
  {
    label: 'System',
    items: [
      { text: 'Cost Tracker', icon: <CostIcon />, path: '/cost-tracker' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications' },
      { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ],
  },
];

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode: designMode, colorMode, toggleMode, toggleColorMode } = useDesignMode();

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Area */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.8rem',
              letterSpacing: '-0.05em',
            }}
          >
            TC
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary" lineHeight={1.2}>
              TestOps
            </Typography>
            <Typography variant="caption" color="text.disabled" lineHeight={1}>
              Companion
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.6 }} />

      {/* Navigation Sections */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {navSections.map((section, sectionIndex) => (
          <Box key={section.label} sx={{ mb: sectionIndex < navSections.length - 1 ? 1 : 0 }}>
            <Typography
              variant="caption"
              color="text.disabled"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing="0.08em"
              sx={{ px: 3, py: 1, display: 'block', fontSize: '0.65rem' }}
            >
              {section.label}
            </Typography>
            <List disablePadding sx={{ px: 1.5 }}>
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      onClick={() => handleNavigation(item.path)}
                      sx={{
                        borderRadius: 2,
                        py: 0.9,
                        px: 1.5,
                        minHeight: 40,
                        backgroundColor: active
                          ? alpha(theme.palette.primary.main, 0.1)
                          : 'transparent',
                        color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                        '&:hover': {
                          backgroundColor: active
                            ? alpha(theme.palette.primary.main, 0.14)
                            : alpha(theme.palette.action.hover, 0.6),
                        },
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          color: active ? theme.palette.primary.main : theme.palette.text.disabled,
                          '& .MuiSvgIcon-root': { fontSize: 20 },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: active ? 600 : 400,
                          fontSize: '0.85rem',
                        }}
                      />
                      {active && (
                        <Box
                          sx={{
                            width: 4,
                            height: 20,
                            borderRadius: 2,
                            backgroundColor: theme.palette.primary.main,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.6 }} />

      {/* Bottom: Version & Theme Toggle */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip
          label="v2.8.0"
          size="small"
          variant="outlined"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 500,
            borderColor: alpha(theme.palette.text.disabled, 0.2),
            color: 'text.disabled',
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {designMode === 'modern' && (
            <Tooltip title={colorMode === 'dark' ? 'Light mode' : 'Dark mode'} placement="top">
              <IconButton
                onClick={toggleColorMode}
                size="small"
                sx={{
                  width: 30,
                  height: 30,
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                {colorMode === 'dark' ? (
                  <LightModeIcon sx={{ fontSize: 16 }} />
                ) : (
                  <DarkModeIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 56 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page title based on route */}
          <Typography
            variant="body1"
            fontWeight={500}
            color="text.secondary"
            noWrap
            sx={{ flexGrow: 1 }}
          >
            {navSections
              .flatMap((s) => s.items)
              .find((item) => isActive(item.path))?.text || 'TestOps Companion'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 56 } }} />
        <Outlet />
      </Box>
    </Box>
  );
}
