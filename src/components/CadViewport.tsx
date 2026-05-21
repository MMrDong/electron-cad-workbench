import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { CadBinaryPart, CadDocumentKind } from "../types";

type ViewState = {
  zoom: number;
  rotation: number;
  pitch: number;
};

type CadViewportProps = {
  binaryParts?: CadBinaryPart[];
  children?: ReactNode;
  documentKind: CadDocumentKind;
  partCount: number;
  view: ViewState;
  onViewChange: (view: ViewState | ((current: ViewState) => ViewState)) => void;
};

type ThreeRuntime = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  frameId: number;
  renderer: THREE.WebGLRenderer;
  resizeObserver: ResizeObserver;
  scene: THREE.Scene;
};

type CadPart = {
  color: string;
  metalness: number;
  position: [number, number, number];
  scale: [number, number, number];
};

export function CadViewport({ binaryParts = [], children, documentKind, partCount, view, onViewChange }: CadViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onViewChangeRef = useRef(onViewChange);
  const runtimeRef = useRef<ThreeRuntime | null>(null);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d1115");
    scene.fog = new THREE.Fog("#0d1115", 18, 34);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(6.8, 5.2, 7.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5.2;
    controls.maxDistance = 16;
    controls.target.set(0.4, 1.1, 0.2);

    buildLighting(scene);
    buildFactoryGrid(scene);
    if (documentKind === "assembly") {
      buildCadAssembly(scene, partCount);
    } else {
      buildCadPart(scene);
    }
    buildAxisMarkers(scene);

    const syncViewFromCamera = () => {
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      onViewChangeRef.current((current) => ({
        ...current,
        rotation: spherical.theta,
        pitch: spherical.phi,
        zoom: THREE.MathUtils.clamp(10 / spherical.radius, 0.62, 1.8)
      }));
    };

    controls.addEventListener("end", syncViewFromCamera);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      runtimeRef.current!.frameId = window.requestAnimationFrame(render);
    };

    runtimeRef.current = {
      camera,
      controls,
      frameId: window.requestAnimationFrame(render),
      renderer,
      resizeObserver,
      scene
    };

    return () => {
      controls.removeEventListener("end", syncViewFromCamera);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(runtimeRef.current?.frameId ?? 0);
      controls.dispose();
      disposeObject(scene);
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [documentKind, partCount]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const distance = THREE.MathUtils.clamp(10 / view.zoom, 5.2, 16);
    const spherical = new THREE.Spherical(distance, view.pitch, view.rotation);
    const nextPosition = new THREE.Vector3().setFromSpherical(spherical).add(runtime.controls.target);
    runtime.camera.position.copy(nextPosition);
    runtime.camera.lookAt(runtime.controls.target);
    runtime.controls.update();
  }, [view.zoom, view.rotation, view.pitch]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const previous = runtime.scene.getObjectByName("BinaryPayload");
    if (previous) {
      disposeObject(previous);
      runtime.scene.remove(previous);
    }

    if (binaryParts.length > 0) {
      runtime.scene.add(buildBinaryPayload(binaryParts));
    }
  }, [binaryParts]);

  function setZoom(nextZoom: number) {
    onViewChange((current) => ({
      ...current,
      zoom: Math.max(0.62, Math.min(1.8, nextZoom))
    }));
  }

  return (
    <section className="relative h-[calc(100vh-48px)] min-h-[640px] overflow-hidden bg-[#0d1115]" aria-label="CAD viewport">
      <div
        className="h-full w-full"
        onWheel={(event) => {
          setZoom(view.zoom + (event.deltaY > 0 ? -0.08 : 0.08));
        }}
        ref={mountRef}
      />
      <div className="pointer-events-none absolute inset-0">{children}</div>
    </section>
  );
}

function buildLighting(scene: THREE.Scene) {
  const ambient = new THREE.HemisphereLight("#dceeff", "#172027", 1.8);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 2.8);
  key.position.set(5, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  scene.add(key);

  const fill = new THREE.PointLight("#46c2a6", 5, 12);
  fill.position.set(-4, 3, -5);
  scene.add(fill);
}

