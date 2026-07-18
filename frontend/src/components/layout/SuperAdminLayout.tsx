import React, { useState } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Chip, AppBar, Toolbar, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard, Store, CreditCard, ToggleOn, BarChart, Settings,
  People, Notifications, Logout, Menu as MenuIcon, AdminPanelSettings,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';

const DRAWER_WIDTH = 256;

const NAV = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/admin/dashboard' },
  { label: 'Salons', icon: <Store />, path: '/admin/salons' },
  { label: 'Subscription Plans', icon: <CreditCard />, path: '/admin/plans' },
  { label: 'Feature Toggles', icon: <ToggleOn />, path: '/admin/features' },
  { label: 'Global Reports', icon: <BarChart />, path: '/admin/reports' },
  { label: 'Users', icon: <People />, path: '/admin/users' },
  { label: 'Notifications Config', icon: <Notifications />, path: '/admin/notifications' },
  { label: 'Settings', icon: <Settings />, path: '/admin/settings' },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const handleNav = (path: string) => {
    navigate(path);
    onClose?.();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1A1A2E' }}>
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#E94560', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AdminPanelSettings sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            Super Admin
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
            SaaS Management Console
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2 }} />

      {/* User */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#E94560', fontSize: 13, flexShrink: 0 }}>
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Chip label="Super Admin" size="small" sx={{ bgcolor: '#E94560', color: '#fff', fontSize: 9, height: 16, mt: 0.25 }} />
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2, mb: 1 }} />

      {/* Nav */}
      <List sx={{ flex: 1, overflowY: 'auto', pb: 0 }}>
        {NAV.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                onClick={() => handleNav(item.path)}
                sx={{
                  pl: 2, py: 0.9, mx: 1, borderRadius: 2,
                  bgcolor: active ? 'rgba(233,69,96,0.2)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  borderLeft: active ? '3px solid #E94560' : '3px solid transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' },
                }}
              >
                <ListItemIcon sx={{ color: active ? '#E94560' : 'inherit', minWidth: 34 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2 }} />
      <List disablePadding sx={{ mb: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => dispatch(logout())}
            sx={{ pl: 2, py: 0.9, mx: 1, borderRadius: 2, color: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'rgba(255,100,100,0.15)', color: '#FF6B6B' } }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}><Logout /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 13.5 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}

export default function SuperAdminLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F4F6F9' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
          }}
        >
          <SidebarContent />
        </Drawer>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </Drawer>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {isMobile && (
          <AppBar position="static" sx={{ bgcolor: '#1A1A2E', boxShadow: 'none' }}>
            <Toolbar>
              <IconButton color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" fontWeight={700}>Super Admin</Typography>
            </Toolbar>
          </AppBar>
        )}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
