import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiClientError } from '@/lib/api-client';
import { RegisterForm } from '../register-form';

const { replace, register } = vi.hoisted(() => ({
  replace: vi.fn(),
  register: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/services/auth.api', () => ({
  authApi: {
    register,
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('RegisterForm', () => {
  it('requires the repeated password to match', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Email'), 'new@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
    await user.type(screen.getByLabelText('Repeat password'), 'a-different-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than eight characters', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Email'), 'new@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Repeat password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('reports a closed registration instead of a generic failure', async () => {
    const user = userEvent.setup();
    register.mockRejectedValueOnce(
      new ApiClientError('Registration is closed.', 'REGISTRATION_CLOSED', 403, 'test'),
    );
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Email'), 'new@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Registration is closed for this workspace.')).toBeTruthy();
  });

  it('sends the user to the sign in page after a successful registration', async () => {
    const user = userEvent.setup();
    register.mockResolvedValueOnce({
      user: { id: 'user-2', email: 'new@ogulix.test', role: 'USER' },
    });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Email'), 'new@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login?registered=1');
    });
  });
});
