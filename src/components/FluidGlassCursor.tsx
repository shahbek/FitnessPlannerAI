/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect } from 'react';
import { Canvas as R3FCanvas, useFrame, useThree } from '@react-three/fiber';
import {
  useFBO,
  MeshTransmissionMaterial,
} from '@react-three/drei';
import { easing } from 'maath';

interface FluidGlassCursorProps {
  scale?: number;
  ior?: number;
  thickness?: number;
  chromaticAberration?: number;
  anisotropy?: number;
}

function CursorMesh({
  scale = 0.12,
  ior = 1.15,
  thickness = 2,
  chromaticAberration = 0.1,
  anisotropy = 0.1,
}: FluidGlassCursorProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const buffer = useFBO({ samples: 8 });
  const { viewport, gl, camera, size, scene } = useThree();
  const pointerRef = useRef({ x: 0, y: 0 });

  // Listen to mouse events to update pointer position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (size.width > 0 && size.height > 0) {
        pointerRef.current.x = (e.clientX / size.width) * 2 - 1;
        pointerRef.current.y = -(e.clientY / size.height) * 2 + 1;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [size]);

  useFrame((state, delta) => {
    if (!meshRef.current || !buffer) return;

    const v = viewport.getCurrentViewport(camera, [
      pointerRef.current.x * viewport.width / 2,
      pointerRef.current.y * viewport.height / 2,
      15
    ]);

    const destX = (pointerRef.current.x * v.width) / 2;
    const destY = (pointerRef.current.y * v.height) / 2;
    easing.damp3(meshRef.current.position, [destX, destY, 15], 0.15, delta);

    // Capture the scene to FBO (empty scene, so webpage shows through)
    // The glass will refract whatever is behind it in the DOM
    gl.setRenderTarget(buffer);
    gl.clear();
    // Hide cursor during capture so it doesn't capture itself
    const cursorMesh = meshRef.current;
    if (cursorMesh) {
      cursorMesh.visible = false;
      gl.render(scene, camera);
      cursorMesh.visible = true;
    } else {
      gl.render(scene, camera);
    }
    gl.setRenderTarget(null);
  });

  return (
    <mesh ref={meshRef} scale={scale} position={[0, 0, 15]}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        buffer={buffer.texture}
        ior={ior}
        thickness={thickness}
        chromaticAberration={chromaticAberration}
        anisotropy={anisotropy}
        transmission={1}
        roughness={0}
        metalness={0}
        color="#ffffff"
        resolution={1024}
        backside={true}
        samples={10}
      />
    </mesh>
  );
}

export function FluidGlassCursor(props: FluidGlassCursorProps = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Ensure we're on the client side
    setMounted(true);

    // Hide default cursor
    document.body.style.cursor = 'none';

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.body.style.cursor = '';
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  if (!mounted || !isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <R3FCanvas
        camera={{ position: [0, 0, 20], fov: 15 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        style={{ width: '100%', height: '100%', mixBlendMode: 'normal' }}
        dpr={[1, 2]}
      >
        <CursorMesh {...props} />
      </R3FCanvas>
    </div>
  );
}
