import { useEffect } from 'react';
import FallingStars from './FallingStars';

const isInIframe =
  typeof window !== 'undefined' &&
  (window !== window.parent ||
    new URLSearchParams(window.location.search).get('embedded') === '1');

export default function Background() {
  if (isInIframe) return null;
  useEffect(() => {
    // Starfield
    const starfield = document.getElementById('starfield');
    if (starfield) {
      const starCount = 30;
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (Math.random() * 2 + 2) + 's';
        fragment.appendChild(star);
      }
      starfield.appendChild(fragment);
    }

    // Matrix code — только по левому и правому краям, не по центру
    const matrixCode = document.getElementById('matrixCode');
    if (matrixCode) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const columnsPerSide = 4;
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < columnsPerSide * 2; i++) {
        const column = document.createElement('div');
        column.className = 'matrix-column';
        if (i < columnsPerSide) {
          column.style.left = (2 + i * 4) + '%';
        } else {
          column.style.right = (2 + (i - columnsPerSide) * 4) + '%';
          column.style.left = 'auto';
        }
        column.style.animationDuration = (Math.random() * 3 + 5) + 's';
        column.style.animationDelay = Math.random() * 2 + 's';
        let text = '';
        for (let j = 0; j < 20; j++) {
          text += chars[Math.floor(Math.random() * chars.length)] + '<br>';
        }
        column.innerHTML = text;
        fragment.appendChild(column);
      }
      matrixCode.appendChild(fragment);
    }
  }, []);

  return (
    <>
      <div className="starfield" id="starfield"></div>
      <FallingStars />
      <div className="glow-line"></div>
      <div className="matrix-code" id="matrixCode"></div>
    </>
  );
}
