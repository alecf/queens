import { useState, useCallback } from 'react';
import type { BoardSize } from '../lib/types';

interface ControlsProps {
  currentSize: BoardSize;
  canUndo: boolean;
  canHint: boolean;
  hintCooldownRemaining: number;
  hintsUsed: number;
  isWon: boolean;
  onNewGame: (size: BoardSize) => void;
  onUndo: () => void;
  onHint: () => void;
  onReset: () => void;
  onShare: () => void;
}

const SIZES: BoardSize[] = [5, 6, 7, 8, 9];

export function Controls({
  currentSize,
  canUndo,
  canHint,
  hintCooldownRemaining,
  hintsUsed,
  isWon,
  onNewGame,
  onUndo,
  onHint,
  onReset,
  onShare,
}: ControlsProps) {
  const [showToast, setShowToast] = useState(false);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'Queens Puzzle', url }).catch(() => {
        // Share cancelled or failed, fall back to clipboard
        copyToClipboard(url);
      });
    } else {
      copyToClipboard(url);
    }

    function copyToClipboard(text: string) {
      navigator.clipboard.writeText(text).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    }

    onShare();
  }, [onShare]);

  return (
    <div className="controls">
      <div className="controls-row">
        <div className="size-selector">
          {SIZES.map(s => (
            <button
              key={s}
              className={`size-btn ${s === currentSize ? 'size-btn-active' : ''}`}
              onClick={() => onNewGame(s)}
              aria-label={`New ${s}×${s} game`}
              aria-pressed={s === currentSize}
            >
              {s}×{s}
            </button>
          ))}
        </div>
      </div>

      <div className="controls-row">
        <button className="ctrl-btn" onClick={onUndo} disabled={!canUndo || isWon}>
          Undo
        </button>
        <button
          className="ctrl-btn"
          onClick={onHint}
          disabled={!canHint || isWon}
        >
          {hintCooldownRemaining > 0
            ? `Hint (${hintCooldownRemaining}s)`
            : `Hint${hintsUsed > 0 ? ` (${hintsUsed})` : ''}`}
        </button>
        <button className="ctrl-btn" onClick={onReset} disabled={isWon}>
          Reset
        </button>
        <button className="ctrl-btn" onClick={handleShare}>
          Share
        </button>
      </div>

      {showToast && <div className="toast">Link copied!</div>}
    </div>
  );
}
