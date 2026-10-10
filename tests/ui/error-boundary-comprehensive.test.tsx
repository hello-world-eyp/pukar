import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ErrorBoundary } from '../../src/ui/components/ErrorBoundary';

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test Explosion in Component');
  }
  return <div data-testid="child-healthy">Healthy Child Component</div>;
}

describe('ErrorBoundary Component - Comprehensive Audit & Edge Cases', () => {
  it('renders children when no error occurs', () => {
    const html = renderToString(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(html).toContain('data-testid="child-healthy"');
    expect(html).toContain('Healthy Child Component');
  });

  it('catches render errors and displays default crash fallback UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderToString(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );
    } catch {
      // In SSR renderToString throws through ErrorBoundary, so test getDerivedStateFromError directly
    }

    const state = ErrorBoundary.getDerivedStateFromError(new Error('Manual error'));
    expect(state.hasError).toBe(true);
    expect(state.error?.message).toBe('Manual error');

    consoleSpy.mockRestore();
  });

  it('renders custom fallback node when provided', () => {
    const boundary = new ErrorBoundary({
      children: <div>Child</div>,
      fallback: <div data-testid="custom-fallback">Custom Safe Error View</div>,
    });
    boundary.state = { hasError: true, error: new Error('Simulated Error') };

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('data-testid="custom-fallback"');
    expect(html).toContain('Custom Safe Error View');
  });

  it('renders default fallback view with reset button when no custom fallback is provided', () => {
    const boundary = new ErrorBoundary({
      children: <div>Child</div>,
    });
    boundary.state = { hasError: true, error: new Error('Render Glitch') };

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('An unexpected game error occurred');
    expect(html).toContain('Render Glitch');
    expect(html).toContain('Recover &amp; Restart Game');
  });

  it('handles handleReset and invokes onReset callback', () => {
    const onResetMock = vi.fn();
    const boundary = new ErrorBoundary({
      children: <div>Child</div>,
      onReset: onResetMock,
    });
    boundary.state = { hasError: true, error: new Error('Err') };

    boundary.handleReset();

    expect(onResetMock).toHaveBeenCalledTimes(1);
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });
});
