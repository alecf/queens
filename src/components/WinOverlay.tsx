import type { BoardSize } from '../lib/types';

interface WinOverlayProps {
  elapsed: number;
  isNewBest: boolean;
  onNewGame: (size: BoardSize) => void;
  onShare: () => void;
  currentSize: BoardSize;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WinOverlay({
  elapsed,
  isNewBest,
  onNewGame,
  onShare,
  currentSize,
}: WinOverlayProps) {
  return (
    <div className="win-overlay" role="dialog" aria-modal="true" aria-label="Puzzle complete">
      <div className="win-content">
        <div className="win-confetti" aria-hidden="true">🎉</div>
        <h2 className="win-title">Puzzle Complete!</h2>
        <p className="win-time">{formatTime(elapsed)}</p>
        {isNewBest && <p className="win-best">New best time!</p>}
        <div className="win-actions">
          <button className="win-btn win-btn-primary" onClick={() => onNewGame(currentSize)}>
            New Puzzle
          </button>
          <button className="win-btn" onClick={onShare}>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
