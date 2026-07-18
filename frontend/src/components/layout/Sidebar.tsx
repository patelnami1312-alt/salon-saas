import React, { useState, useMemo } from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, Avatar, Divider, Collapse, Chip, Tooltip,
} from '@mui/material';
import {
  Dashboard, People, ContentCut, CalendarMonth, PointOfSale,
  Inventory2, BarChart, Notifications, Settings, ExpandLess, ExpandMore,
  Store, ManageAccounts, HowToReg, StarBorder, Campaign,
  ShoppingCart, Assignment, SupervisorAccount, Logout, CardGiftcard,
  AttachMoney, Loyalty, AutoAwesome,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { useSalon } from '@/context/SalonContext';

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  icon: React.ReactElement;
  path?: string;
  children?: NavItem[];
  roles?: string[];
  badge?: string;
}

// roles: which roles can see this item. Omit = everyone sees it.
const navItems: NavItem[] = [
  {
    label: 'Billing / POS', icon: <PointOfSale />, path: '/billing',
    roles: ['super_admin', 'salon_owner', 'branch_manager', 'receptionist'],
  },
  { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  {
    label: 'Appointments', icon: <CalendarMonth />, path: '/appointments',
    roles: ['super_admin', 'salon_owner', 'branch_manager', 'receptionist', 'staff'],
  },
  {
    label: 'Check-In', icon: <HowToReg />, path: '/checkin', badge: 'Live',
    roles: ['super_admin', 'salon_owner', 'branch_manager', 'receptionist'],
  },
  {
    label: 'Customers', icon: <People />,
    roles: ['super_admin', 'salon_owner', 'branch_manager', 'receptionist'],
    children: [
      { label: 'All Customers', icon: <People />, path: '/customers' },
      { label: 'Memberships', icon: <StarBorder />, path: '/customers/memberships' },
      { label: 'Loyalty', icon: <Loyalty />, path: '/loyalty' },
      { label: 'Gift Cards', icon: <CardGiftcard />, path: '/gift-cards' },
    ],
  },
  {
    label: 'Staff', icon: <ManageAccounts />,
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
    children: [
      { label: 'All Staff', icon: <ManageAccounts />, path: '/staff' },
      { label: 'Attendance', icon: <Assignment />, path: '/staff/attendance' },
      { label: 'Commissions', icon: <AttachMoney />, path: '/staff/commissions' },
      { label: 'Payroll', icon: <Assignment />, path: '/staff/payroll' },
    ],
  },
  {
    label: 'Services', icon: <ContentCut />,
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
    children: [
      { label: 'Service List', icon: <ContentCut />, path: '/services' },
      { label: 'Categories', icon: <Store />, path: '/services/categories' },
      { label: 'Packages', icon: <ShoppingCart />, path: '/services/packages' },
    ],
  },
  {
    label: 'Waitlist', icon: <HowToReg />, path: '/waitlist',
    roles: ['super_admin', 'salon_owner', 'branch_manager', 'receptionist'],
  },
  {
    label: 'Locations', icon: <Store />, path: '/locations',
    roles: ['super_admin', 'salon_owner'],
  },
  {
    label: 'Inventory', icon: <Inventory2 />,
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
    children: [
      { label: 'Products', icon: <Inventory2 />, path: '/inventory/products' },
      { label: 'Stock', icon: <Inventory2 />, path: '/inventory/stock' },
      { label: 'Purchase Orders', icon: <ShoppingCart />, path: '/inventory/orders' },
      { label: 'Suppliers', icon: <Store />, path: '/inventory/suppliers' },
    ],
  },
  {
    label: 'Marketing', icon: <Campaign />, path: '/marketing',
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
  },
  {
    label: 'Automation', icon: <Notifications />, path: '/automation',
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
  },
  {
    label: 'Reports', icon: <BarChart />,
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
    children: [
      { label: 'Revenue', icon: <BarChart />, path: '/reports/revenue' },
      { label: 'Staff Performance', icon: <SupervisorAccount />, path: '/reports/staff' },
      { label: 'Services', icon: <ContentCut />, path: '/reports/services' },
      { label: 'Customers', icon: <People />, path: '/reports/customers' },
      { label: 'Inventory', icon: <Inventory2 />, path: '/reports/inventory' },
    ],
  },
  {
    label: 'Notifications', icon: <Notifications />, path: '/notifications',
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
  },
  {
    label: 'AI Features', icon: <AutoAwesome />, path: '/ai',
    roles: ['super_admin', 'salon_owner', 'branch_manager'],
    badge: 'New',
  },
  {
    label: 'Settings', icon: <Settings />, path: '/settings',
    roles: ['super_admin', 'salon_owner'],
  },
];

function filterByRole(items: NavItem[], roleCode: string): NavItem[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(roleCode))
    .map((item) =>
      item.children
        ? { ...item, children: filterByRole(item.children, roleCode) }
        : item
    )
    .filter((item) => !item.children || item.children.length > 0);
}

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, isMobile, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { settings } = useSalon();
  const salonName = settings.salon_name || 'Salon';

  const roleCode = user?.role_code ?? 'staff';
  const visibleItems = useMemo(() => filterByRole(navItems, roleCode), [roleCode]);

  const derivedExpanded = useMemo(
    () => visibleItems.find((item) =>
      item.children?.some((child) => child.path && location.pathname.startsWith(child.path))
    )?.label ?? null,
    [location.pathname, visibleItems]
  );

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isExpanded = (label: string): boolean => {
    if (label === derivedExpanded) return true;
    return overrides[label] ?? false;
  };

  const handleToggle = (label: string) => {
    setOverrides((prev) => ({ ...prev, [label]: !isExpanded(label) }));
  };

  const isActive = (path?: string) => path && location.pathname.startsWith(path);

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const renderItems = (items: NavItem[], depth = 0) =>
    items.map((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((c) => c.path && location.pathname.startsWith(c.path));
        const expanded = isExpanded(item.label);
        return (
          <React.Fragment key={item.label}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleToggle(item.label)}
                sx={{
                  pl: depth === 0 ? 2 : 4, py: 1, mx: 1, borderRadius: 2,
                  color: hasActiveChild ? '#fff' : 'rgba(255,255,255,0.8)',
                  bgcolor: hasActiveChild ? 'rgba(255,255,255,0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' },
                }}
              >
                <ListItemIcon sx={{ color: hasActiveChild ? '#9B72E8' : 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: hasActiveChild ? 600 : 500 }} />
                {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <List disablePadding>{renderItems(item.children, depth + 1)}</List>
            </Collapse>
          </React.Fragment>
        );
      }

      const active = isActive(item.path);
      return (
        <ListItem key={item.label} disablePadding>
          <ListItemButton
            onClick={() => item.path && handleNav(item.path)}
            sx={{
              pl: depth === 0 ? 2 : 4, py: 1, mx: 1, borderRadius: 2,
              bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.75)',
              borderLeft: active ? '3px solid #9B72E8' : '3px solid transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' },
            }}
          >
            <ListItemIcon sx={{ color: active ? '#9B72E8' : 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
            {item.badge && (
              <Chip label={item.badge} size="small" sx={{ bgcolor: '#FF6B6B', color: '#fff', fontSize: 10, height: 18 }} />
            )}
          </ListItemButton>
        </ListItem>
      );
    });

  const drawerContent = (
    <>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#9B72E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ContentCut sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Tooltip title={salonName} placement="right" arrow>
          <Box sx={{ overflow: 'hidden', cursor: 'default' }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {salonName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>
              Management Platform
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: '#6C3FC5', fontSize: 14, flexShrink: 0 }}>
          {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}{user?.last_name?.[0] || ''}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
            {user?.role_name}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2, mb: 1 }} />

      <List sx={{ flex: 1, overflowY: 'auto', pb: 0 }}>
        {renderItems(visibleItems)}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      <List disablePadding sx={{ mb: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => dispatch(logout())}
            sx={{ pl: 2, py: 1, mx: 1, borderRadius: 2, color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,100,100,0.15)', color: '#FF6B6B' } }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}><Logout /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 14 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
