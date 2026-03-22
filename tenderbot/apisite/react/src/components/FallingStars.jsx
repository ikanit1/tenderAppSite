import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_SPAWN_INTERVAL_MS = 2500;
const MAX_SPAWN_INTERVAL_MS = 6000;
const STAR_TAIL_LENGTH = 80;
const SIDE_MARGIN_PERCENT = 18;
const ANGLE_FROM_LEFT_MIN = 5;
const ANGLE_FROM_LEFT_MAX = 35;
const ANGLE_FROM_RIGHT_MIN = -35;
const ANGLE_FROM_RIGHT_MAX = -5;
const MAX_STARS = 6;

let starId = 0;

export default function FallingStars() {
  const containerRef = useRef(null);
  const [stars, setStars] = useState([]);
  const spawnTimerRef = useRef(null);

  const spawnStar = useCallback(() => {
    const id = ++starId;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? Math.random() * SIDE_MARGIN_PERCENT
      : (100 - SIDE_MARGIN_PERCENT) + Math.random() * SIDE_MARGIN_PERCENT;
    const angle = fromLeft
      ? ANGLE_FROM_LEFT_MIN + Math.random() * (ANGLE_FROM_LEFT_MAX - ANGLE_FROM_LEFT_MIN)
      : ANGLE_FROM_RIGHT_MIN + Math.random() * (ANGLE_FROM_RIGHT_MAX - ANGLE_FROM_RIGHT_MIN);
    const duration = 0.9 + Math.random() * 0.4;
    const length = STAR_TAIL_LENGTH + Math.random() * 40;
    const opacity = 0.4 + Math.random() * 0.6;

    setStars((prev) => {
      const next = [...prev, { id, x, angle, duration, length, opacity }];
      return next.length > MAX_STARS ? next.slice(-MAX_STARS) : next;
    });
  }, []);

  useEffect(() => {
    function scheduleNext() {
      const delay = MIN_SPAWN_INTERVAL_MS + Math.random() * (MAX_SPAWN_INTERVAL_MS - MIN_SPAWN_INTERVAL_MS);
      spawnTimerRef.current = setTimeout(() => {
        spawnStar();
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    };
  }, [spawnStar]);

  const handleAnimationEnd = useCallback((id) => {
    setStars((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <div
      className="falling-stars-layer"
      ref={containerRef}
      aria-hidden="true"
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="falling-star"
          style={{
            '--star-x': `${star.x}%`,
            '--star-angle': `${star.angle}deg`,
            '--star-duration': `${star.duration}s`,
            '--star-length': `${star.length}px`,
            '--star-opacity': star.opacity,
          }}
          onAnimationEnd={() => handleAnimationEnd(star.id)}
        >
          <span className="falling-star-head" />
          <span className="falling-star-tail" />
        </div>
      ))}
    </div>
  );
}
