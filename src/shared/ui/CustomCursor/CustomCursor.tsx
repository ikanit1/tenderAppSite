import { useEffect, useState, useRef } from 'react';
import styles from './CustomCursor.module.css';

const INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, [data-cursor-hover]';

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error legacy
    navigator.msMaxTouchPoints > 0
  );
}

function isInteractiveElement(el: Element | null): boolean {
  if (!el || el === document.body) return false;
  return el.matches(INTERACTIVE_SELECTOR);
}

export function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [inputMode, setInputMode] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (isTouchDevice()) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.body.setAttribute('data-custom-cursor', 'true');
    return () => document.body.removeAttribute('data-custom-cursor');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handleMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY });
        setVisible(true);
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const overInteractive = elements.some(isInteractiveElement);
        const overInput = elements.some((el) =>
          el.matches('input, textarea, select')
        );
        setHover(overInteractive);
        setInputMode(overInput);
      });
    };

    const handleDown = () => setActive(true);
    const handleUp = () => setActive(false);
    const handleLeave = () => setVisible(false);

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('mouseleave', handleLeave);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  const className = [
    styles.cursor,
    hover && styles.cursorHover,
    active && styles.cursorActive,
    inputMode && styles.cursorInput,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{
        left: position.x,
        top: position.y,
      }}
      aria-hidden
    />
  );
}
