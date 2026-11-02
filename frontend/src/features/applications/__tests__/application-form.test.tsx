import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationForm } from '../application-form';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/services/applications.api', () => ({
  applicationsApi: {
    create,
    update: vi.fn(),
  },
}));

describe('ApplicationForm', () => {
  it('rejects a repository URL that is not HTTPS without calling the API', async () => {
    const user = userEvent.setup();
    render(<ApplicationForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText('Application name'), 'web');
    await user.type(screen.getByLabelText('Public HTTPS repository'), 'http://github.com/org/web');
    await user.type(screen.getByLabelText('Default branch'), 'main');
    await user.click(screen.getByRole('button', { name: 'Create application' }));

    expect(await screen.findByText('Only the https protocol is supported')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });
});
