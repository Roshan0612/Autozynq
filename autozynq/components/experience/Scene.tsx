"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { forwardRef, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type SceneHandle = {
  setScrollProgress: (value: number) => void;
};

const nodes = {
  webhook: [-3.4, 0.4, 0] as [number, number, number],
  ai: [0, 1.65, 0] as [number, number, number],
  gmail: [3.4, 0.4, 0] as [number, number, number],
  sheets: [0, -2.35, 0] as [number, number, number],
};

const timeline = {
  webhook: 0.05,
  webhookComplete: 0.18,
  ai: 0.25,
  aiComplete: 0.48,
  gmail: 0.55,
  sheets: 0.7,
  complete: 0.86,
};

function clamp(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function seededRandom(seed: number) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

function smooth(value: number) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function smoother(value: number) {
  const x = clamp(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function BackgroundParticles() {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 1600;
    const data = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      data[i * 3] = (seededRandom(i * 3 + 1) - 0.5) * 30;
      data[i * 3 + 1] = (seededRandom(i * 3 + 2) - 0.5) * 22;
      data[i * 3 + 2] = (seededRandom(i * 3 + 3) - 0.5) * 20;
    }

    return data;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.elapsedTime;
    ref.current.rotation.y = time * 0.004;
    ref.current.rotation.x = Math.sin(time * 0.1) * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8b5cf6" size={0.025} transparent opacity={0.25} />
    </points>
  );
}

function WorkflowNode({
  label,
  position,
  activation,
  progress,
  index,
  ai = false,
}: {
  label: string;
  position: [number, number, number];
  activation: number;
  progress: MutableRefObject<number>;
  index: number;
  ai?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const innerRing = useRef<THREE.Mesh>(null);
  const outerRing = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    const p = progress.current;
    const entrance = smooth((p - activation + 0.14) * 3.2);

    group.current.position.x = position[0];
    group.current.position.y = position[1] + Math.sin(time * 1.1 + index) * 0.06;
    group.current.position.z = THREE.MathUtils.lerp(-3.5, position[2], entrance);
    const active = p >= activation;
    const pulse = active ? 1 + Math.sin(time * 4) * 0.025 : 1;
    group.current.scale.setScalar(entrance * pulse);

    if (core.current) {
      core.current.rotation.x = time * 0.22;
      core.current.rotation.y = time * 0.4;
    }

    if (ai && p >= timeline.ai && p <= timeline.aiComplete) {
      core.current?.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
    }

    if (innerRing.current) {
      innerRing.current.rotation.z = time * 0.9;
      innerRing.current.rotation.x = Math.sin(time * 0.5) * 0.2;
    }

    if (outerRing.current) {
      outerRing.current.rotation.z = -time * 0.35;
      outerRing.current.rotation.y = time * 0.25;
    }

    if (material.current) {
      let targetGlow = 0.7;

      if (active) {
        targetGlow = ai ? 4 : 2.5;
      }

      if (ai && p >= timeline.ai && p <= timeline.aiComplete) {
        targetGlow = 8 + Math.sin(time * 10) * 3;
      }

      material.current.emissiveIntensity = THREE.MathUtils.lerp(material.current.emissiveIntensity, targetGlow, 0.1);
    }

    if (light.current) {
      let target = 0;

      if (ai && p >= timeline.ai) {
        target = 8;
      }

      if (ai && p >= timeline.ai && p <= timeline.aiComplete) {
        target = 14 + Math.sin(time * 8) * 5;
      }

      light.current.intensity = THREE.MathUtils.lerp(light.current.intensity, target, 0.1);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={outerRing}>
        <torusGeometry args={[ai ? 1.05 : 0.8, 0.018, 16, 96]} />
        <meshBasicMaterial color={ai ? "#c084fc" : "#8b5cf6"} transparent opacity={0.3} />
      </mesh>

      <mesh ref={core}>
        <icosahedronGeometry args={[ai ? 0.62 : 0.46, 3]} />
        <meshStandardMaterial
          ref={material}
          color={ai ? "#a855f7" : "#7c3aed"}
          emissive={ai ? "#a855f7" : "#6d28d9"}
          emissiveIntensity={0.7}
          roughness={0.14}
          metalness={0.92}
        />
      </mesh>

      <mesh ref={innerRing}>
        <torusGeometry args={[ai ? 0.82 : 0.6, 0.025, 16, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>

      {ai && (
        <>
          <mesh>
            <sphereGeometry args={[0.16, 32, 32]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <pointLight ref={light} color="#a855f7" intensity={0} distance={5} />
        </>
      )}

      <Text position={[0, ai ? -1.3 : -1, 0]} fontSize={ai ? 0.2 : 0.15} color="white" anchorX="center" anchorY="middle" letterSpacing={0.07}>
        {label}
      </Text>
    </group>
  );
}

function WorkflowConnection({
  start,
  end,
  activation,
  progress,
}: {
  start: [number, number, number];
  end: [number, number, number];
  activation: number;
  progress: MutableRefObject<number>;
}) {
  const line = useRef<THREE.Line<THREE.BufferGeometry, THREE.Material> | null>(null);

  const points = useMemo(() => {
    const startVector = new THREE.Vector3(...start);
    const endVector = new THREE.Vector3(...end);
    const middle = startVector.clone().add(endVector).multiplyScalar(0.5);
    middle.y += start[1] < end[1] ? 0.45 : -0.35;
    const curve = new THREE.QuadraticBezierCurve3(startVector, middle, endVector);
    return curve.getPoints(32);
  }, [start, end]);

  useFrame(() => {
    if (!line.current) return;
    const visible = smooth((progress.current - activation) * 4);
    const material = line.current.material as THREE.Material | THREE.Material[] | undefined;

    if (!material) return;
    if (material instanceof THREE.Material) {
      material.opacity = visible * 0.55;
    } else if (Array.isArray(material)) {
      material.forEach((item) => {
        if (item instanceof THREE.Material) {
          item.opacity = visible * 0.55;
        }
      });
    }
  });

  return <Line ref={(element) => { line.current = element as THREE.Line<THREE.BufferGeometry, THREE.Material> | null; }} points={points} color="#8b5cf6" lineWidth={1.2} transparent opacity={0} />;
}

function DataParticle({
  start,
  end,
  activation,
  progress,
  offset,
}: {
  start: [number, number, number];
  end: [number, number, number];
  activation: number;
  progress: MutableRefObject<number>;
  offset: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const movement = useRef(offset);

  const curve = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const middle = a.clone().add(b).multiplyScalar(0.5);
    middle.y += start[1] < end[1] ? 0.45 : -0.35;
    return new THREE.QuadraticBezierCurve3(a, middle, b);
  }, [start, end]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (progress.current < activation) {
      mesh.current.visible = false;
      return;
    }
    mesh.current.visible = true;
    movement.current += delta * 0.5;
    if (movement.current > 1) {
      movement.current = 0;
    }
    const point = curve.getPoint(smooth(movement.current));
    mesh.current.position.copy(point);
    const pulse = 1 + Math.sin(movement.current * Math.PI) * 1.8;
    mesh.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.065, 16, 16]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

function ParticleStream({
  start,
  end,
  activation,
  progress,
}: {
  start: [number, number, number];
  end: [number, number, number];
  activation: number;
  progress: MutableRefObject<number>;
}) {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <DataParticle key={i} start={start} end={end} activation={activation} progress={progress} offset={i / 12} />
      ))}
    </>
  );
}

function AIProcessing({ progress }: { progress: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const p = progress.current;
    const active = p >= timeline.ai && p <= timeline.aiComplete;
    group.current.visible = active;
    if (!active) return;
    const time = state.clock.elapsedTime;
    group.current.rotation.z = time * 1.4;
    group.current.rotation.x = time * 0.7;
    const pulse = 1 + Math.sin(time * 7) * 0.08;
    group.current.scale.setScalar(pulse);
  });

  return (
    <group position={nodes.ai} ref={group}>
      <mesh>
        <torusGeometry args={[1.3, 0.025, 16, 96]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.012, 16, 96]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.7, 0.008, 16, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function CompletionBurst({ progress }: { progress: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!group.current) return;
    const p = progress.current;
    const active = p >= timeline.complete;
    group.current.visible = active;
    if (!active) return;
    const time = state.clock.elapsedTime;
    group.current.rotation.z = time * 0.3;
    const scale = 1 + Math.sin(time * 3) * 0.04;
    group.current.scale.setScalar(scale);
    if (ring.current) {
      ring.current.rotation.z = time * 1.2;
    }
  });

  return (
    <group position={[0, 0.2, 0]} ref={group}>
      <mesh ref={ring}>
        <torusGeometry args={[3.2, 0.018, 16, 128]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function CinematicEnergyRing({ progress }: { progress: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!group.current) return;
    const p = progress.current;
    const transition = smooth((p - 0.82) / 0.18);
    group.current.visible = transition > 0.001;
    const time = state.clock.elapsedTime;
    const scale = THREE.MathUtils.lerp(0.25, 5.5, smoother(transition));
    group.current.scale.setScalar(scale);
    group.current.rotation.z = time * 0.45;
    group.current.rotation.x = Math.sin(time * 0.4) * 0.25;

    if (ring1.current) {
      ring1.current.rotation.z = time * 1.2;
      const material = ring1.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.8 * (1 - transition * 0.65);
    }

    if (ring2.current) {
      ring2.current.rotation.x = time * -0.8;
      const material = ring2.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.5 * (1 - transition * 0.4);
    }

    if (ring3.current) {
      ring3.current.rotation.y = time * 1.4;
      const material = ring3.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 * (1 - transition * 0.2);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ring1}>
        <torusGeometry args={[1.7, 0.025, 16, 128]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.015, 16, 128]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0} />
      </mesh>
      <mesh ref={ring3} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.5, 0.01, 16, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>
    </group>
  );
}

function CinematicTextTransition({ progress }: { progress: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const textGroup = useRef<THREE.Group>(null);
  const letters = useRef<THREE.Group[]>([]);
  const velocities = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        x: Math.sin(i * 2.4) * 0.015,
        y: 0.01 + Math.cos(i * 1.8) * 0.012,
        z: Math.sin(i * 3.1) * 0.01,
        rotation: (i % 2 === 0 ? 1 : -1) * (0.003 + i * 0.0007),
      })),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    const p = progress.current;
    const transition = clamp((p - 0.84) / 0.16);
    group.current.visible = transition > 0.001;
    if (!group.current.visible) return;
    const time = state.clock.elapsedTime;
    const float = Math.sin(time * 1.7) * 0.025;
    const exit = smoother((transition - 0.2) / 0.8);

    if (textGroup.current) {
      textGroup.current.position.y = float + exit * 2.4;
      textGroup.current.position.z = exit * -1.2;
      textGroup.current.rotation.z = Math.sin(time * 0.8) * 0.01 * (1 - exit);
      textGroup.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.35, exit));
    }

    letters.current.forEach((letter, index) => {
      if (!letter) return;
      const velocity = velocities[index];
      const local = smoother((transition - index * 0.008) / 0.8);
      letter.position.x += velocity.x * local;
      letter.position.y += velocity.y * local;
      letter.position.z += velocity.z * local;
      letter.rotation.z += velocity.rotation * local;
      const scale = THREE.MathUtils.lerp(1, 0, local);
      letter.scale.setScalar(scale);
    });

    if (transition < 0.25) {
      group.current.position.y = Math.sin(time * 1.4) * 0.02;
    } else {
      group.current.position.y = exit * 0.2;
    }
  });

  return (
    <group ref={group} position={[0, 0, 0.5]}>
      <group ref={textGroup}>
        <Text fontSize={0.55} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          AUTOMATE EVERYTHING
        </Text>
        <Text position={[0, -0.62, 0]} fontSize={0.13} color="#c4b5fd" anchorX="center" anchorY="middle" letterSpacing={0.12}>
          CONNECT • EXECUTE • SCALE
        </Text>
      </group>
      {Array.from({ length: 10 }).map((_, index) => (
        <group
          key={index}
          ref={(element) => {
            if (element) {
              letters.current[index] = element;
            }
          }}
          position={[(index - 4.5) * 0.45, Math.sin(index) * 0.15, 0]}
        >
          <mesh>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#c084fc" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CameraController({ progress }: { progress: MutableRefObject<number> }) {
  const target = useRef(new THREE.Vector3());

  useFrame((state) => {
    const p = progress.current;
    const cameraX = Math.sin(p * Math.PI) * 0.7;
    const cameraY = -p * 0.35;
    const cameraZ = 9 - p * 1.3;
    const transition = smooth((p - 0.84) / 0.16);
    const finalZ = THREE.MathUtils.lerp(cameraZ, 7.2, transition);
    target.current.set(cameraX, cameraY, finalZ);
    state.camera.position.lerp(target.current, 0.035);
    state.camera.lookAt(0, 0.1, 0);
  });

  return null;
}

function Workflow({ progress }: { progress: MutableRefObject<number> }) {
  return (
    <>
      <WorkflowNode label="WEBHOOK" position={nodes.webhook} activation={timeline.webhook} progress={progress} index={0} />
      <WorkflowNode label="AI ENGINE" position={nodes.ai} activation={timeline.ai} progress={progress} index={1} ai />
      <WorkflowNode label="GMAIL" position={nodes.gmail} activation={timeline.gmail} progress={progress} index={2} />
      <WorkflowNode label="GOOGLE SHEETS" position={nodes.sheets} activation={timeline.sheets} progress={progress} index={3} />
      <WorkflowConnection start={nodes.webhook} end={nodes.ai} activation={timeline.webhookComplete} progress={progress} />
      <WorkflowConnection start={nodes.ai} end={nodes.gmail} activation={timeline.aiComplete} progress={progress} />
      <WorkflowConnection start={nodes.ai} end={nodes.sheets} activation={timeline.gmail} progress={progress} />
      <ParticleStream start={nodes.webhook} end={nodes.ai} activation={timeline.webhookComplete} progress={progress} />
      <ParticleStream start={nodes.ai} end={nodes.gmail} activation={timeline.aiComplete} progress={progress} />
      <ParticleStream start={nodes.ai} end={nodes.sheets} activation={timeline.gmail} progress={progress} />
      <AIProcessing progress={progress} />
      <CompletionBurst progress={progress} />
    </>
  );
}

function AnimationDriver({
  progressRef,
  targetRef,
}: {
  progressRef: MutableRefObject<number>;
  targetRef: MutableRefObject<number>;
}) {
  useFrame(() => {
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, targetRef.current, 0.045);
  });

  return null;
}

const Scene = forwardRef<SceneHandle>((_, ref) => {
  const progress = useRef(0);
  const target = useRef(0);

  useImperativeHandle(ref, () => ({
    setScrollProgress(value: number) {
      target.current = THREE.MathUtils.clamp(value, 0, 1);
    },
  }), []);

  return (
    <Canvas camera={{ position: [0, 0, 9], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={["#020106"]} />
      <BackgroundParticles />
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 4, 4]} intensity={110} color="#8b5cf6" />
      <pointLight position={[-5, -3, 3]} intensity={80} color="#2563eb" />
      <pointLight position={[5, 2, 2]} intensity={70} color="#ec4899" />
      <AnimationDriver progressRef={progress} targetRef={target} />
      <Workflow progress={progress} />
      <CinematicEnergyRing progress={progress} />
      <CinematicTextTransition progress={progress} />
      <CameraController progress={progress} />
      <EffectComposer>
        <Bloom intensity={2} luminanceThreshold={0.1} luminanceSmoothing={0.65} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
});

Scene.displayName = "Scene";

export default Scene;
