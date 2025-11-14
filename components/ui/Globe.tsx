"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, Object3DNode } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Scene,
  Fog,
  Color,
  PerspectiveCamera,
  Vector3
} from "three";
import ThreeGlobe from "three-globe";
import countries from "@/data/globe.json";

/* ---------------------------------------------------------
   ⭐ IMPORTANT FIX — declare JSX tag <threeGlobe />
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

type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
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

const RING_PROPAGATION_SPEED = 3;

/* ---------------------------------------------------------
   Helper utilities
---------------------------------------------------------- */

export function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

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
  const [globeData, setGlobeData] = useState<any>(null);
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
    ...globeConfig
  };

  /* ---------------------- Build points --------------------- */
  useEffect(() => {
    const pts: any[] = [];
    data.forEach((arc) => {
      const rgb = hexToRgb(arc.color)!;
      pts.push({
        size: defaults.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        lat: arc.startLat,
        lng: arc.startLng
      });

      pts.push({
        size: defaults.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        lat: arc.endLat,
        lng: arc.endLng
      });
    });

    const uniquePts = pts.filter(
      (v, i, a) =>
        a.findIndex((v2) => v2.lat === v.lat && v2.lng === v.lng) === i
    );

    setGlobeData(uniquePts);
  }, [data]);

  /* ------------------- Build appearance -------------------- */
  useEffect(() => {
    if (!globeRef.current) return;

    const mat = globeRef.current.globeMaterial() as any;
    mat.color = new Color(defaults.globeColor);
    mat.emissive = new Color(defaults.emissive);
    mat.emissiveIntensity = defaults.emissiveIntensity;
    mat.shininess = defaults.shininess;
  }, [defaults]);

  /* --------------------- Setup globe ----------------------- */
  useEffect(() => {
    if (!globeRef.current || !globeData) return;

    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(defaults.showAtmosphere)
      .atmosphereColor(defaults.atmosphereColor)
      .atmosphereAltitude(defaults.atmosphereAltitude)
      .hexPolygonColor(() => defaults.polygonColor);

    startAnimation();
  }, [globeData]);

  /* --------------------- Animation logic ------------------- */
  const startAnimation = () => {
    if (!globeRef.current || !globeData) return;

    globeRef.current
      .arcsData(data)
      .arcStartLat((e) => e.startLat)
      .arcStartLng((e) => e.startLng)
      .arcEndLat((e) => e.endLat)
      .arcEndLng((e) => e.endLng)
      .arcColor((e) => e.color)
      .arcAltitude((e) => e.arcAlt)
      .arcStroke(() => [0.32, 0.28, 0.3][Math.floor(Math.random() * 3)])
      .arcDashLength(defaults.arcLength)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaults.arcTime);

    globeRef.current
      .pointsData(globeData)
      .pointColor((e) => e.color)
      .pointsMerge(true)
      .pointAltitude(0.0)
      .pointRadius(2);

    globeRef.current
      .ringsData([])
      .ringColor((d: any) => (t: number) => d.color(t))
      .ringMaxRadius(defaults.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod(
        (defaults.arcTime * defaults.arcLength) / defaults.rings
      );
  };

  // Re-render rings every 2 seconds
  useEffect(() => {
    if (!globeRef.current || !globeData) return;

    const interval = setInterval(() => {
      const picked = genRandomNumbers(0, data.length, Math.floor(data.length * 0.6));
      globeRef.current!.ringsData(globeData.filter((_: any, i: number) => picked.includes(i)));
    }, 2000);

    return () => clearInterval(interval);
  }, [globeData]);

  return <threeGlobe ref={globeRef} />;
}

/* ---------------------------------------------------------
   WebGL Renderer Config
---------------------------------------------------------- */

export function WebGLRendererConfig() {
  return null; // optional cleanup
}

/* ---------------------------------------------------------
   WORLD CONTAINER — CLIENT ONLY
---------------------------------------------------------- */

export function World(props: WorldProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent all SSR execution
  if (!mounted) return null;

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