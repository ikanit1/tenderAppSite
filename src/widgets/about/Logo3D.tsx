import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import styles from './Logo3D.module.css';

function RotatingLogo() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  const brightMaterial = (
    <meshStandardMaterial
      color="#D4A5FF"
      metalness={0.3}
      roughness={0.2}
      emissive="#9D4EDD"
      emissiveIntensity={1.2}
    />
  );

  return (
    <group ref={groupRef}>
      {/* Буква G - упрощенная геометрия */}
      <group position={[-0.35, 0, 0]}>
        {/* Внешний круг G (более толстый) */}
        <mesh>
          <torusGeometry args={[0.3, 0.1, 16, 32, Math.PI * 1.6]} />
          {brightMaterial}
        </mesh>
        {/* Горизонтальная линия G */}
        <mesh position={[0.08, 0, 0]}>
          <boxGeometry args={[0.2, 0.1, 0.1]} />
          {brightMaterial}
        </mesh>
      </group>

      {/* Буква R - упрощенная геометрия */}
      <group position={[0.35, 0, 0]}>
        {/* Вертикальная линия R */}
        <mesh position={[-0.15, 0, 0]}>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          {brightMaterial}
        </mesh>
        {/* Верхний полукруг R */}
        <mesh position={[-0.05, 0.15, 0]}>
          <torusGeometry args={[0.12, 0.1, 16, 32, Math.PI]} />
          {brightMaterial}
        </mesh>
        {/* Диагональная линия R */}
        <mesh position={[0.08, -0.15, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.22, 0.1, 0.1]} />
          {brightMaterial}
        </mesh>
      </group>

      {/* Улучшенное освещение */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
      <directionalLight position={[-5, 5, -5]} intensity={1} />
      <pointLight position={[0, 0, 3]} intensity={1.5} color="#D4A5FF" />
      <pointLight position={[-2, 2, 2]} intensity={1} color="#9D4EDD" />
      <pointLight position={[2, -2, 2]} intensity={1} color="#9D4EDD" />
    </group>
  );
}

export function Logo3D() {
  return (
    <motion.div
      className={styles.logo3d}
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 60 }}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.5 }}
      >
        <Suspense fallback={null}>
          <RotatingLogo />
        </Suspense>
      </Canvas>
    </motion.div>
  );
}
