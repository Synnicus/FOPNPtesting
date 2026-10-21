import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, Platform, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { isBoardModel } from '@/data/tacticalBoard';
import { LocalizedText as Text } from '@/components/LocalizedText';
import type { Character } from '@/context/types';
import {
  cellPoint, footprint, pointCell, type BoardCell, type BoardToken, type TacticalBoard,
} from '@/data/tacticalBoard';
import { useColors } from '@/hooks/useColors';
import type { BoardCanvasHandle, BoardHit, BoardRing } from './BoardCanvas';
import { localTextureUri } from './modelAssetPicker';
import { decodeModelDataUri, sanitizedGlbArrayBuffer, validateModelBytes } from './modelFormat';
import { tr } from './i18n';

const CELL = 1;
const DEFAULT_TERRAIN = require('../../assets/images/combat-desert.jpg');

interface Props {
  board: TacticalBoard;
  characters: readonly Character[];
  selectedId: string | null;
  attackerId: string | null;
  defenderId: string | null;
  activeId: string | null;
  pathCells?: BoardCell[] | null;
  impact?: BoardCell | null;
  rings?: BoardRing[];
  burstCells?: BoardCell[];
  burstTargetIds?: string[];
  selectedObstacleId?: string | null;
  centerRef: React.MutableRefObject<BoardCell>;
  panMode: boolean;
  cameraControlsEnabled: boolean;
  dragEnabled: boolean;
  onTap: (cell: BoardCell, hit: BoardHit | null) => void;
  onDrop: (characterId: string, cell: BoardCell) => void;
  onFallback: (reason: string) => void;
}

interface CameraPose { theta: number; phi: number; distance: number; x: number; z: number }
interface Runtime {
  gl: ExpoWebGLRenderingContext;
  renderer: Renderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  content: THREE.Group;
  floor: THREE.Mesh;
  size: { width: number; height: number };
  raf: number | null;
  running: boolean;
  generation: number;
  interactive: THREE.Object3D[];
}

const colorHex = (color: string) => new THREE.Color(color);
const disposeObject = (root: THREE.Object3D) => root.traverse(object => {
  const mesh = object as THREE.Mesh;
  mesh.geometry?.dispose?.();
  if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
  else mesh.material?.dispose?.();
});

function addTexture(runtime: Runtime, uri: string | number, generation: number, onLoaded: (texture: THREE.Texture) => void) {
  void localTextureUri(uri).then(source => {
    if (!runtime.running || runtime.generation !== generation) return;
    new TextureLoader().load(
      source as string,
      texture => {
        if (!runtime.running || runtime.generation !== generation) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        onLoaded(texture);
      },
      undefined,
      () => undefined,
    );
  }).catch(() => undefined);
}

function cellVertices(cell: BoardCell, grid: TacticalBoard['grid']): THREE.Vector3[] {
  const center = cellPoint(cell, grid, CELL);
  if (grid === 'square') {
    return [
      new THREE.Vector3(center.x - 0.5, 0, center.y - 0.5), new THREE.Vector3(center.x + 0.5, 0, center.y - 0.5),
      new THREE.Vector3(center.x + 0.5, 0, center.y + 0.5), new THREE.Vector3(center.x - 0.5, 0, center.y + 0.5),
    ];
  }
  const radius = 1 / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (60 * index - 30) * Math.PI / 180;
    return new THREE.Vector3(center.x + radius * Math.cos(angle), 0, center.y + radius * Math.sin(angle));
  });
}

function addCells(
  parent: THREE.Group,
  cells: readonly BoardCell[],
  grid: TacticalBoard['grid'],
  color: string,
  opacity: number,
) {
  if (!cells.length) return;
  const positions: number[] = [];
  for (const cell of cells) {
    const corners = cellVertices(cell, grid);
    const center = cellPoint(cell, grid, CELL);
    for (let i = 0; i < corners.length; i++) {
      positions.push(center.x, 0, center.y, corners[i].x, 0, corners[i].z,
        corners[(i + 1) % corners.length].x, 0, corners[(i + 1) % corners.length].z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: false,
  }));
  mesh.position.y = 0.035;
  parent.add(mesh);
}

