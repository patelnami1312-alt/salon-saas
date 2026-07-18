import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/msw-server';
import CustomersPage from './CustomersPage';

describe('CustomersPage – Add Customer dialog', () => {
  it('renders page heading and Add Customer button', async () => {
    renderWithProviders(<CustomersPage />);
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /add customer/i })).toBeInTheDocument();
  });

  it('opens the Add Customer dialog on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await user.click(await screen.findByRole('button', { name: /add customer/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add New Customer')).toBeInTheDocument();
  });

  it('closes the dialog on Cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    // Submit without filling any fields
    await user.click(screen.getByRole('button', { name: /add customer/i, hidden: false }));

    // Zod validation shows "Required" on multiple empty required fields
    const errors = await screen.findAllByText(/required/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('shows mobile validation error for short mobile number', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/mobile number/i), '123'); // too short (< 7 chars)

    await user.click(screen.getByRole('button', { name: /^add customer$/i }));

    expect(await screen.findByText(/valid phone required/i)).toBeInTheDocument();
  });

  it('submits the form with valid data and calls POST /api/v1/customers', async () => {
    const user = userEvent.setup();
    let captured: unknown;

    server.use(
      http.post('/api/v1/customers', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ customer_id: 99, first_name: 'Jane', last_name: 'Doe' }, { status: 201 });
      })
    );

    renderWithProviders(<CustomersPage />);
    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/mobile number/i), '5550001234');

    await user.click(screen.getByRole('button', { name: /^add customer$/i }));

    // Dialog should close after successful submission
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(captured).toMatchObject({
      first_name: 'Jane',
      last_name: 'Doe',
      mobile: '5550001234',
    });
  });

  it('submit button shows "Adding…" while mutation is in-flight', async () => {
    const user = userEvent.setup();

    // Delay the response to observe loading state
    server.use(
      http.post('/api/v1/customers', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json({ customer_id: 99 }, { status: 201 });
      })
    );

    renderWithProviders(<CustomersPage />);
    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/mobile number/i), '5550001234');

    await user.click(screen.getByRole('button', { name: /^add customer$/i }));

    // While loading, submit button should be disabled and say "Adding…"
    expect(await screen.findByRole('button', { name: /adding/i })).toBeDisabled();
  });

  it('Add Customer dialog has no accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CustomersPage />);

    await user.click(await screen.findByRole('button', { name: /add customer/i }));
    await screen.findByRole('dialog');

    expect(await axe(container)).toHaveNoViolations();
  });
});
