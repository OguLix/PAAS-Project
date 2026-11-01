import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiClientError } from '@/lib/api-client';
import { LoginForm } from '../login-form';

const { replace, refresh, login } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  login: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
}));

vi.mock('@/services/auth.api', () => ({
  authApi: {
    login,
    me: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('LoginForm', () => {
  it('reports both empty fields without calling the API', async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/dashboard" />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Email is required')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address', async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret-value');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('explains rejected credentials instead of claiming the session expired', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(
      new ApiClientError('Email or password is incorrect.', 'UNAUTHENTICATED', 401, 'test'),
    );
    render(<LoginForm nextPath="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'demo@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
    expect(screen.queryByText('Your session has ended. Sign in again.')).toBeNull();
  });

  it('reports an unreachable API without pretending the credentials failed', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<LoginForm nextPath="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'demo@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'ogulix-demo-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Cannot reach the API. Check your connection and try again.'),
    ).toBeTruthy();
  });

  it('opens the validated destination after a successful sign in', async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'demo@ogulix.test', role: 'USER' },
    });
    render(<LoginForm nextPath="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'demo@ogulix.test');
    await user.type(screen.getByLabelText('Password'), 'ogulix-demo-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
