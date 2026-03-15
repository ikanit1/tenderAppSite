import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
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

  useEffect(() => {
    gsap.to({ val: display }, { val: value, duration, ease: 'power2.out', onUpdate: function () {
      const v = Math.round((this.targets()[0] as { val: number }).val);
      setDisplay(v);
    } });
  }, [value, duration]);

  const text = format === 'currency' ? formatKzt(display) : display.toLocaleString('ru-KZ');
  return <span ref={ref} className={className} style={{ fontFamily: 'var(--calc-font-mono)' }}>{text}</span>;
}
