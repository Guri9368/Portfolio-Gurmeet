"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, extend, Object3DNode } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, PerspectiveCamera, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import countries from "@/data/globe.json";

/* ---------------------------------------------------------
   ⭐ FIX: declare <threeGlobe /> as a valid JSX element
---------------------------------------------------------- */
declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: Object3DNode<ThreeGlobe, typeof ThreeGlobe>;
  }
}

extend({ ThreeGlobe });

/* ---------------------------------------------------------
   Types
---------------------------------------------------------- */
export type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string; // must be a STRING for 3D globe library
};

export type GlobeConfig = {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

/* ---------------------------------------------------------
   Utils
---------------------------------------------------------- */
export function genRandomNumbers(min: number, max: number, count: number) {
  const arr: number[] = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (!arr.includes(r)) arr.push(r);
  }
  return arr;
}

/* ---------------------------------------------------------
   Globe Component
---------------------------------------------------------- */
export function Globe({ globeConfig, data }: WorldProps) {
  const [globeData, setGlobeData] = useState<Position[]>([]);
  const globeRef = useRef<ThreeGlobe | null>(null);

  const defaults = {
    pointSize: 1,
    showAtmosphere: true,
    atmosphereColor: "#ffffff",
    atmosphereAltitude: 0.1,
    polygonColor: "rgba(255,255,255,0.7)",
    globeColor: "#1d072e",
    emissive: "#000000",
    emissiveIntensity: 0.1,
    shininess: 0.9,
    arcTime: 2000,
    arcLength: 0.9,
    rings: 1,
    maxRings: 3,
    ...globeConfig,
  };

  /* ---------------- Build point dataset -------------------- */
  useEffect(() => {
    // Map incoming data to the required Position type for globeData
    // Here we assume the input data is fully formed Position[]
    // If not, adjust transformation accordingly.

    // But for pointsData, we need positions of points (startLat, startLng)
    // So globeData holds same Position type for consistency.

    setGlobeData(data);
  }, [data]);

  /* ---------------- Material / Globe appearance ------------- */
  useEffect(() => {
    if (!globeRef.current) return;

    const mat = globeRef.current.globeMaterial() as any;

    mat.color = new Color(defaults.globeColor);
    mat.emissive = new Color(defaults.emissive);
    mat.emissiveIntensity = defaults.emissiveIntensity;
    mat.shininess = defaults.shininess;
  }, [defaults]);

  /* ----------------- Build Globe + Polygons ---------------- */
  useEffect(() => {
    if (!globeRef.current || globeData.length === 0) return;

    globeRef.current
      .hexPolygonsData((countries as any).features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(defaults.showAtmosphere)
      .atmosphereColor(defaults.atmosphereColor)
      .atmosphereAltitude(defaults.atmosphereAltitude)
      .hexPolygonColor(() => defaults.polygonColor);

    startArcAnimation();
  }, [globeData]);

  /* ---------------------------------------------------------
     Arc Animation Setup
  ---------------------------------------------------------- */
  const startArcAnimation = () => {
    if (!globeRef.current) return;

    globeRef.current
      .arcsData(data)
      .arcStartLat((e: Position) => e.startLat)
      .arcStartLng((e: Position) => e.startLng)
      .arcEndLat((e: Position) => e.endLat)
      .arcEndLng((e: Position) => e.endLng)
      // ⭐ arcColor MUST BE STRING
      .arcColor((e: Position) => e.color)
      .arcAltitude((e: Position) => e.arcAlt)
      .arcStroke(() => [0.32, 0.28, 0.3][Math.floor(Math.random() * 3)])
      .arcDashLength(defaults.arcLength)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaults.arcTime);

    globeRef.current
      .pointsData(globeData)
      .pointColor((e: Position) => e.color)
      .pointsMerge(true)
      .pointAltitude(0.0)
      .pointRadius(defaults.pointSize);

    globeRef.current
      .ringsData([])
      .ringColor((d: Position) => (t: number) => d.color)
      .ringMaxRadius(defaults.maxRings)
      .ringPropagationSpeed(3)
      .ringRepeatPeriod(
        (defaults.arcTime * defaults.arcLength) / defaults.rings
      );
  };

  /* ----------------- Ring Updates Every 2s ------------------ */
  useEffect(() => {
    if (!globeRef.current || globeData.length === 0) return;

    const interval = setInterval(() => {
      const picked = genRandomNumbers(
        0,
        globeData.length,
        Math.floor(globeData.length * 0.6)
      );

      globeRef.current!.ringsData(
        globeData.filter((_, idx) => picked.includes(idx))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [globeData]);

  return <threeGlobe ref={globeRef} />;
}

/* ---------------------------------------------------------
   Scene Lighting Wrapper (client only)
---------------------------------------------------------- */
function SceneExtras({ globeConfig }: { globeConfig: GlobeConfig }) {
  return (
    <>
      <fog attach="fog" args={[0xffffff, 400, 2000]} />
      <ambientLight color={globeConfig.ambientLight} intensity={0.6} />
      <directionalLight
        color={globeConfig.directionalLeftLight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={globeConfig.directionalTopLight}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={globeConfig.pointLight}
        position={new Vector3(-200, 500, 200)}
        intensity={0.8}
      />
    </>
  );
}

/* ---------------------------------------------------------
   WORLD Component (SSR SAFE)
---------------------------------------------------------- */
export function World(props: WorldProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // ⛔ prevents SSR crash

  return (
    <Canvas
      camera={new PerspectiveCamera(50, 1.2, 180, 1800)}
      gl={{ antialias: true }}
    >
      <SceneExtras globeConfig={props.globeConfig} />
      <Globe {...props} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}
