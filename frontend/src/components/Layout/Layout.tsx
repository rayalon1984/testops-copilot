import { useState, useEffect } from 'react';
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
  Groups as TeamsIcon,
  Healing as HealingIcon,
  TrackChanges as SmartSelectIcon,
} from '@mui/icons-material';
import { useDesignMode } from '../../contexts/DesignModeContext';
import AICopilot from '../AICopilot/AICopilot';
import TeamSelector from '../TeamSelector/TeamSelector';
import OnboardingWizard from '../OnboardingWizard/OnboardingWizard';

const drawerWidth = 250; // Updated to match Grid

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
      { text: 'Self-Healing', icon: <HealingIcon />, path: '/self-healing' },
      { text: 'Smart Selection', icon: <SmartSelectIcon />, path: '/smart-selection' },
    ],
  },
  {
    label: 'System',
    items: [
      { text: 'Teams', icon: <TeamsIcon />, path: '/teams' },
      { text: 'Cost Tracker', icon: <CostIcon />, path: '/cost-tracker' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications' },
      { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ],
  },
];

function NavItemButton({ item, active, onNavigate }: {
  item: { text: string; icon: React.ReactNode; path: string }; active: boolean; onNavigate: (path: string) => void;
}) {
  const theme = useTheme();
  return (
    <ListItem disablePadding sx={{ mb: 0.25 }}>
      <ListItemButton
        onClick={() => onNavigate(item.path)}
        sx={{
          borderRadius: 2, py: 0.9, px: 1.5, minHeight: 40,
          backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
          color: active ? theme.palette.primary.main : theme.palette.text.secondary,
          '&:hover': { backgroundColor: active ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.text.primary, 0.04) },
          transition: 'all 0.15s ease',
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: active ? theme.palette.primary.main : theme.palette.text.disabled, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
          {item.icon}
        </ListItemIcon>
        <ListItemText primary={item.text} primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 600 : 400, fontSize: '0.85rem' }} />
        {active && <Box sx={{ width: 4, height: 20, borderRadius: 2, backgroundColor: theme.palette.primary.main, flexShrink: 0 }} />}
      </ListItemButton>
    </ListItem>
  );
}

function SidebarContent({
  isMobile,
  onToggle,
  navSections,
  isActive,
  onNavigate,
  designMode,
  colorMode,
  toggleColorMode,
}: {
  isMobile: boolean;
  onToggle: () => void;
  navSections: NavSection[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  designMode: string;
  colorMode: string;
  toggleColorMode: () => void;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          <IconButton onClick={onToggle} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.6 }} />

      <TeamSelector />

      <Divider sx={{ mx: 2, opacity: 0.6 }} />

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, py: 1.5 }}>
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
              {section.items.map((item) => (
                <NavItemButton key={item.text} item={item} active={isActive(item.path)} onNavigate={onNavigate} />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.6 }} />

      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip
          label={`v${__APP_VERSION__}`}
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
}

function LayoutHeader({
  onDrawerToggle,
  navSections,
  isActive,
}: {
  onDrawerToggle: () => void;
  navSections: NavSection[];
  isActive: (path: string) => boolean;
}) {
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
        color: 'text.primary'
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, md: 56 } }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onDrawerToggle}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="subtitle1"
          fontWeight={600}
          color="text.primary"
          noWrap
          sx={{ flexGrow: 1 }}
        >
          {navSections
            .flatMap((s) => s.items)
            .find((item) => isActive(item.path))?.text || 'TestOps Copilot'}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode: designMode, colorMode, toggleColorMode } = useDesignMode();

  // Show onboarding wizard on first visit
  useEffect(() => {
    const completed = localStorage.getItem('onboardingComplete');
    if (!completed) {
      setShowOnboarding(true);
    }
  }, []);

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

  const sidebarProps = {
    isMobile,
    onToggle: handleDrawerToggle,
    navSections,
    isActive,
    onNavigate: handleNavigation,
    designMode,
    colorMode,
    toggleColorMode,
  };

  return (
    <Box
      className="app-container"
      sx={{
        display: { xs: 'block', md: 'grid' }, /* Block on mobile, Grid on desktop */
        gridTemplateColumns: { md: '220px 1fr 340px', lg: '240px 1fr 380px' },
        bgcolor: 'background.default',
        height: '100vh',
        overflow: 'hidden'
      }}
    >
      <CssBaseline />

      {/* 1. Navigation Column */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'block' },
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <SidebarContent {...sidebarProps} />
      </Box>

      {/* Mobile Drawer (Overlay) */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        <SidebarContent {...sidebarProps} />
      </Drawer>

      {/* 2. Main Content Column */}
      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        <LayoutHeader onDrawerToggle={handleDrawerToggle} navSections={navSections} isActive={isActive} />

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Outlet />
        </Box>
      </Box>

      {/* 3. AI Copilot Column (All Desktop Viewports) */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <AICopilot />
      </Box>

      {/* Onboarding Wizard (first visit only) */}
      <OnboardingWizard
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </Box>
  );
}
