import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentStatus } from '../deployment-status';

describe('DeploymentStatus', () => {
  it('uses the canonical deployment label', () => {
    render(<DeploymentStatus status="HEALTH_CHECKING" />);

    expect(screen.getByText('Checking health')).toBeTruthy();
  });
});
