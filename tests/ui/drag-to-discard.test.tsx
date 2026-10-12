import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { Card } from '../../src/engine/types';

describe('CenterTable Drag-to-Discard onto Discard Pile', () => {
  const mockDiscardCard: Card = { id: 'd-1', suit: 'HEARTS', rank: 10 };

  it('renders discard pile drop zone with drop listeners enabled when canDropToDiscard is true', () => {
    const html = renderToString(
      <CenterTable
        discardPile={[mockDiscardCard]}
        canDropToDiscard={true}
        onDropToDiscard={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="discard-pile-drop-zone"');
    expect(html).toContain('aria-label="Discard Pile"');
  });

  it('does not render release-to-discard banner initially before drag enter', () => {
    const html = renderToString(
      <CenterTable
        discardPile={[mockDiscardCard]}
        canDropToDiscard={true}
        onDropToDiscard={vi.fn()}
      />
    );

    expect(html).not.toContain('Release to Discard');
  });

  it('correctly passes onDropToDiscard and canDropToDiscard props without errors', () => {
    const onDropMock = vi.fn();
    const html = renderToString(
      <CenterTable
        discardPile={[mockDiscardCard]}
        canDropToDiscard={false}
        onDropToDiscard={onDropMock}
      />
    );

    expect(html).toContain('data-testid="discard-pile-drop-zone"');
    expect(onDropMock).not.toHaveBeenCalled();
  });
});