function buildFactoryGrid(scene: THREE.Scene) {
  const grid = new THREE.GridHelper(18, 18, "#5f717f", "#29343d");
  grid.position.y = -0.02;
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({
      color: "#111820",
      metalness: 0.2,
      roughness: 0.78
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function buildCadAssembly(scene: THREE.Scene, partCount: number) {
  const assembly = new THREE.Group();
  assembly.name = "Assembly-A12";

  const baseParts: CadPart[] = [
    { position: [-1.1, 0.45, 0], scale: [4.8, 0.9, 2.4], color: "#46c2a6", metalness: 0.42 },
    { position: [1.4, 1.45, -0.55], scale: [2.2, 2.0, 1.4], color: "#6da8ff", metalness: 0.34 },
    { position: [-2.4, 1.25, 1.1], scale: [1.4, 1.7, 1.5], color: "#f3b35a", metalness: 0.28 },
    { position: [0.55, 2.45, 1.2], scale: [3.4, 0.7, 1.2], color: "#ef6f6c", metalness: 0.24 }
  ];

  const extraParts: CadPart[] = Array.from({ length: Math.max(0, partCount - baseParts.length) }, (_, index) => {
    const angle = index * 0.82;
    return {
      color: index % 2 === 0 ? "#9f8cff" : "#49d3c5",
      metalness: 0.3,
      position: [Math.cos(angle) * 3.2, 0.75 + (index % 2) * 0.45, Math.sin(angle) * 2.6],
      scale: [1.1, 0.9, 1.1]
    };
  });

  const parts = [...baseParts, ...extraParts].slice(0, partCount);

  parts.forEach((part) => {
    const mesh = createBox(part.color, part.metalness);
    mesh.position.set(...part.position);
    mesh.scale.set(...part.scale);
    assembly.add(mesh);
  });

  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 4.3, 36),
    createMaterial("#dce8ef", 0.5)
  );
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.set(0.2, 2.1, -0.1);
  cylinder.castShadow = true;
  cylinder.receiveShadow = true;
  assembly.add(cylinder);

  const torus = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 16, 64), createMaterial("#46c2a6", 0.15));
  torus.position.set(2.6, 1.5, 0.75);
  torus.rotation.set(Math.PI / 2, 0.15, 0);
  torus.castShadow = true;
  assembly.add(torus);

  addEdges(assembly);
  scene.add(assembly);
}

function buildCadPart(scene: THREE.Scene) {
  const part = new THREE.Group();
  part.name = "Part-P01";

  const body = createBox("#6da8ff", 0.38);
  body.position.set(0, 1, 0);
  body.scale.set(4.4, 1.3, 2.2);
  part.add(body);

  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.85, 48), createMaterial("#46c2a6", 0.28));
  boss.position.set(-1.25, 2.1, 0);
  boss.castShadow = true;
  boss.receiveShadow = true;
  part.add(boss);

  const slot = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 16, 64), createMaterial("#f3b35a", 0.22));
  slot.position.set(1.25, 1.72, 0);
  slot.rotation.x = Math.PI / 2;
  slot.castShadow = true;
  part.add(slot);

  const chamferPreview = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(4.8, 1.55, 2.55), 18),
    new THREE.LineBasicMaterial({ color: "#eef6ff", transparent: true, opacity: 0.6 })
  );
  chamferPreview.position.set(0, 1, 0);
  part.add(chamferPreview);

  addEdges(part);
  scene.add(part);
}

function buildAxisMarkers(scene: THREE.Scene) {
  const axes = new THREE.AxesHelper(2.2);
  axes.position.set(-4.8, 0.03, -4.8);
  scene.add(axes);
}

function buildBinaryPayload(parts: CadBinaryPart[]) {
  const group = new THREE.Group();
  group.name = "BinaryPayload";

  parts.forEach((part, index) => {
    const color = new THREE.Color(part.color[0], part.color[1], part.color[2]);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.12),
        metalness: 0.32,
        roughness: 0.38
      })
    );
    mesh.name = `BinaryPart-${index + 1}`;
    mesh.position.set(...part.position);
    mesh.scale.set(...part.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 24),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.72 })
    );
    mesh.add(edges);
    group.add(mesh);
  });

  return group;
}

function createBox(color: string, metalness: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createMaterial(color, metalness));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createMaterial(color: string, metalness: number) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness: 0.42,
    envMapIntensity: 0.8
  });
}

function addEdges(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(object.geometry, 28),
      new THREE.LineBasicMaterial({ color: "#eef6ff", transparent: true, opacity: 0.52 })
    );
    object.add(edges);
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  if (object instanceof THREE.Mesh) {
    object.geometry.dispose();
    disposeMaterial(object.material);
  }

  if (object instanceof THREE.LineSegments) {
    object.geometry.dispose();
    disposeMaterial(object.material);
  }

  object.children.forEach((child) => disposeObject(child));
}
