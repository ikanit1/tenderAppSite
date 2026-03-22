import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 600;

export function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const speedsRef = useRef<Float32Array | null>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      spd[i * 3] = (Math.random() - 0.5) * 0.015;
      spd[i * 3 + 1] = (Math.random() - 0.5) * 0.015;
      spd[i * 3 + 2] = (Math.random() - 0.5) * 0.015;
    }
    speedsRef.current = spd;
    return pos;
  }, []);

  useFrame(() => {
    const points = pointsRef.current;
    const speeds = speedsRef.current;
    if (!points?.geometry?.attributes?.position || !speeds) return;
    const pos = points.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] += speeds[i * 3];
      pos[i * 3 + 1] += speeds[i * 3 + 1];
      pos[i * 3 + 2] += speeds[i * 3 + 2];
      if (pos[i * 3] > 30) pos[i * 3] = -30;
      if (pos[i * 3] < -30) pos[i * 3] = 30;
      if (pos[i * 3 + 1] > 30) pos[i * 3 + 1] = -30;
      if (pos[i * 3 + 1] < -30) pos[i * 3 + 1] = 30;
      if (pos[i * 3 + 2] > 30) pos[i * 3 + 2] = -30;
      if (pos[i * 3 + 2] < -30) pos[i * 3 + 2] = 30;
    }
    points.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#b184e5"
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
