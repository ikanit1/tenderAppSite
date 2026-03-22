import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import styles from './TrustBadge3D.module.css';

const badgeTypes = {
  delivery: 'delivery',
  quality: 'quality',
  payment: 'payment',
  support: 'support',
};

function BadgeMesh({ type }) {
  const groupRef = useRef(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.1;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
    }
  });

  const material = (
    <meshStandardMaterial
      color="#9D4EDD"
      metalness={0.7}
      roughness={0.3}
      emissive="#9D4EDD"
      emissiveIntensity={0.8}
    />
  );

  const brightMaterial = (
    <meshStandardMaterial
      color="#D4A5FF"
      metalness={0.5}
      roughness={0.2}
      emissive="#9D4EDD"
      emissiveIntensity={1}
    />
  );

  switch (type) {
    case badgeTypes.delivery:
      // Грузовик - коробка с колесами
      return (
        <group ref={groupRef}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.4, 0.3, 0.3]} />
            {material}
          </mesh>
          <mesh position={[-0.15, -0.1, 0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            {brightMaterial}
          </mesh>
          <mesh position={[0.15, -0.1, 0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            {brightMaterial}
          </mesh>
          <mesh position={[-0.15, -0.1, -0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            {brightMaterial}
          </mesh>
          <mesh position={[0.15, -0.1, -0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            {brightMaterial}
          </mesh>
        </group>
      );

    case badgeTypes.quality:
      // Галочка
      return (
        <group ref={groupRef}>
          <mesh position={[0, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.3, 0.08, 0.08]} />
            {brightMaterial}
          </mesh>
          <mesh position={[-0.1, -0.15, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.2, 0.08, 0.08]} />
            {brightMaterial}
          </mesh>
        </group>
      );

    case badgeTypes.payment:
      // Банковская карта
      return (
        <group ref={groupRef}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.35, 0.25, 0.02]} />
            {material}
          </mesh>
          <mesh position={[-0.1, 0.05, 0.015]}>
            <boxGeometry args={[0.2, 0.05, 0.01]} />
            {brightMaterial}
          </mesh>
          <mesh position={[-0.1, -0.05, 0.015]}>
            <boxGeometry args={[0.15, 0.03, 0.01]} />
            {brightMaterial}
          </mesh>
        </group>
      );

    case badgeTypes.support:
      // Телефон
      return (
        <group ref={groupRef}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.25, 0.45, 0.05]} />
            {material}
          </mesh>
          <mesh position={[0, 0.15, 0.03]}>
            <boxGeometry args={[0.2, 0.15, 0.01]} />
            {brightMaterial}
          </mesh>
          <mesh position={[0, -0.15, 0.03]}>
            <cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />
            {brightMaterial}
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

export function TrustBadge3D({ type, text }) {
  return (
    <motion.div
      className={styles.trustBadge}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <motion.div
        className={styles.badge3d}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <Canvas
          camera={{ position: [0, 0, 2], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 5, 5]} intensity={1.5} />
            <pointLight position={[0, 0, 3]} intensity={1} color="#9D4EDD" />
            <BadgeMesh type={type} />
          </Suspense>
        </Canvas>
      </motion.div>
      <div className={styles.badgeText}>{text}</div>
    </motion.div>
  );
}

export { badgeTypes };
