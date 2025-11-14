"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useThree } from "@react-three/fiber";
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

extend({ ThreeGlobe });

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------

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
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

// -------------------------------------------------------
// UTILS
// -------------------------------------------------------

function hexToRgb(hex: string) {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res
    ? {
        r: parseInt(res[1], 16),
        g: parseInt(res[2], 16),
        b: parseInt(res[3], 16)
      }
    : null;
}

function genRandomNumbers(min: number, max: number, count: number) {
  const arr: number[] = [];
  while (arr.length < count) {
    const r = Math.floor(Math.random() * (max - min)) + min;
    if (!arr.includes(r)) arr.push(r);
  }
  return arr;
}

// -------------------------------------------------------
// GLOBE COMPONENT
// -------------------------------------------------------

function GlobeInner({ globeConfig, data }: WorldProps) {
  const globeRef = useRef<any>(null);
  const [globeData, setGlobeData] = useState<any[]>([]);

  const defaultProps = {
    pointSize: 1,
    atmosphereColor: "#ffffff",
    showAtmosphere: true,
    atmosphereAltitude: 0.12,
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

  // -------------------------------------------------------
  // GENERATE POINTS
  // -------------------------------------------------------

  useEffect(() => {
    const pts: any[] = [];

    data.forEach((arc) => {
      const rgb = hexToRgb(arc.color)!;

      const colorFn = (t: number) =>
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`;

      pts.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: colorFn,
        lat: arc.startLat,
        lng: arc.startLng
      });

      pts.push({
        size: defaultProps.pointSize,
        order: arc.order,
        color: colorFn,
        lat: arc.endLat,
        lng: arc.endLng
      });
    });

    // remove duplicates
    const unique = pts.filter(
      (v, i, a) =>
        a.findIndex(
          (v2) => v2.lat === v.lat && v2.lng === v.lng
        ) === i
    );

    setGlobeData(unique);
  }, [data]);

  // -------------------------------------------------------
  // SET MATERIAL + POLYGONS
  // -------------------------------------------------------

  useEffect(() => {
    if (!globeRef.current) return;

    const mat = globeRef.current.globeMaterial();
    mat.color = new Color(defaultProps.globeColor);
    mat.emissive = new Color(defaultProps.emissive);
    mat.emissiveIntensity = defaultProps.emissiveIntensity;
    mat.shininess = defaultProps.shininess;

    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude)
      .hexPolygonColor(() => defaultProps.polygonColor);
  }, [globeData]);

  // -------------------------------------------------------
  // ANIMATION + ARC SETUP
  // -------------------------------------------------------

  useEffect(() => {
    if (!globeRef.current || !globeData.length) return;

    globeRef.current
      .arcsData(data)
      .arcStartLat((d: any) => d.startLat)
      .arcStartLng((d: any) => d.startLng)
      .arcEndLat((d: any) => d.endLat)
      .arcEndLng((d: any) => d.endLng)
      .arcColor((d: any) => d.color)
      .arcAltitude((d: any) => d.arcAlt)
      .arcDashLength(defaultProps.arcLength)
      .arcDashGap(15)
      .arcDashAnimateTime(defaultProps.arcTime);

    globeRef.current
      .pointsData(globeData)
      .pointRadius(2)
      .pointsMerge(true);

    // Rings
    let ringIndices = genRandomNumbers(
      0,
      globeData.length,
      Math.floor(globeData.length / 2)
    );

    globeRef.current
      .ringsData(globeData.filter((_, i) => ringIndices.includes(i)))
      .ringMaxRadius(defaultProps.maxRings)
      .ringRepeatPeriod(
        (defaultProps.arcTime * defaultProps.arcLength) /
          defaultProps.rings
      );
  }, [globeData]);

  return <threeGlobe ref={globeRef} />;
}

// -------------------------------------------------------
// WEBGL RENDERER CONFIG
// -------------------------------------------------------

function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0xffaaff, 0);
  }, []);

  return null;
}

// -------------------------------------------------------
// WORLD WRAPPER (CLIENT ONLY)
// -------------------------------------------------------

export function World(props: WorldProps) {
  const [mounted, setMounted] = useState(false);

  // Only render in browser
  useEffect(() => {
    setMounted(true);
  }, []);

  // PREP SCENE BEFORE RETURN
  const scene = useMemo(() => {
    const sc = new Scene();
    sc.fog = new Fog(0xffffff, 400, 2000);
    return sc;
  }, []);

  if (!mounted) return null;

  return (
    <Canvas
      scene={scene}
      camera={new PerspectiveCamera(50, 1.2, 180, 1800)}
    >
      <WebGLRendererConfig />

      {/* Lights */}
      <ambientLight intensity={0.6} />
      <directionalLight
        color={"#ffffff"}
        intensity={0.8}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={"#ffffff"}
        intensity={0.6}
        position={new Vector3(-200, 500, 200)}
      />

      <GlobeInner {...props} />

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
