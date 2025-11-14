"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Color, Scene, Fog, PerspectiveCamera, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { useThree, Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: any; // keep simple - ThreeGlobe typing can be added later
  }
}

extend({ ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;

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
  initialPosition?: { lat: number; lng: number };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

/**
 * Utility functions
 */
export function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

export function genRandomNumbers(min: number, max: number, count: number) {
  const arr: number[] = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (arr.indexOf(r) === -1) arr.push(r);
  }
  return arr;
}

/**
 * Globe (renders only the <threeGlobe /> primitive).
 * This component does not mount the Canvas itself.
 */
export function Globe({ globeConfig, data }: WorldProps) {
  const [globeData, setGlobeData] = useState<
    | {
        size: number;
        order: number;
        color: (t: number) => string;
        lat: number;
        lng: number;
      }[]
    | null
  >(null);

  const globeRef = useRef<any | null>(null);

  // compute defaultProps once for stability
  const defaultProps = useMemo(
    () => ({
      pointSize: 1,
      atmosphereColor: "#ffffff",
      showAtmosphere: true,
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
    }),
    [globeConfig]
  );

  // build data -> stable callback
  const buildData = useCallback(() => {
    if (!data || data.length === 0) {
      setGlobeData([]);
      return;
    }
    const arcs = data;
    const points: any[] = [];

    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      const rgb = hexToRgb(arc.color) || { r: 255, g: 255, b: 255 };
      points.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        lat: arc.startLat,
        lng: arc.startLng,
      });
      points.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`,
        lat: arc.endLat,
        lng: arc.endLng,
      });
    }

    // dedupe by lat/lng
    const filteredPoints = points.filter(
      (v, i, a) =>
        a.findIndex(
          (v2) => v2.lat === v.lat && v2.lng === v.lng
        ) === i
    );

    setGlobeData(filteredPoints);
  }, [data, defaultProps.pointSize]);

  // build material -> stable callback
  const buildMaterial = useCallback(() => {
    if (!globeRef.current) return;
    try {
      const globeMaterial = globeRef.current.globeMaterial() as any;
      if (globeMaterial) {
        globeMaterial.color = new Color(defaultProps.globeColor);
        globeMaterial.emissive = new Color(defaultProps.emissive);
        globeMaterial.emissiveIntensity = defaultProps.emissiveIntensity ?? 0.1;
        globeMaterial.shininess = defaultProps.shininess ?? 0.9;
      }
    } catch (e) {
      // safe-guard
      // console.warn("unable to set globe material", e);
    }
  }, [defaultProps.globeColor, defaultProps.emissive, defaultProps.emissiveIntensity, defaultProps.shininess]);

  // run once on mount or when raw data changes
  useEffect(() => {
    buildData();
  }, [buildData]);

  // when globeData is ready, configure globe and start animation
  useEffect(() => {
    if (!globeRef.current || !globeData || globeData.length === 0) return;

    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude)
      .hexPolygonColor(() => defaultProps.polygonColor);

    // apply material properties
    buildMaterial();

    // configure arcs/points/rings
    globeRef.current
      .arcsData(data)
      .arcStartLat((d: any) => d.startLat)
      .arcStartLng((d: any) => d.startLng)
      .arcEndLat((d: any) => d.endLat)
      .arcEndLng((d: any) => d.endLng)
      .arcColor((e: any) => e.color)
      .arcAltitude((e: any) => e.arcAlt)
      .arcStroke(() => [0.32, 0.28, 0.3][Math.round(Math.random() * 2)])
      .arcDashLength(defaultProps.arcLength)
      .arcDashInitialGap((d: any) => d.order)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaultProps.arcTime);

    globeRef.current
      .pointsData(data)
      .pointColor((e: any) => e.color)
      .pointsMerge(true)
      .pointAltitude(0.0)
      .pointRadius(defaultProps.pointSize);

    globeRef.current
      .ringsData([])
      .ringColor((e: any) => (t: number) => e.color(t))
      .ringMaxRadius(defaultProps.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod((defaultProps.arcTime * defaultProps.arcLength) / Math.max(1, defaultProps.rings));
    
    // startAnimation logic (kept inside effect)
    // any further animation logic can be placed here
  }, [globeData, buildMaterial, data, defaultProps]);

  // rings timer - update only when globeData exists
  useEffect(() => {
    if (!globeRef.current || !globeData || globeData.length === 0) return;
    const interval = setInterval(() => {
      if (!globeRef.current || !globeData) return;
      const numbersOfRings = genRandomNumbers(0, data.length, Math.floor((data.length * 4) / 5));
      globeRef.current.ringsData(globeData.filter((_, i) => numbersOfRings.includes(i)));
    }, 2000);

    return () => clearInterval(interval);
  }, [globeData, data]);

  // attach ref to the primitive by passing ref prop from JSX where used
  // threeGlobe primitive is declared in parent Canvas; below we simply render it
  return <threeGlobe ref={globeRef} />;
}

/**
 * WebGLRendererConfig - sets pixel ratio and size
 * NOTE: useThree() will only work inside a Canvas/mesh tree
 */
export function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    if (!gl) return;
    gl.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio : 1);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0xffaaff, 0);
  }, [gl, size.width, size.height]);

  return null;
}

/**
 * World - top-level component that mounts the Canvas.
 * We guard rendering until client-side mount to prevent any server-side evaluation.
 */
export function World(props: WorldProps) {
  const { globeConfig } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted, do not render Canvas (prevents SSR issues / early DOM access)
  if (!mounted) return null;

  const scene = useMemo(() => {
    const s = new Scene();
    s.fog = new Fog(0xffffff, 400, 2000);
    return s;
  }, []);

  // create camera once
  const camera = useMemo(() => new PerspectiveCamera(50, aspect, 180, 1800), []);

  return (
    <Canvas scene={scene} camera={camera}>
      <WebGLRendererConfig />
      {/* lights */}
      <ambientLight color={globeConfig.ambientLight} intensity={0.6} />
      <directionalLight color={globeConfig.directionalLeftLight} position={new Vector3(-400, 100, 400)} />
      <directionalLight color={globeConfig.directionalTopLight} position={new Vector3(-200, 500, 200)} />
      <pointLight color={globeConfig.pointLight} position={new Vector3(-200, 500, 200)} intensity={0.8} />
      {/* globe */}
      <Globe {...props} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={cameraZ}
        maxDistance={cameraZ}
        autoRotateSpeed={globeConfig.autoRotateSpeed ?? 1}
        autoRotate={globeConfig.autoRotate ?? true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}