function addBoardGrid(parent: THREE.Group, board: TacticalBoard, color: string) {
  const isHex = board.grid === 'hex';
  const pointsPerCell = isHex ? 18 : 0;
  const gridLineCount = isHex ? 0 : board.columns + board.rows + 2;
  const vertices = new Float32Array(isHex
    ? board.columns * board.rows * pointsPerCell
    : gridLineCount * 6);
  let offset = 0;
  if (!isHex) {
    for (let column = 0; column <= board.columns; column++) {
      vertices.set([column - 0.5, 0.018, -0.5, column - 0.5, 0.018, board.rows - 0.5], offset); offset += 6;
    }
    for (let row = 0; row <= board.rows; row++) {
      vertices.set([-0.5, 0.018, row - 0.5, board.columns - 0.5, 0.018, row - 0.5], offset); offset += 6;
    }
  } else {
    const rowHeight = Math.sqrt(3) / 2, radius = 1 / Math.sqrt(3);
    for (let row = 0; row < board.rows; row++) for (let column = 0; column < board.columns; column++) {
      const cx = column + row / 2, cz = row * rowHeight;
      for (let edge = 0; edge < 3; edge++) {
        const a = (60 * edge - 30) * Math.PI / 180;
        const b = (60 * (edge + 1) - 30) * Math.PI / 180;
        vertices.set([
          cx + radius * Math.cos(a), 0.018, cz + radius * Math.sin(a),
          cx + radius * Math.cos(b), 0.018, cz + radius * Math.sin(b),
        ], offset);
        offset += 6;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const gridLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.36 }));
  parent.add(gridLines);
}

function makeVehicleSideSilhouette(parent: THREE.Group, character: Character | undefined, tint: THREE.Color, token: BoardToken) {
  const category = character?.vehicle?.category ?? 'car';
  const body = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, metalness: 0.05 });
  const detail = new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.68), roughness: 1 });
  const wheels = new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.38), roughness: 1 });
  const silhouette = new THREE.Group();
  const box = (width: number, height: number, length: number, y: number, z: number, material = body) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
    mesh.position.set(0, y, z);
    silhouette.add(mesh);
  };
  const wheel = (x: number, z: number, radius = 0.16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.16, 10), wheels);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, radius, z);
    silhouette.add(mesh);
  };
  const roadWheels = (count = 2, radius = 0.16) => {
    for (const x of [-0.42, 0.42]) {
      for (let i = 0; i < count; i++) {
        const z = count === 1 ? 0 : -0.5 + (i / (count - 1));
        wheel(x, z, radius);
      }
    }
  };

  if (category === 'motorcycle') {
    wheel(0, -0.52, 0.24); wheel(0, 0.52, 0.24);
    box(0.12, 0.12, 0.7, 0.36, 0);
    box(0.36, 0.12, 0.25, 0.62, -0.08, detail);
    box(0.42, 0.08, 0.08, 0.68, 0.42, detail);
  } else if (category === 'aircraft') {
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.65, 8), body);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 0.42;
    silhouette.add(fuselage);
    box(1.8, 0.09, 0.42, 0.36, 0.08);
    box(0.72, 0.08, 0.26, 0.38, -0.6, detail);
    box(0.72, 0.08, 0.2, 0.38, 0.66, detail);
    box(0.12, 0.36, 0.1, 0.62, 0.03, detail);
  } else if (category === 'boat') {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 1.6, 6), body);
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.22;
    silhouette.add(hull);
    box(0.68, 0.22, 0.58, 0.46, -0.08, detail);
    box(0.42, 0.38, 0.4, 0.72, -0.05);
  } else if (category === 'tank' || category === 'apc' || category === 'artillery') {
    box(0.92, 0.3, 1.52, 0.35, 0);
    box(0.18, 0.25, 1.42, 0.25, 0, wheels);
    // Tracks sit just outside the chassis to keep the vehicle silhouette visible at small sizes.
    for (const x of [-0.52, 0.52]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 1.55), wheels);
      track.position.set(x, 0.22, 0);
      silhouette.add(track);
    }
    if (category === 'tank') {
      box(0.58, 0.3, 0.66, 0.62, -0.02, detail);
      box(0.09, 0.1, 0.72, 0.68, 0.57, body);
    } else if (category === 'artillery') {
      box(0.6, 0.18, 0.6, 0.57, -0.1, detail);
      box(0.1, 0.12, 1.05, 0.75, 0.42, body);
    } else {
      box(0.72, 0.42, 0.98, 0.68, 0, detail);
    }
  } else if (category === 'trailer') {
    box(0.86, 0.68, 1.35, 0.63, -0.02);
    box(0.22, 0.08, 0.3, 0.26, 0.78, detail);
    roadWheels(2, 0.18);
  } else {
    const truck = category === 'truck';
    box(truck ? 0.94 : 0.84, 0.28, truck ? 1.7 : 1.35, 0.34, 0);
    box(truck ? 0.76 : 0.62, 0.42, truck ? 0.62 : 0.68, 0.64, truck ? 0.45 : 0.05, detail);
    if (truck) box(0.8, 0.42, 0.82, 0.63, -0.45);
    roadWheels(truck ? 3 : 2);
  }

  // The silhouette expands to the vehicle's saved grid footprint.
  silhouette.scale.set(Math.max(0.6, token.width * 0.82), 1, Math.max(0.6, token.length * 0.72));
  parent.add(silhouette);
}

