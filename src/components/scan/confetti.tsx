const COLORS = ["#f5a623", "#5b3df5", "#eb6834", "#1baf7a", "#e87ba4", "#2a78d6"];

// Deterministic pseudo-random spread (pure render, no Math.random).
const PIECES = Array.from({ length: 36 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  return {
    left: `${Math.round(r(1) * 100)}%`,
    delay: `${(r(2) * 0.8).toFixed(2)}s`,
    duration: `${(2.2 + r(3) * 1.4).toFixed(2)}s`,
    color: COLORS[i % COLORS.length],
    rotate: `${Math.round(r(4) * 360)}deg`,
  };
});

export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="hf-confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}
