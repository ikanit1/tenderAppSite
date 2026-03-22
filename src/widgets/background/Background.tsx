import { useMemo } from 'react';
import { FallingStars } from './FallingStars';

const STAR_COUNT = 30;
const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MATRIX_COLUMNS_PER_SIDE = 4;

export function Background() {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, idx) => ({
        id: idx,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 3}s`,
        duration: `${Math.random() * 2 + 2}s`,
      })),
    []
  );

  const columns = useMemo(
    () =>
      Array.from({ length: MATRIX_COLUMNS_PER_SIDE * 2 }, (_, index) => {
        const isLeftSide = index < MATRIX_COLUMNS_PER_SIDE;
        const offset = isLeftSide ? 2 + index * 4 : 2 + (index - MATRIX_COLUMNS_PER_SIDE) * 4;
        const text = Array.from({ length: 20 }, () =>
          MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        ).join(' ');

        return {
          id: index,
          left: isLeftSide ? `${offset}%` : undefined,
          right: isLeftSide ? undefined : `${offset}%`,
          duration: `${Math.random() * 3 + 5}s`,
          delay: `${Math.random() * 2}s`,
          text,
        };
      }),
    []
  );

  return (
    <>
      <div className="bgLayer" aria-hidden="true">
        {stars.map((star) => (
          <span
            key={star.id}
            className="bgStar"
            style={{
              left: star.left,
              top: star.top,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>
      <FallingStars />
      <div className="bgGlowLine" aria-hidden="true" />
      <div className="bgMatrix" aria-hidden="true">
        {columns.map((column) => (
          <div
            key={column.id}
            className="bgMatrixColumn"
            style={{
              left: column.left,
              right: column.right,
              animationDuration: column.duration,
              animationDelay: column.delay,
            }}
          >
            {column.text}
          </div>
        ))}
      </div>
    </>
  );
}