function makeFallbackStandee(parent: THREE.Group, character: Character | undefined, tint: THREE.Color, token: BoardToken) {
  const material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.82, metalness: character?.vehicle ? 0.2 : 0 });
  if (character?.vehicle) {
    makeVehicleSideSilhouette(parent, character, tint, token);
    return;
  }
  const race = (character?.race ?? '').toLowerCase();
  if (/dog|wolf|beast|animal|brahmin|rat|radscorpion|deathclaw/.test(race)) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.34), material);
    body.position.y = 0.28; parent.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), material);
    head.position.set(0, 0.36, 0.28); parent.add(head);
    for (const x of [-0.21, 0.21]) for (const z of [-0.1, 0.1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 5), material);
      leg.position.set(x, 0.13, z); parent.add(leg);
    }
  } else {
    const height = /super.?mutant|behemoth/.test(race) ? 1.35 : 1;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.58 * height, 8), material);
    torso.position.y = 0.39 * height; parent.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * height, 8, 6), material);
    head.position.y = 0.82 * height; parent.add(head);
    for (const x of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.34 * height, 6), material);
      leg.position.set(x, 0.08 * height, 0); parent.add(leg);
    }
  }
}

function fitModel(model: THREE.Object3D, token: BoardToken) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error('The model has no visible geometry.');
  const size = bounds.getSize(new THREE.Vector3());
  const maxSide = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxSide) || maxSide <= 0) throw new Error('The model has invalid dimensions.');
  const desired = Math.min(1.5, Math.max(0.4, Math.min(token.width, token.length) * 0.9));
  const scale = desired / maxSide * (token.modelScale ?? 1);
  model.scale.setScalar(scale);
  model.position.x = -(bounds.min.x + bounds.max.x) / 2 * scale;
  model.position.z = -(bounds.min.z + bounds.max.z) / 2 * scale;
  model.position.y = -bounds.min.y * scale;
}

function installModel(parent: THREE.Group, token: BoardToken, generation: number, runtime: Runtime, tint: THREE.Color, fallback: () => void) {
  if (!token.modelDataUri || !token.modelFormat) return fallback();
  try {
    if (!isBoardModel(token.modelDataUri, token.modelFormat)) throw new Error('Invalid saved model.');
    const bytes = decodeModelDataUri(token.modelDataUri);
    validateModelBytes(bytes, token.modelFormat);
    if (token.modelFormat === 'stl') {
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const geometry = new STLLoader().parse(buffer);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: tint, roughness: 0.8, side: THREE.DoubleSide }));
      fitModel(mesh, token);
      if (!runtime.running || runtime.generation !== generation) { disposeObject(mesh); return; }
      parent.add(mesh);
      return;
    }
    const loader = new GLTFLoader();
    loader.parse(sanitizedGlbArrayBuffer(bytes), '', gltf => {
      const model = gltf.scene;
      model.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false; mesh.receiveShadow = false;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            const textured = material as THREE.MeshStandardMaterial;
            if (textured.map) { textured.map.dispose(); textured.map = null; }
            if (textured.normalMap) { textured.normalMap.dispose(); textured.normalMap = null; }
            textured.needsUpdate = true;
          }
        }
      });
      try { fitModel(model, token); } catch { fallback(); return; }
      if (!runtime.running || runtime.generation !== generation) { disposeObject(model); return; }
      parent.add(model);
    }, () => fallback());
  } catch { fallback(); }
}

