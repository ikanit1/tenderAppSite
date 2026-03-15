import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BuildingModelProps {
  floors: number;
}

export function BuildingModel({ floors }: BuildingModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const h = Math.max(2, Math.min(20, floors)) * 0.8;
  const w = 4;
  const d = 3;

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d), 15);

  return (
    <group ref={groupRef} position={[12, h / 2, -8]}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#9d4edd" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}
