import React, { useState, Suspense } from 'react';
import {
  Box, AppBar, Toolbar, IconButton, Typography, Badge,
  Menu, MenuItem, Avatar, Tooltip, InputBase, alpha, useMediaQuery,
  Select, FormControl, Chip,
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, Search,
  ChevronRight, LocationOn,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { PageLoader } from '@/routes/AppRoutes';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { useBranch } from '@/context/BranchContext';

const DRAWER_WIDTH = 260;

export default function MainLayout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();

  const handleProfileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const shifted = sidebarOpen && !isMobile;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Sidebar open={sidebarOpen} isMobile={isMobile} onClose={() => setSidebarOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
          width: shifted ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          marginLeft: shifted ? 0 : isMobile ? 0 : `-${DRAWER_WIDTH}px`,
          transition: theme.transitions.create(['width', 'margin-left'], {
            easing: shifted ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
            duration: shifted ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: '#fff',
            borderBottom: '1px solid',
            borderColor: 'divider',
            width: '100%',
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <IconButton
              onClick={() => setSidebarOpen(!sidebarOpen)}
              edge="start"
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            >
              {sidebarOpen ? <ChevronRight /> : <MenuIcon />}
            </IconButton>

            {/* Search */}
            <Box
              sx={{
                position: 'relative',
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                px: 1.5,
                width: 280,
              }}
            >
              <Search sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
              <InputBase
                placeholder="Search customers, appointments…"
                sx={{ fontSize: 14, flex: 1, py: 0.75 }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {/* Branch Selector — only show if multiple branches */}
            {branches.length > 1 && (
              <FormControl size="small" variant="outlined" sx={{ minWidth: 180 }}>
                <Select
                  value={selectedBranchId ?? ''}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  renderValue={(val) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 130 }}>
                        {branches.find(b => b.branch_id === val)?.branch_name ?? 'Select Branch'}
                      </Typography>
                    </Box>
                  )}
                  sx={{ fontSize: 13, borderRadius: 2 }}
                >
                  {branches.map((b) => (
                    <MenuItem key={b.branch_id} value={b.branch_id}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{b.branch_name}</Typography>
                        {b.city && <Typography variant="caption" color="text.secondary">{b.city}</Typography>}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Single branch badge */}
            {branches.length === 1 && selectedBranch && (
              <Chip
                icon={<LocationOn sx={{ fontSize: 14 }} />}
                label={selectedBranch.branch_name}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontSize: 12 }}
              />
            )}

            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton aria-label="View notifications">
                <Badge badgeContent={0} color="error" showZero={false}>
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Profile */}
            <Tooltip title="Account">
              <IconButton onClick={handleProfileMenu}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.primary.main, fontSize: 13 }}>
                  {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}{user?.last_name?.[0] || ''}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2 } }}
            >
              <MenuItem disabled>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{user?.first_name} {user?.last_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>Settings</MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); dispatch(logout()); }} sx={{ color: 'error.main' }}>Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