function appendScene(runtime: Runtime, props: Props, color: ReturnType<typeof useColors>) {
  const generation = ++runtime.generation;
  for (const child of runtime.content.children) disposeObject(child);
  runtime.content.clear();
  runtime.interactive.length = 0;
  const { board, characters } = props;
  const maxR = Math.max(board.rows, board.columns);
  const rowStep = board.grid === 'hex' ? Math.sqrt(3) / 2 : 1;
  const width = board.columns + (board.grid === 'hex' ? Math.max(0, board.rows - 1) / 2 : 0);
  const height = board.grid === 'hex' ? (board.rows - 1) * rowStep + 1 : board.rows;
  runtime.scene.background = colorHex(color.background);
  runtime.scene.fog = new THREE.Fog(color.background, maxR * 0.4, maxR * 2.8);

  const floorWidth = width * board.backgroundScale;
  const floorHeight = height * board.backgroundScale;
  const floorPositionX = -0.5 + floorWidth / 2;
  const floorPositionZ = -0.5 + floorHeight / 2;
  runtime.floor.geometry.dispose();
  runtime.floor.geometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
  runtime.floor.position.set(floorPositionX, 0, floorPositionZ);
  const floorMaterial = runtime.floor.material as THREE.MeshStandardMaterial;
  // Keep uploaded map colors intact; tinting the texture by the dark UI card
  // color makes custom terrain nearly invisible in the 3D view.
  floorMaterial.color.set(0xffffff);
  floorMaterial.map?.dispose(); floorMaterial.map = null;
  const backgroundUri = board.backgroundDataUri ?? DEFAULT_TERRAIN;
  addTexture(runtime, backgroundUri, generation, texture => {
    if (runtime.floor.material instanceof THREE.MeshStandardMaterial) {
      runtime.floor.material.map?.dispose();
      runtime.floor.material.map = texture;
      runtime.floor.material.needsUpdate = true;
    }
  });

  addBoardGrid(runtime.content, board, color.text);
  const chartCells = (cells: BoardCell[] | undefined, tint: string, opacity: number) => {
    if (cells?.length) addCells(runtime.content, cells, board.grid, tint, opacity);
  };
  chartCells(props.burstCells, color.destructive, 0.25);
  chartCells(props.pathCells ?? undefined, color.primary, 0.3);
  for (const token of board.tokens) {
    const character = characters.find(item => item.id === token.characterId);
    if (!character || character.inStorage) continue;
    const isVehicle = !!character.vehicle;
    const position = cellPoint(token, board.grid, CELL);
    const selected = props.selectedId === character.id;
    const active = props.activeId === character.id;
    const attacker = props.attackerId === character.id;
    const defender = props.defenderId === character.id;
    const roleColor = attacker ? color.destructive : defender ? color.text : color.primary;
    const tokenGroup = new THREE.Group();
    tokenGroup.position.set(position.x, 0, position.y);
    tokenGroup.rotation.y = -token.facing * Math.PI / 180;
    tokenGroup.userData.boardHit = { kind: 'token', id: character.id } satisfies BoardHit;
    runtime.content.add(tokenGroup);
    runtime.interactive.push(tokenGroup);

    const cells = footprint(token, board.grid);
    const footprintColor = selected || active ? color.primary : color.border;
    addCells(runtime.content, cells, board.grid, footprintColor, isVehicle ? 0.16 : 0.09);
    const outlinePts: number[] = [];
    for (const cell of cells) {
      const points = cellVertices(cell, board.grid);
      for (let i = 0; i < points.length; i++) {
        outlinePts.push(points[i].x, 0.048, points[i].z, points[(i + 1) % points.length].x, 0.048, points[(i + 1) % points.length].z);
      }
    }
    const outlineGeometry = new THREE.BufferGeometry();
    outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outlinePts, 3));
    const outline = new THREE.LineSegments(outlineGeometry, new THREE.LineBasicMaterial({
      color: selected || active ? color.primary : color.border, transparent: !selected && !active, opacity: 0.75,
    }));
    runtime.content.add(outline);

    const hp = Math.max(0, Math.min(1, character.currentHp / Math.max(1, character.maxHp)));
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(Math.max(token.width, token.length) * 0.75, 0.05, 0.06),
      new THREE.MeshBasicMaterial({ color: color.border }));
    barBg.position.set(position.x, 0.09, position.y);
    runtime.content.add(barBg);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.02, Math.max(token.width, token.length) * 0.75 * hp), 0.052, 0.07),
      new THREE.MeshBasicMaterial({ color: hp > 0.5 ? color.primary : color.destructive }));
    bar.position.set(position.x - (1 - hp) * Math.max(token.width, token.length) * 0.375, 0.10, position.y);
    runtime.content.add(bar);

    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.9, token.width), Math.max(0.9, token.length)),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    hit.rotation.x = -Math.PI / 2;
    hit.position.y = 0.06;
    hit.userData.boardHit = { kind: 'token', id: character.id } satisfies BoardHit;
    tokenGroup.add(hit);

    if (token.modelDataUri && token.modelFormat) {
      const fallback = () => makeFallbackStandee(tokenGroup, character, colorHex(color.primary), token);
      installModel(tokenGroup, token, generation, runtime, colorHex(color.primary), fallback);
    } else {
      const imageUri = token.imageDataUri ?? (isVehicle ? undefined : character.portrait);
      if (imageUri) {
        const source = imageUri;
        addTexture(runtime, source, generation, texture => {
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: 0.02 });
          const image = new THREE.Sprite(material);
          const textureImage = texture.image as { width?: number; height?: number } | null;
          const imageAspect = textureImage?.width && textureImage?.height ? textureImage.width / textureImage.height : 1;
          if (isVehicle) {
            image.material.dispose();
            const surface = new THREE.Mesh(
              new THREE.PlaneGeometry(token.width * 0.92, token.length * 0.92),
              new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false }),
            );
            surface.rotation.x = -Math.PI / 2;
            surface.position.y = 0.12;
            tokenGroup.add(surface);
          } else {
            const scale = token.imageScale ?? 1;
            image.scale.set(Math.min(1.15, 0.85 * scale * imageAspect), Math.min(1.55, 0.85 * scale), 1);
            image.position.set((token.imageOffsetX ?? 0) * 0.42, 0.55 + (token.imageOffsetY ?? 0) * 0.42, 0);
            material.rotation = -token.facing * Math.PI / 180;
            image.userData.boardHit = { kind: 'token', id: character.id } satisfies BoardHit;
            tokenGroup.add(image);
          }
        });
      } else makeFallbackStandee(tokenGroup, character, colorHex(color.primary), token);
    }
    if (attacker || defender) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 40),
        new THREE.MeshBasicMaterial({ color: roleColor, transparent: true, opacity: 0.95 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(position.x, 0.1, position.y); runtime.content.add(ring);
    }
    if (props.burstTargetIds?.includes(character.id)) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 6, 40),
        new THREE.MeshBasicMaterial({ color: color.destructive, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(position.x, 0.11, position.y); runtime.content.add(ring);
    }
    if (isVehicle) {
      const crewIds = [character.vehicleCrew?.pilotCharacterId, character.vehicleCrew?.gunnerCharacterId].filter(Boolean) as string[];
      crewIds.slice(0, 2).forEach((id, index) => {
        const crewMarker = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
          new THREE.MeshStandardMaterial({ color: index === 0 ? color.primary : color.secondary, roughness: 0.7 }));
        crewMarker.position.set(index === 0 ? -0.22 : 0.22, 0.55, 0);
        crewMarker.userData.boardHit = { kind: 'crew', id } satisfies BoardHit;
        tokenGroup.add(crewMarker);
      });
    }
  }

  for (const obstacle of board.obstacles) {
    const position = cellPoint(obstacle, board.grid, CELL);
    const obstacleGroup = new THREE.Group();
    obstacleGroup.position.set(position.x, 0, position.y);
    obstacleGroup.rotation.y = -obstacle.facing * Math.PI / 180;
    obstacleGroup.userData.boardHit = { kind: 'obstacle', id: obstacle.id } satisfies BoardHit;
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(obstacle.width, obstacle.length),
      new THREE.MeshBasicMaterial({ color: color.muted, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    sticker.rotation.x = -Math.PI / 2; sticker.position.y = 0.07; obstacleGroup.add(sticker);
    addTexture(runtime, obstacle.imageDataUri, generation, texture => {
      const material = sticker.material as THREE.MeshBasicMaterial;
      material.map?.dispose(); material.map = texture; material.color.set(0xffffff); material.opacity = 1; material.needsUpdate = true;
    });
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(obstacle.width, obstacle.length),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    hit.rotation.x = -Math.PI / 2; hit.position.y = 0.075;
    hit.userData.boardHit = { kind: 'obstacle', id: obstacle.id } satisfies BoardHit;
    obstacleGroup.add(hit); runtime.content.add(obstacleGroup); runtime.interactive.push(obstacleGroup);
    if (props.selectedObstacleId === obstacle.id) {
      const wire = new THREE.Mesh(new THREE.PlaneGeometry(obstacle.width, obstacle.length),
        new THREE.MeshBasicMaterial({ color: color.primary, wireframe: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      wire.rotation.x = -Math.PI / 2; wire.position.y = 0.08; obstacleGroup.add(wire);
    }
  }

  if (props.impact) {
    const impact = cellPoint(props.impact, board.grid, CELL);
    for (const ring of props.rings ?? []) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.1, ring.radius), 0.035, 6, 80),
        new THREE.MeshBasicMaterial({ color: ring.color, transparent: true, opacity: 0.7, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(impact.x, 0.12, impact.y); runtime.content.add(mesh);
    }
    const marker = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.6), new THREE.MeshBasicMaterial({ color: color.destructive }));
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.04), new THREE.MeshBasicMaterial({ color: color.destructive }));
    marker.add(h, v); marker.position.set(impact.x, 0.14, impact.y); runtime.content.add(marker);
  }

  const actor = board.tokens.find(token => token.characterId === props.attackerId);
  const target = board.tokens.find(token => token.characterId === props.defenderId);
  if (actor && target) {
    const a = cellPoint(actor, board.grid, CELL), b = cellPoint(target, board.grid, CELL);
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 0.09, a.y), new THREE.Vector3(b.x, 0.09, b.y)]);
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: color.primary, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.9 }));
    line.computeLineDistances(); runtime.content.add(line);
  }
}

