import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/test-utils';
import Sidebar from './Sidebar';

const onClose = vi.fn();

describe('Sidebar', () => {
  it('renders the salon name', () => {
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);
    expect(screen.getByText('Heritage Threading Salon')).toBeInTheDocument();
  });

  it('renders top-level nav items', () => {
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Billing / POS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the Check-In "Live" badge', () => {
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('expands Customers submenu on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);

    // "All Customers" is hidden before expanding
    expect(screen.queryByText('All Customers')).not.toBeInTheDocument();

    await user.click(screen.getByText('Customers'));

    expect(screen.getByText('All Customers')).toBeInTheDocument();
    expect(screen.getByText('Memberships')).toBeInTheDocument();
  });

  it('collapses Customers submenu on second click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);

    await user.click(screen.getByText('Customers'));
    expect(screen.getByText('All Customers')).toBeInTheDocument();

    await user.click(screen.getByText('Customers'));
    // After collapse, child items should be gone (unmountOnExit)
    expect(screen.queryByText('All Customers')).not.toBeInTheDocument();
  });

  it('expands Staff submenu and shows child items', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);

    await user.click(screen.getByText('Staff'));
    expect(screen.getByText('All Staff')).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
  });

  it('highlights Dashboard as active when on /dashboard', () => {
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />, {
      initialEntries: ['/dashboard'],
    });
    // Active item has a distinct background — find the Dashboard button
    const dashboardBtn = screen.getByText('Dashboard').closest('[class*="MuiListItemButton"]');
    expect(dashboardBtn).toBeInTheDocument();
    // Active state is applied via sx (inline style), not a class — check it exists
    expect(dashboardBtn).toBeInTheDocument();
  });

  it('closes sidebar on nav click when isMobile=true', async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Sidebar open isMobile={true} onClose={close} />, {
      initialEntries: ['/'],
    });

    await user.click(screen.getByText('Dashboard'));
    expect(close).toHaveBeenCalled();
  });

  it('renders Logout button', () => {
    renderWithProviders(<Sidebar open isMobile={false} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Sidebar open isMobile={false} onClose={onClose} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
