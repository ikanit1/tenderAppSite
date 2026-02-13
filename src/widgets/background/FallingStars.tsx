import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './FallingStars.module.css';

const MIN_SPAWN_INTERVAL_MS = 2500;
const MAX_SPAWN_INTERVAL_MS = 6000;
const STAR_TAIL_LENGTH = 80;
const SIDE_MARGIN_PERCENT = 18;
const ANGLE_FROM_LEFT_MIN = 5;
const ANGLE_FROM_LEFT_MAX = 35;
const ANGLE_FROM_RIGHT_MIN = -35;
const ANGLE_FROM_RIGHT_MAX = -5;
const MAX_STARS = 6;

interface Star {
  id: number;
  x: number;
  angle: number;
  duration: number;
  length: number;
  opacity: number;
}

let starId = 0;

export function FallingStars() {
  const [stars, setStars] = useState<Star[]>([]);
  const spawnTimerRef = useRef<number | null>(null);

  const spawnStar = useCallback(() => {
    const id = ++starId;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? Math.random() * SIDE_MARGIN_PERCENT
      : 100 - SIDE_MARGIN_PERCENT + Math.random() * SIDE_MARGIN_PERCENT;
    const angle = fromLeft
      ? ANGLE_FROM_LEFT_MIN + Math.random() * (ANGLE_FROM_LEFT_MAX - ANGLE_FROM_LEFT_MIN)
      : ANGLE_FROM_RIGHT_MIN + Math.random() * (ANGLE_FROM_RIGHT_MAX - ANGLE_FROM_RIGHT_MIN);

    const nextStar: Star = {
      id,
      x,
      angle,
      duration: 0.9 + Math.random() * 0.4,
      length: STAR_TAIL_LENGTH + Math.random() * 40,
      opacity: 0.4 + Math.random() * 0.6,
    };

    setStars((prev) => {
      const next = [...prev, nextStar];
      return next.length > MAX_STARS ? next.slice(-MAX_STARS) : next;
    });
  }, []);

  useEffect(() => {
    const scheduleNext = () => {
      const delay =
        MIN_SPAWN_INTERVAL_MS + Math.random() * (MAX_SPAWN_INTERVAL_MS - MIN_SPAWN_INTERVAL_MS);
      spawnTimerRef.current = window.setTimeout(() => {
        spawnStar();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      if (spawnTimerRef.current) {
        window.clearTimeout(spawnTimerRef.current);
      }
    };
  }, [spawnStar]);

  const handleAnimationEnd = useCallback((id: number) => {
    setStars((prev) => prev.filter((star) => star.id !== id));
  }, []);

  return (
    <div className={styles.layer} aria-hidden="true">
      {stars.map((star) => (
        <div
          key={star.id}
          className={styles.star}
          style={
            {
              '--star-x': `${star.x}%`,
              '--star-angle': `${star.angle}deg`,
              '--star-duration': `${star.duration}s`,
              '--star-length': `${star.length}px`,
              '--star-opacity': star.opacity,
            } as CSSProperties
          }
          onAnimationEnd={() => handleAnimationEnd(star.id)}
        >
          <span className={styles.head} />
          <span className={styles.tail} />
        </div>
      ))}
    </div>
  );
}
