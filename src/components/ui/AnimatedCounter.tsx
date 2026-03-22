import { useEffect, useRef, useState } from 'react';
import { formatKzt } from '@/lib/calculations';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: 'currency' | 'number';
  className?: string;
}

export function AnimatedCounter({ value, duration = 0.8, format = 'currency', className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = value;
    if (startValue === endValue) return;

    const startTime = performance.now();
    const durationMs = Math.max(0, duration * 1000);
    let frameId = 0;

    // Smooth ease-out without GSAP to keep CSP strict (no unsafe-eval dependency).
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const progress = durationMs > 0 ? Math.min(1, (now - startTime) / durationMs) : 1;
      const eased = easeOutCubic(progress);
      const next = Math.round(startValue + (endValue - startValue) * eased);
      setDisplay(next);
      if (progress < 1) frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [value, duration]);

  useEffect(() => {
    previousValueRef.current = display;
  }, [display]);

  const text = format === 'currency' ? formatKzt(display) : display.toLocaleString('ru-KZ');
  return <span ref={ref} className={className} style={{ fontFamily: 'var(--calc-font-mono)' }}>{text}</span>;
}