function pickAt(runtime: Runtime, x: number, y: number, board: TacticalBoard): { cell: BoardCell; hit: BoardHit | null } {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((x / Math.max(1, runtime.size.width)) * 2 - 1, -(y / Math.max(1, runtime.size.height)) * 2 + 1), runtime.camera);
  const hits = raycaster.intersectObjects(runtime.interactive, true);
  let hit: BoardHit | null = null;
  for (const intersection of hits) {
    let current: THREE.Object3D | null = intersection.object;
    while (current && !current.userData.boardHit) current = current.parent;
    if (current?.userData.boardHit) { hit = current.userData.boardHit as BoardHit; break; }
  }
  const floorHit = raycaster.intersectObject(runtime.floor, false)[0];
  const point = floorHit?.point ?? new THREE.Vector3(0, 0, 0);
  return { cell: pointCell(point.x, point.z, board.grid, CELL), hit };
}

const Board3DCanvas = forwardRef<BoardCanvasHandle, Props>(function Board3DCanvas(props, ref) {
  const colors = useColors();
  const runtimeRef = useRef<Runtime | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const colorsRef = useRef(colors); colorsRef.current = colors;
  const poseRef = useRef<CameraPose>({ theta: 0.65, phi: 0.78, distance: 18, x: 5, z: 5 });
  const layoutRef = useRef({ width: 0, height: 0 });
  const gestureRef = useRef({
    sx: 0, sy: 0, start: { theta: 0.65, phi: 0.78, distance: 18, x: 5, z: 5 } as CameraPose,
    moved: false, startDistance: 0, startMid: null as null | { x: number; y: number }, hit: null as BoardHit | null,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const buildRef = useRef<(runtime: Runtime) => void>(() => undefined);
  const viewRef = useRef<View | null>(null);

  const focusBoard = (fullBoard: boolean) => {
    const { board } = propsRef.current;
    const first = board.tokens[0] ?? { q: (board.columns - 1) / 2, r: (board.rows - 1) / 2 };
    const point = cellPoint(first, board.grid, CELL);
    const pose = poseRef.current;
    pose.x = point.x; pose.z = point.y;
    pose.distance = fullBoard ? Math.max(board.columns, board.rows) * 1.35 : (board.tokens.length ? 18 : Math.max(board.columns, board.rows) * 0.62);
  };
  useImperativeHandle(ref, () => ({
    fit: () => { focusBoard(true); },
    zoomBy: factor => { poseRef.current.distance = Math.max(2.5, Math.min(350, poseRef.current.distance / factor)); },
  }));

  buildRef.current = runtime => appendScene(runtime, propsRef.current, colorsRef.current);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = new Renderer({ gl, antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(1);
      const size = layoutRef.current;
      renderer.setSize(Math.max(1, gl.drawingBufferWidth || size.width), Math.max(1, gl.drawingBufferHeight || size.height), false);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, Math.max(1, size.width) / Math.max(1, size.height), 0.05, 1000);
      camera.up.set(0, 1, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 1.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.25);
      sun.position.set(-12, 24, 16); scene.add(sun);
      const content = new THREE.Group(); scene.add(content);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: colorsRef.current.card, roughness: 1, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.015; scene.add(floor);
      const runtime: Runtime = {
        gl, renderer, scene, camera, content, floor, size, raf: null, running: true, generation: 0, interactive: [],
      };
      runtimeRef.current = runtime;
      focusBoard(false);
      buildRef.current(runtime);
      setReady(true); setError('');
      let lastFrame = 0;
      const animate = (time: number) => {
        if (!runtime.running) return;
        runtime.raf = requestAnimationFrame(animate);
        if (time - lastFrame < 32) return;
        lastFrame = time;
        const pose = poseRef.current;
        propsRef.current.centerRef.current = pointCell(pose.x, pose.z, propsRef.current.board.grid, CELL);
        const horizontal = pose.distance * Math.cos(pose.phi);
        camera.position.set(
          pose.x + horizontal * Math.sin(pose.theta),
          pose.distance * Math.sin(pose.phi),
          pose.z + horizontal * Math.cos(pose.theta),
        );
        camera.lookAt(pose.x, 0, pose.z);
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      runtime.raf = requestAnimationFrame(animate);
    } catch (caught) {
      const message = tr('3D rendering could not start. Returning to the 2D board.');
      setError(message); propsRef.current.onFallback(message);
    }
  };

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime?.running) buildRef.current(runtime);
  }, [props.board, props.characters, props.selectedId, props.attackerId, props.defenderId, props.activeId,
    props.pathCells, props.impact, props.rings, props.burstCells, props.burstTargetIds, props.selectedObstacleId,
    colors.background, colors.card, colors.text, colors.primary, colors.destructive, colors.border, colors.muted]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof WebGLRenderingContext !== 'undefined') return;
    const message = tr('WebGL is unavailable. Returning to the 2D board.');
    setError(message); props.onFallback(message);
  }, [props.onFallback]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!runtimeRef.current?.running) {
        const message = tr('3D rendering could not start. Returning to the 2D board.');
        setError(message); propsRef.current.onFallback(message);
      }
    }, 12_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.running = false;
    if (runtime.raf !== null) cancelAnimationFrame(runtime.raf);
    for (const child of runtime.content.children) disposeObject(child);
    runtime.floor.geometry.dispose();
    (runtime.floor.material as THREE.Material).dispose();
    runtime.renderer.dispose();
    runtimeRef.current = null;
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    layoutRef.current = { width, height };
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.size = { width, height };
    runtime.camera.aspect = Math.max(1, width) / Math.max(1, height);
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.setSize(Math.max(1, runtime.gl.drawingBufferWidth || width), Math.max(1, runtime.gl.drawingBufferHeight || height), false);
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => {
      const touches = event.nativeEvent.touches ?? [];
      const pose = poseRef.current;
      const state = gestureRef.current;
      state.sx = event.nativeEvent.locationX ?? 0;
      state.sy = event.nativeEvent.locationY ?? 0;
      state.start = { ...pose };
      state.moved = false;
      const runtime = runtimeRef.current;
      state.hit = runtime ? pickAt(runtime, state.sx, state.sy, propsRef.current.board).hit : null;
      state.startDistance = touches.length >= 2 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
      state.startMid = touches.length >= 2 ? {
        x: (touches[0].pageX + touches[1].pageX) / 2,
        y: (touches[0].pageY + touches[1].pageY) / 2,
      } : null;
    },
    onPanResponderMove: (event, gesture) => {
      const state = gestureRef.current, runtime = runtimeRef.current;
      if (!runtime) return;
      const touches = event.nativeEvent.touches ?? [];
      const start = state.start;
      if (touches.length >= 2 && state.startDistance > 0) {
        if (!propsRef.current.cameraControlsEnabled) { state.moved = true; return; }
        const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        const midpoint = { x: (touches[0].pageX + touches[1].pageX) / 2, y: (touches[0].pageY + touches[1].pageY) / 2 };
        poseRef.current.distance = Math.max(2.5, Math.min(350, start.distance * state.startDistance / Math.max(1, distance)));
        panPose(poseRef.current, start, midpoint.x - (state.startMid?.x ?? midpoint.x),
          midpoint.y - (state.startMid?.y ?? midpoint.y), runtime.size.height);
        state.moved = true;
        return;
      }
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6) state.moved = true;
      if (!state.moved) return;
      if (state.hit?.kind === 'token' && propsRef.current.dragEnabled) return;
      if (!propsRef.current.cameraControlsEnabled) return;
      if (propsRef.current.panMode) panPose(poseRef.current, start, gesture.dx, gesture.dy, runtime.size.height);
      else {
        poseRef.current.theta = start.theta - gesture.dx * 0.008;
        poseRef.current.phi = Math.max(0.12, Math.min(1.47, start.phi + gesture.dy * 0.006));
      }
    },
    onPanResponderRelease: (event, gesture) => {
      const state = gestureRef.current, runtime = runtimeRef.current;
      if (runtime && !state.moved) {
        const { cell, hit } = pickAt(runtime, state.sx || event.nativeEvent.locationX || gesture.x0,
          state.sy || event.nativeEvent.locationY || gesture.y0, propsRef.current.board);
        propsRef.current.onTap(cell, hit);
      } else if (runtime && state.hit?.kind === 'token' && propsRef.current.dragEnabled && !state.startMid) {
        const { cell } = pickAt(runtime, state.sx + gesture.dx, state.sy + gesture.dy, propsRef.current.board);
        propsRef.current.onDrop(state.hit.id, cell);
      }
      state.moved = false; state.startDistance = 0; state.startMid = null; state.hit = null;
    },
    onPanResponderTerminate: () => { gestureRef.current.moved = false; },
  })).current;

  return (
    <View ref={viewRef} onLayout={onLayout} style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.background }}>
      <GLView onContextCreate={onContextCreate} style={{ flex: 1 }} />
      <View
        testID="tactical-3d-board-input"
        accessibilityLabel={tr('3D tactical board. Drag to {0}; two fingers or the mouse wheel pan and zoom.', props.panMode ? tr('Pan camera') : tr('Orbit camera'))}
        {...responder.panHandlers}
        {...(Platform.OS === 'web' ? ({
          onWheel: (event: { deltaY: number }) => {
            if (!propsRef.current.cameraControlsEnabled) return;
            poseRef.current.distance = Math.max(2.5, Math.min(350, poseRef.current.distance * (event.deltaY < 0 ? 0.88 : 1.14)));
          },
        } as object) : null)}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', touchAction: 'none' } as object}
      />
      {!ready && !error ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 8 }}>
          <Text style={{ color: colors.text, fontSize: 11 }}>{tr('Preparing the 3D board…')}</Text>
        </View>
      ) : null}
      {error ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: 8, backgroundColor: colors.card, borderColor: colors.destructive, borderWidth: 1, borderRadius: 8 }}>
          <Text style={{ color: colors.text, fontSize: 11 }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

function panPose(pose: CameraPose, start: CameraPose, dx: number, dy: number, height: number) {
  const amount = start.distance / Math.max(180, height) * 2;
  pose.x = start.x - dx * amount * Math.cos(start.theta) + dy * amount * Math.sin(start.theta);
  pose.z = start.z + dx * amount * Math.sin(start.theta) - dy * amount * Math.cos(start.theta);
}

export default Board3DCanvas;
