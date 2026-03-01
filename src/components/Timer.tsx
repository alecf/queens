interface TimerProps {
  elapsed: number;
  bestTime: number | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeMs(ms: number): string {
  return formatTime(Math.floor(ms / 1000));
}

export function Timer({ elapsed, bestTime }: TimerProps) {
  return (
    <div className="timer">
      <span className="timer-value">{formatTime(elapsed)}</span>
      {bestTime !== null && (
        <span className="timer-best">Best: {formatTimeMs(bestTime)}</span>
      )}
    </div>
  );
}
