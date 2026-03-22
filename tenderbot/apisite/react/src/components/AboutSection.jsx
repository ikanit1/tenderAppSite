import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import styles from './AboutSection.module.css';

// 3D геометрия - вращающийся куб
function RotatingBox({ position, color, speed = 1 }) {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * speed;
      meshRef.current.rotation.y += delta * speed * 0.5;
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

// Плавающая сфера
function FloatingSphere({ position, color, speed = 1 }) {
  const meshRef = useRef();
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

// Вращающийся тор
function RotatingTorus({ position, color, speed = 1 }) {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * speed;
      meshRef.current.rotation.z += delta * speed * 0.7;
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <torusGeometry args={[0.6, 0.2, 16, 100]} />
      <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
    </mesh>
  );
}

// Сцена с 3D элементами
function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9d4edd" />
      
      <RotatingBox position={[-2, 0, 0]} color="#9d4edd" speed={0.5} />
      <FloatingSphere position={[0, 0, 0]} color="#c77dff" speed={1.2} />
      <RotatingTorus position={[2, 0, 0]} color="#e0aaff" speed={0.8} />
      
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

export default function AboutSection() {
  return (
    <motion.section
      className={styles.aboutSection}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8 }}
    >
      <div className="container">
        <div className={styles.aboutContent}>
          <motion.div
            className={styles.aboutText}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.h2
              className={styles.aboutTitle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              О компании G&R Group
            </motion.h2>
            
            <motion.p
              className={styles.aboutDescription}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Мы — ведущий поставщик решений для систем видеонаблюдения, слаботочных систем и электромонтажа в Казахстане.
            </motion.p>
            
            <motion.div
              className={styles.aboutFeatures}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              {[
                { icon: '🎯', title: 'Опыт', text: 'Более 10 лет на рынке' },
                { icon: '🔧', title: 'Качество', text: 'Официальные поставщики' },
                { icon: '🚀', title: 'Инновации', text: 'Современные технологии' },
                { icon: '🤝', title: 'Поддержка', text: 'Профессиональный сервис' },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  className={styles.aboutFeature}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <div className={styles.aboutFeatureIcon}>{feature.icon}</div>
                  <h3 className={styles.aboutFeatureTitle}>{feature.title}</h3>
                  <p className={styles.aboutFeatureText}>{feature.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
          
          <motion.div
            className={styles.about3d}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
              <Suspense fallback={null}>
                <Scene />
              </Suspense>
            </Canvas>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
