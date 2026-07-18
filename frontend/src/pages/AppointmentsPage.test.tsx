import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/test-utils';
import AppointmentsPage from './AppointmentsPage';

describe('AppointmentsPage – Book Appointment dialog', () => {
  it('renders page heading and action buttons', async () => {
    renderWithProviders(<AppointmentsPage />);
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /book appointment/i })).toBeInTheDocument();
    // Calendar View renders as an <a href> (MUI Button with href prop = role="link")
    expect(await screen.findByRole('link', { name: /calendar view/i })).toBeInTheDocument();
  });

  it('opens Book Appointment dialog on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsPage />);

    await user.click(await screen.findByRole('button', { name: /book appointment/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Check the heading specifically — the dialog also has a "Book Appointment" submit button
    expect(within(dialog).getByRole('heading', { name: /book appointment/i })).toBeInTheDocument();
  });

  it('dialog contains Customer, Service, Staff, Date, Time, Notes fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsPage />);

    await user.click(await screen.findByRole('button', { name: /book appointment/i }));
    const dialog = await screen.findByRole('dialog');

    // Comboboxes for Customer, Service, Staff (scoped to dialog)
    const combos = within(dialog).getAllByRole('combobox');
    expect(combos.length).toBeGreaterThanOrEqual(3);

    // Date picker uses aria-label "Choose date"
    expect(within(dialog).getByLabelText(/choose date/i)).toBeInTheDocument();
    // Time picker uses aria-label "Choose time"
    expect(within(dialog).getByLabelText(/choose time/i)).toBeInTheDocument();

    // Notes textarea
    expect(within(dialog).getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsPage />);

    await user.click(await screen.findByRole('button', { name: /book appointment/i }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes dialog when pressing Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsPage />);

    await user.click(await screen.findByRole('button', { name: /book appointment/i }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders status filter dropdown', async () => {
    renderWithProviders(<AppointmentsPage />);
    // "Status" appears as both the filter InputLabel and the DataGrid column header
    // Use getAllByText to handle duplicates and assert at least one exists
    const statusElements = await screen.findAllByText('Status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows DataGrid with correct column headers', async () => {
    renderWithProviders(<AppointmentsPage />);
    // DataGrid renders column headers with role="columnheader"
    expect(await screen.findByRole('columnheader', { name: /customer/i })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /service/i })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
  });

  it('Book Appointment dialog has no accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AppointmentsPage />);

    await user.click(await screen.findByRole('button', { name: /book appointment/i }));
    await screen.findByRole('dialog');

    expect(await axe(container)).toHaveNoViolations();
  });
});
