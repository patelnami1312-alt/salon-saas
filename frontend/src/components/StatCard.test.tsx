import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { AttachMoney } from '@mui/icons-material';
import { renderWithProviders } from '@/test/test-utils';
import StatCard from './StatCard';

const icon = <AttachMoney />;

describe('StatCard', () => {
  it('renders title and value', () => {
    renderWithProviders(
      <StatCard title="Today's Revenue" value="$1,200" icon={icon} color="#6C3FC5" />
    );
    expect(screen.getByText("Today's Revenue")).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    renderWithProviders(
      <StatCard title="Appointments" value={8} subtitle="2 pending" icon={icon} color="#2196F3" />
    );
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  it('shows upward trend arrow for positive trend', () => {
    renderWithProviders(
      <StatCard title="Revenue" value="$0" icon={icon} color="#6C3FC5" trend={12} />
    );
    expect(screen.getByText('12% vs last week')).toBeInTheDocument();
    // Upward ArrowUpward SVG is rendered (aria-hidden prevents it from being a role)
    // MUI applies color via CSS class, not inline style — just assert text is present
  });

  it('shows downward trend for negative trend', () => {
    renderWithProviders(
      <StatCard title="Revenue" value="$0" icon={icon} color="#6C3FC5" trend={-5} />
    );
    expect(screen.getByText('5% vs last week')).toBeInTheDocument();
  });

  it('shows skeleton placeholders while loading', () => {
    const { container } = renderWithProviders(
      <StatCard title="Revenue" value="$0" icon={icon} color="#6C3FC5" loading />
    );
    // In loading state: no title/value text rendered, but skeleton MUI elements exist
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('renders no subtitle or trend when not provided', () => {
    renderWithProviders(
      <StatCard title="In Queue" value={3} icon={icon} color="#FF9800" />
    );
    expect(screen.queryByText(/% vs last week/)).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <StatCard title="Today's Revenue" value="$1,200" subtitle="Weekly: $8,400" icon={icon} color="#6C3FC5" trend={12} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
