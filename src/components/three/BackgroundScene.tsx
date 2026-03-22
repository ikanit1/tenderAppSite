/**
 * Декоративный 3D-фон калькулятора — Three.js (без тяжёлого постпроцессинга).
 *
 * Рендерится ТОЛЬКО внутри калькулятора (не глобально), поэтому
 * при переходе между страницами Canvas корректно размонтируется.
 */
import { Suspense, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { ParticleField } from './ParticleField';
import { BuildingModel } from './BuildingModel';

/* ── Определение производительности устройства ────────────── */

function useLowPerf() {
  const [low, setLow] = useState(false);
  useEffect(() => {
    const cores =
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    setLow(cores < 4 || window.innerWidth < 768);
  }, []);
  return low;
}

/* ── Содержимое сцены ─────────────────────────────────────── */

function SceneContent({
  buildingFloors,
  lowPerf,
}: {
  buildingFloors: number;
  lowPerf: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.targetX =
        (e.clientX / window.innerWidth - 0.5) * 0.5;
      mouseRef.current.targetY =
        (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    const m = mouseRef.current;
    m.x += (m.targetX - m.x) * 0.02;
    m.y += (m.targetY - m.y) * 0.02;
    if (groupRef.current) {
      groupRef.current.rotation.y = m.x;
      groupRef.current.rotation.x = m.y * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#9d4edd" />
      <pointLight position={[-10, -10, 5]} intensity={0.3} color="#b184e5" />
      {!lowPerf && <ParticleField />}
      <BuildingModel floors={buildingFloors} />
    </group>
  );
}

/* ── Основной компонент ───────────────────────────────────── */

export function BackgroundScene({
  buildingFloors = 0,
}: {
  buildingFloors?: number;
}) {
  const lowPerf = useLowPerf();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 25], fov: 60 }}
        dpr={lowPerf ? 1 : Math.min(1.5, window.devicePixelRatio)}
        gl={{
          alpha: true,
          antialias: !lowPerf,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost — prevented default');
          });
        }}
      >
        <Suspense fallback={null}>
          <SceneContent
            buildingFloors={buildingFloors}
            lowPerf={lowPerf}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
