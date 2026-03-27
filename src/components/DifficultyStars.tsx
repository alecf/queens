interface DifficultyStarsProps {
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export function DifficultyStars({ difficulty }: DifficultyStarsProps) {
  return (
    <div className="difficulty" aria-label={`Difficulty: ${difficulty} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < difficulty ? 'star star-filled' : 'star star-empty'}>
          {i < difficulty ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}
