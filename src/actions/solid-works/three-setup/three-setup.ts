// /app/seu-caminho/_actions/three-setup.ts
import * as THREE from "three";
import { WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import { ViewerState } from "@/components/common/view-3d";

/**
 * Módulo Three.js: loaders compartilhados, utilitários e organização de hierarquia.
 */

/* -------------------- Configuração Global -------------------- */
THREE.Cache.enabled = true;
const DRACO_DECODER_PATH = "/draco/";

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath(DRACO_DECODER_PATH);

/* Tipos exportados */
export type ThreeScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: InstanceType<typeof OrbitControls>;
  mesh?: THREE.Object3D | null;
};

export type InteractiveThreeScene = ThreeScene & {
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
};

export type LoadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percent: number;
}) => void;

/* -------------------- Utilitários de animação (interno, leve) -------------------- */

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function animateVector3(
  from: THREE.Vector3,
  to: THREE.Vector3,
  duration = 800,
  onUpdate?: (v: THREE.Vector3) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const temp = new THREE.Vector3();
    const loop = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const e = easeOutCubic(t);
      temp.copy(from).lerp(to, e);
      onUpdate?.(temp);
      if (t < 1) requestAnimationFrame(loop);
      else resolve();
    };
    requestAnimationFrame(loop);
  });
}

/* -------------------- Funções utilitárias -------------------- */

export function setupScene(
  container: HTMLDivElement,
  options?: { pixelRatio?: number; performanceMode?: boolean },
): ThreeScene {
  const width = Math.max(container.clientWidth, 16);
  const height = Math.max(container.clientHeight, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(
    options?.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2),
  );
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  // modern color space check
  try {
    (renderer as WebGLRenderer).outputColorSpace =
      (THREE as unknown as { SRGBColorSpace: typeof THREE.SRGBColorSpace })
        .SRGBColorSpace ?? THREE.SRGBColorSpace;
  } catch {
    (renderer as WebGLRenderer).outputColorSpace = THREE.SRGBColorSpace;
  }

  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // leve fundo claro (melhora visualização das peças)
  scene.background = new THREE.Color("#f3f4f6");

  // Luzes melhoradas
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  scene.add(hemi);

  const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
  dir1.position.set(100, 200, 100);
  dir1.castShadow = true;
  dir1.shadow.mapSize.width = 2048;
  dir1.shadow.mapSize.height = 2048;
  dir1.shadow.camera.near = 0.5;
  dir1.shadow.camera.far = 500;
  scene.add(dir1);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
  camera.position.set(200, 150, 200);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = true;

  const handleResize = () => {
    const w = Math.max(container.clientWidth, 16);
    const h = Math.max(container.clientHeight, 16);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", handleResize);

  (
    renderer as unknown as { __contextCleanupMethod?: () => void }
  ).__contextCleanupMethod = handleResize;

  return { renderer, scene, camera, controls, mesh: null };
}

export function setupInteraction(scene: ThreeScene): InteractiveThreeScene {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const originalMaterials = new Map<
    THREE.Mesh,
    THREE.Material | THREE.Material[]
  >();
  return { ...scene, raycaster, mouse, originalMaterials };
}

export function normalizeModelSizeAndPosition(
  mesh: THREE.Object3D,
  floatingY = 4,
) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) return;

  mesh.position.sub(center);
  mesh.position.y = mesh.position.y + size.y / 2 + floatingY;
}

/* -------------------- Carregamento GLB (com organização) -------------------- */

export const loadGLB = (
  url: string,
  onProgress?: LoadProgressCallback,
): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    // We instantiate a new GLTFLoader per request to prevent internal LoadingManager
    // from prematurely revoking object URLs when parsing embedded textures concurrently.
    const loader = new GLTFLoader();
    loader.setDRACOLoader(sharedDracoLoader);

    loader.load(
      url,
      (gltf: GLTF) => {
        const model = gltf.scene as THREE.Group;

        // organiza a hierarquia: renomeia e promove meshes solitários
        cleanAndOrganizeHierarchy(model);

        // garantir sombras e geometria válida
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            if (!m.geometry || !m.geometry.attributes?.position) return;
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });

        resolve(model);
      },
      (xhr: ProgressEvent) => {
        if (onProgress && xhr.total > 0) {
          onProgress({
            loaded: xhr.loaded,
            total: xhr.total,
            percent: (xhr.loaded / xhr.total) * 100,
          });
        }
      },
      (error: unknown) => {
        console.error("Erro ao carregar GLB:", error);
        reject(error);
      },
    );
  });
};

export const load3MF = (
  url: string,
  onProgress?: LoadProgressCallback,
): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    const loader = new ThreeMFLoader();
    loader.load(
      url,
      (object) => {
        object.rotation.x = -Math.PI / 2;

        cleanAndOrganizeHierarchy(object);

        // Ensure shadows
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });

        resolve(object);
      },
      (xhr) => {
        if (onProgress && xhr.total > 0) {
          onProgress({
            loaded: xhr.loaded,
            total: xhr.total,
            percent: (xhr.loaded / xhr.total) * 100,
          });
        }
      },
      (error) => {
        console.error("Erro ao carregar 3MF:", error);
        reject(error);
      },
    );
  });
};

export const loadModel = (
  url: string,
  onProgress?: LoadProgressCallback,
): Promise<THREE.Group> => {
  const extension = url.split(".").pop()?.toLowerCase();
  if (extension === "3mf") {
    return load3MF(url, onProgress);
  }
  return loadGLB(url, onProgress);
};

/* -------------------- Organização de Hierarquia / Herança de nomes -------------------- */

export function cleanAndOrganizeHierarchy(model: THREE.Object3D) {
  const renameGeneric = (
    name: string | undefined,
    parentName: string,
  ): string => {
    if (!name) return parentName ? `${parentName}_mesh` : "mesh";
    const clean = name.trim().toLowerCase();
    if (
      clean === "" ||
      clean === "default" ||
      clean === "scene" ||
      clean === "predeterminada" ||
      clean.startsWith("mesh")
    ) {
      return parentName ? `${parentName}_mesh` : "mesh";
    }
    return name;
  };

  const assignNamesRecursively = (
    obj: THREE.Object3D,
    level = 0,
    parentName = "",
    parentPath = "",
  ) => {
    obj.name = renameGeneric(obj.name, parentName);
    const path = parentPath ? `${parentPath} > ${obj.name}` : obj.name;
    obj.userData.level = level;
    obj.userData.path = path;

    // primeira: promover filhos únicos que são Mesh (elimina níveis desnecessários)
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const child = obj.children[i];
      if (
        (child as THREE.Group).children &&
        (child as THREE.Group).children.length === 1
      ) {
        const onlyChild = (child as THREE.Object3D).children[0];
        if ((onlyChild as THREE.Mesh).isMesh && !(child as THREE.Mesh).isMesh) {
          // mova onlyChild para obj, removendo wrapper child
          onlyChild.position.applyMatrix4(child.matrix);
          onlyChild.quaternion.premultiply(child.quaternion);
          obj.add(onlyChild);
          obj.remove(child);
        }
      }
    }

    // percorre filhos (após possível promoção)
    for (const child of obj.children) {
      assignNamesRecursively(child, level + 1, obj.name, path);
    }
  };

  assignNamesRecursively(model, 0, "", "");

  // extra: marque nodes com geometria como componentes
  model.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.userData.isComponent = true;
  });
}

/* -------------------- Função que monta uma árvore serializável -------------------- */

/* -------------------- Função que monta uma árvore serializável -------------------- */

export interface HierarchyNode {
  id: string;
  name: string;
  type: "group" | "mesh";
  children: HierarchyNode[];
  object?: THREE.Object3D;
  level: number;
  properties?: Record<string, unknown>;
}

export function getHierarchy(
  model: THREE.Object3D,
  filterEmpty = true,
): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];

  const processNode = (
    obj: THREE.Object3D,
    level: number,
  ): HierarchyNode | null => {
    // 1. Filtros Básicos
    const name = obj.name || "unnamed";
    const lowerName = name.toLowerCase();

    // Ignorar nós auxiliares ou técnicos irrelevantes para o usuário
    if (
      lowerName.includes("camera") ||
      lowerName.includes("light") ||
      lowerName.includes("scene") ||
      lowerName === "default"
    ) {
      return null;
    }

    // 2. Determinar Tipo
    const isMesh = (obj as THREE.Mesh).isMesh;
    const type: "group" | "mesh" = isMesh ? "mesh" : "group";

    // 3. Extrair Propriedades (UserData + Extras)
    const properties: Record<string, unknown> | undefined = {
      ...obj.userData,
      ...((obj as unknown as Record<string, unknown>).extras as Record<
        string,
        unknown
      >),
    };

    // 3. Processar Filhos Recursivamente
    let children: HierarchyNode[] = [];
    if (obj.children.length > 0) {
      children = obj.children
        .map((child) => processNode(child, level + 1))
        .filter((node): node is HierarchyNode => node !== null);
    }

    // 4. Lógica de "Limpeza" (Flattening/Simplificação)

    // Caso A: Grupo vazio (sem filhos e não é mesh) -> Ignorar
    if (type === "group" && children.length === 0 && filterEmpty) {
      return null;
    }

    // Caso B: Grupo com apenas 1 filho -> Promover o filho (Flatten)
    if (type === "group" && children.length === 1 && filterEmpty) {
      const onlyChild = children[0];

      return {
        ...onlyChild,
        name: name,
        level: level,
        // Merge properties from parent if child doesn't have them?
        // Or keep child's? Let's keep child's but maybe merge if parent has important info.
        // For now, simple promotion.
      };
    }

    return {
      id: obj.uuid,
      name: name,
      type,
      children,
      object: obj,
      level,
      properties,
    };
  };

  // Processar a raiz
  if (model.children.length > 0) {
    model.children.forEach((child) => {
      const node = processNode(child, 0);
      if (node) nodes.push(node);
    });
  } else {
    const node = processNode(model, 0);
    if (node) nodes.push(node);
  }

  return nodes;
}

// Mantendo compatibilidade temporária se algo ainda usar, mas idealmente deve ser removido
export function buildHierarchyTree(
  obj: THREE.Object3D,
): Record<string, unknown> {
  return getHierarchy(obj)[0] as unknown as Record<string, unknown>;
}

/* -------------------- Materiais / Reset de cor -------------------- */

export function collectOriginalMaterials(
  model: THREE.Object3D,
  originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>,
) {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;
      const clone = Array.isArray(mesh.material)
        ? mesh.material.map((m) => (m as THREE.Material).clone())
        : (mesh.material as THREE.Material).clone();
      originalMaterials.set(mesh, clone);
    }
  });
}

export function resetModelColor(
  model: THREE.Object3D,
  originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>,
) {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const originalMaterial = originalMaterials.get(mesh);

      if (originalMaterial) {
        mesh.material = Array.isArray(originalMaterial)
          ? originalMaterial.map((m) => (m as THREE.Material).clone())
          : (originalMaterial as THREE.Material).clone();
      }
    }
  });
}

/* -------------------- Interação e Raycast -------------------- */

export function getIntersects(
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  objects: THREE.Object3D[],
): THREE.Intersection[] {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  // detecta todos e ordena por distância
  return raycaster.intersectObjects(objects, true);
}

/* -------------------- Destaque de peça -------------------- */

export function highlightPart(
  model: THREE.Group,
  partName: string | null,
  highlightColor: number = 0xff8c00,
) {
  if (!partName) return;

  const baseMat = new THREE.MeshStandardMaterial({
    color: highlightColor,
    emissive: highlightColor,
    emissiveIntensity: 0.2,
    roughness: 0.45,
    metalness: 0.05,
    transparent: true,
    opacity: 0.95,
  });

  model.traverse((child) => {
    if (
      (child as THREE.Mesh).isMesh &&
      child.name.toLowerCase() === partName.toLowerCase()
    ) {
      const mesh = child as THREE.Mesh;
      mesh.material = baseMat.clone();
    }
  });
}

/* -------------------- Ajuste de câmera para objeto (com animação opcional) -------------------- */

export async function fitCameraToObject(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: InstanceType<typeof OrbitControls>,
  object: THREE.Object3D,
  aspect: number,
  animate = true,
) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const SAFE_DIM = 200;
  const effectiveDim = maxDim > 0.01 ? maxDim : SAFE_DIM;

  let cameraZ: number;

  if (camera instanceof THREE.PerspectiveCamera) {
    const fov = camera.fov * (Math.PI / 180);
    cameraZ = Math.abs(effectiveDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.3;
  } else {
    const scale = effectiveDim * 0.65;
    camera.left = -scale * aspect;
    camera.right = scale * aspect;
    camera.top = scale;
    camera.bottom = -scale;
    cameraZ = effectiveDim * 2;
    camera.updateProjectionMatrix();
  }

  // compute target camera position based on current direction
  let originalDir = camera.position
    .clone()
    .sub(controls.target || new THREE.Vector3());
  if (originalDir.lengthSq() < 0.01) {
    originalDir = new THREE.Vector3(1, 0.6, 1);
  }
  originalDir.normalize().multiplyScalar(cameraZ * 1.5);
  const newCameraPos = center.clone().add(originalDir);

  if (!animate) {
    camera.position.copy(newCameraPos);
    controls.target.copy(center);
    controls.update();
    return;
  }

  // animação suave sem dependências
  await Promise.all([
    animateVector3(camera.position.clone(), newCameraPos, 900, (v) => {
      camera.position.copy(v);
      controls.update();
    }),
    animateVector3(controls.target.clone(), center.clone(), 900, (v) => {
      controls.target.copy(v);
      controls.update();
    }),
  ]);

  camera.updateProjectionMatrix();
}

/* -------------------- Thumbnails -------------------- */
// Mantive sua implementação (sem mudanças funcionais significativas)
export type ThumbnailResolution = "high" | "medium" | "low" | "very_low";

const resolutionPresets = {
  high: {
    width: 512,
    height: 512,
    antialias: true,
    pixelRatio: 1,
    imageQuality: 0.9,
    format: "image/png" as const,
    timeout: 100,
  },
  medium: {
    width: 384,
    height: 384,
    antialias: false,
    pixelRatio: 1,
    imageQuality: 0.85,
    format: "image/jpeg" as const,
    timeout: 75,
  },
  low: {
    width: 256,
    height: 256,
    antialias: false,
    pixelRatio: 1,
    imageQuality: 0.8,
    format: "image/jpeg" as const,
    timeout: 50,
  },
  very_low: {
    width: 200,
    height: 200,
    antialias: false,
    pixelRatio: 1,
    imageQuality: 0.7,
    format: "image/jpeg" as const,
    timeout: 10,
  },
};

export async function renderThumbnailToDataURL(
  model: THREE.Object3D,
  resolution: ThumbnailResolution = "medium",
  backgroundColor = 0xf0f0f0,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const preset = resolutionPresets[resolution];
      const { width, height, antialias, imageQuality, format, timeout } =
        preset;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(preset.pixelRatio);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);

      const bbox = new THREE.Box3().setFromObject(model);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 10;

      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        -maxDim * aspect,
        maxDim * aspect,
        maxDim,
        -maxDim,
        0.1,
        1000,
      );
      const distance = maxDim * 2;
      camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
      directionalLight.position.set(1, 1, 1).normalize();

      scene.add(ambientLight);
      if (resolution === "high" || resolution === "medium") {
        scene.add(directionalLight);
      }
      scene.add(model);

      if (resolution === "low" || resolution === "very_low") {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((mat) => {
              (mat as unknown as { precision: string }).precision = "lowp";
              (mat as unknown as { dithering: boolean }).dithering = false;
            });
          }
        });
      }

      renderer.render(scene, camera);

      setTimeout(() => {
        try {
          const dataUrl = canvas.toDataURL(format, imageQuality);
          if (!dataUrl || dataUrl === "data:,") {
            reject(new Error("Falha ao gerar data URL"));
            return;
          }
          scene.remove(model);
          renderer.dispose();
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      }, timeout);
    } catch (error) {
      reject(error);
    }
  });
}

/* -------------------- Descarte de objetos -------------------- */

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        (mesh.geometry as THREE.BufferGeometry).dispose();
      }
      if (mesh.material) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((m) => {
          for (const key in m) {
            const value = (m as unknown as { [k: string]: THREE.Texture })[key];
            if (
              value &&
              (value as unknown as { isTexture: boolean }).isTexture
            ) {
              (value as THREE.Texture).dispose();
            }
          }
          if ((m as unknown as { dispose: () => void }).dispose)
            (m as unknown as { dispose: () => void }).dispose();
        });
        (mesh.material as unknown as THREE.Material[]) = [];
      }
    }
  });

  if (obj.parent) {
    obj.parent.remove(obj);
  }
}

/* -------------------- Display / Visual Modes / Sections / Explode -------------------- */

export function applyDisplayMode(
  currentCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  mode: ViewerState["displayMode"],
  controls: InstanceType<typeof OrbitControls> | null,
  width: number,
  height: number,
): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const aspect = width / height;
  let newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  if (
    mode === "perspective" &&
    !(currentCamera instanceof THREE.PerspectiveCamera)
  ) {
    newCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  } else if (
    mode === "orthographic" &&
    !(currentCamera instanceof THREE.OrthographicCamera)
  ) {
    const size = 10;
    newCamera = new THREE.OrthographicCamera(
      -size * aspect,
      size * aspect,
      size,
      -size,
      0.1,
      1000,
    );
  } else {
    return currentCamera;
  }

  newCamera.position.copy(currentCamera.position);
  if (controls) {
    newCamera.lookAt(controls.target);
    controls.object = newCamera;
  } else {
    newCamera.lookAt(new THREE.Vector3());
  }

  newCamera.updateProjectionMatrix();
  return newCamera;
}

export function applyVisualMode(
  scene: THREE.Scene,
  model: THREE.Group,
  mode: ViewerState["visualMode"],
  originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>,
) {
  resetModelColor(model, originalMaterials);

  scene.traverse((object) => {
    if (
      (object as unknown as { userData: { isVisualModeAuxiliary: boolean } })
        .userData?.isVisualModeAuxiliary
    ) {
      scene.remove(object);
      disposeObject(object);
    }
  });

  if (mode === "shaded") return;

  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.Material) {
          material.visible = true;
          (material as unknown as { wireframe: boolean }).wireframe = false;
        }
      });

      switch (mode) {
        case "wireframe":
          object.material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
          });
          break;

        case "hidden":
          applyHiddenLineRendering(object, scene);
          break;

        case "hlr":
          materials.forEach((material) => {
            if (
              (
                material as unknown as {
                  instanceof: (constructor: unknown) => boolean;
                }
              ).instanceof(THREE.MeshStandardMaterial)
            ) {
              (material as unknown as { transparent: boolean }).transparent =
                true;
              (material as unknown as { opacity: number }).opacity = 0.3;
              (material as unknown as { side: THREE.Side }).side =
                THREE.DoubleSide;
            }
          });
          break;
      }
    }
  });
}

const applyHiddenLineRendering = (mesh: THREE.Mesh, scene: THREE.Scene) => {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
  });
  const wireframe = new THREE.LineSegments(edges, lineMaterial);

  (
    wireframe as unknown as { userData: { isVisualModeAuxiliary: boolean } }
  ).userData.isVisualModeAuxiliary = true;
  wireframe.position.copy(mesh.position);
  wireframe.rotation.copy(mesh.rotation);
  wireframe.scale.copy(mesh.scale);

  scene.add(wireframe);
  mesh.visible = false;
};

export const applySectionView = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  section: ViewerState["section"],
) => {
  let plane: THREE.Plane;

  switch (section.type) {
    case "xy":
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -section.position);
      break;
    case "yz":
      plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -section.position);
      break;
    case "xz":
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -section.position);
      break;
    case "planar":
      plane = new THREE.Plane(
        new THREE.Vector3(1, 1, 1).normalize(),
        -section.position,
      );
      break;
  }

  renderer.clippingPlanes = [plane!];

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.Material) {
          (
            material as unknown as { clippingPlanes: THREE.Plane[] }
          ).clippingPlanes = [plane!];
          (material as unknown as { clipShadows: boolean }).clipShadows = true;
        }
      });
    }
  });

  if (section.capping) {
    addSectionCap(scene, plane!, section.type);
  }
};

export const removeSectionView = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
) => {
  renderer.clippingPlanes = [];

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.Material) {
          (
            material as unknown as { clippingPlanes: THREE.Plane[] }
          ).clippingPlanes = [];
          (material as unknown as { clipShadows: boolean }).clipShadows = false;
        }
      });
    }
  });

  const cap = scene.getObjectByName("sectionCap");
  if (cap) {
    scene.remove(cap);
    disposeObject(cap);
  }
};

const addSectionCap = (
  scene: THREE.Scene,
  plane: THREE.Plane,
  type: string,
) => {
  const capGeometry = new THREE.PlaneGeometry(500, 500);
  const capMaterial = new THREE.MeshBasicMaterial({
    color: 0x888888,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
    clippingPlanes: [],
  });

  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.name = "sectionCap";

  switch (type) {
    case "xy":
      cap.position.z = -plane.constant;
      break;
    case "yz":
      cap.position.x = -plane.constant;
      cap.rotation.y = Math.PI / 2;
      break;
    case "xz":
      cap.position.y = -plane.constant;
      cap.rotation.x = Math.PI / 2;
      break;
  }

  scene.add(cap);
};

/* -------------------- Explode / Reset -------------------- */

export interface ExplosionDebugInfo {
  center: THREE.Vector3;
  size: THREE.Vector3;
  scale: number;
  parts: {
    name: string;
    dist: number;
    dir: THREE.Vector3;
    finalPos: THREE.Vector3;
  }[];
}

export const applyExplodeView = (
  model: THREE.Group,
  explodeState: { active: boolean; distance: number },
  debug: boolean = false,
  onDebugUpdate?: (info: ExplosionDebugInfo) => void,
) => {
  // Remove debug helpers if they exist
  const existingDebug = model.getObjectByName("explodeDebugHelper");
  if (existingDebug) {
    model.remove(existingDebug);
    disposeObject(existingDebug);
  }

  if (!explodeState.active || explodeState.distance === 0) {
    // Reset positions - GARANTE RETORNO PRECISO
    model.traverse((object) => {
      if (object.userData.originalPosition) {
        object.position.copy(object.userData.originalPosition);
      }
    });
    return;
  }

  // Calcula o bounding box de toda a montagem BASEADO NAS POSIÇÕES ORIGINAIS (Local Space)
  const assemblyBox = new THREE.Box3();
  let hasComponents = false;

  model.traverse((object) => {
    if (object.userData.isComponent && object.userData.originalPosition) {
      assemblyBox.expandByPoint(
        object.userData.originalPosition as THREE.Vector3,
      );
      hasComponents = true;
    }
  });

  if (!hasComponents) {
    assemblyBox.setFromObject(model);
    const inverse = model.matrixWorld.clone().invert();
    assemblyBox.applyMatrix4(inverse);
  }

  const assemblyCenter = assemblyBox.getCenter(new THREE.Vector3());
  const assemblySize = assemblyBox.getSize(new THREE.Vector3());

  assemblyCenter.y += assemblySize.y * 0.1;
  assemblyCenter.x += assemblySize.x * -0.14;
  assemblyCenter.z += assemblySize.z * -0.1;

  // Visual Debug do Centro
  if (debug) {
    const debugHelper = new THREE.Group();
    debugHelper.name = "explodeDebugHelper";

    // Esfera no centro
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(assemblySize.length() * 0.02, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
        depthTest: false,
        transparent: true,
        opacity: 0.8,
      }),
    );
    sphere.position.copy(assemblyCenter);
    sphere.renderOrder = 999;
    debugHelper.add(sphere);

    // Eixos no centro
    const axes = new THREE.AxesHelper(assemblySize.length() * 0.2);
    axes.position.copy(assemblyCenter);
    debugHelper.add(axes);

    // Box wireframe
    const boxHelper = new THREE.Box3Helper(assemblyBox, 0xffff00);
    debugHelper.add(boxHelper);

    model.add(debugHelper);
  }

  // Fator de escala baseado no maior eixo da montagem
  const maxAssemblySize = Math.max(
    assemblySize.x,
    assemblySize.y,
    assemblySize.z,
  );

  // REDUZIDO: Fator de expansão base relativo ao tamanho do modelo
  // Antes 0.5, agora 0.2 para controlar melhor a explosão "muito além"
  const expansionScale = maxAssemblySize * 0.2;

  const debugParts: {
    name: string;
    dist: number;
    dir: THREE.Vector3;
    finalPos: THREE.Vector3;
  }[] = [];

  model.traverse((object) => {
    if (object.userData.isComponent && object.userData.originalPosition) {
      const originalPosition = object.userData
        .originalPosition as THREE.Vector3;

      // Vetor direção do centro da montagem para a posição original da peça
      const direction = new THREE.Vector3().subVectors(
        originalPosition,
        assemblyCenter,
      );

      // TWEAK: Reduzir o componente Y para "achatar" a explosão
      // Isso ajuda a evitar a sensação de que o modelo está "voando" ou abrindo muito para cima
      direction.y *= 0.5; // Aumentado um pouco (de 0.35 para 0.5) já que subimos o centro

      const distFromCenter = direction.length();

      // Evita divisão por zero e normaliza
      if (distFromCenter > 0.001) {
        direction.normalize();
      } else {
        direction.set(0, 1, 0).normalize();
      }

      // Lógica Proporcional Controlada:
      // Normalizamos a distância do centro em relação ao tamanho do modelo
      const normalizedDist = distFromCenter / (maxAssemblySize / 2);

      // Fator de escala progressivo:
      const progressiveFactor = 1 + normalizedDist * 1.5; // Reduzido fator progressivo também

      const finalDistance =
        explodeState.distance * expansionScale * progressiveFactor;

      // Aplica o movimento
      const newPos = originalPosition
        .clone()
        .add(direction.clone().multiplyScalar(finalDistance));
      object.position.copy(newPos);

      if (debug && debugParts.length < 10) {
        debugParts.push({
          name: object.name,
          dist: distFromCenter,
          dir: direction,
          finalPos: newPos,
        });
      }
    }
  });

  if (debug && onDebugUpdate) {
    onDebugUpdate({
      center: assemblyCenter,
      size: assemblySize,
      scale: expansionScale,
      parts: debugParts,
    });
  }
};

/* -------------------- Função auxiliar para explosão animada -------------------- */

/**
 * Função melhorada para explosão animada com transição suave
 */
export const animateExplodeView = async (
  model: THREE.Group,
  targetDistance: number,
  duration: number = 800,
): Promise<void> => {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const startPositions = new Map<THREE.Object3D, THREE.Vector3>();

    // Armazena posições atuais
    model.traverse((object) => {
      if (object.userData.isComponent) {
        startPositions.set(object, object.position.clone());
      }
    });

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function para transição suave
      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;

      // Aplica explosão com distância interpolada
      applyExplodeView(model, {
        active: true,
        distance: targetDistance * easedProgress,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
};

/* -------------------- Orientações rápidas -------------------- */

export const setViewOrientation = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: InstanceType<typeof OrbitControls>,
  orientation: "top" | "bottom" | "left" | "right" | "front" | "back" | "iso",
) => {
  const target = controls.target.clone();
  let direction: THREE.Vector3;

  switch (orientation) {
    case "top":
      direction = new THREE.Vector3(0, 1, 0);
      break;
    case "bottom":
      direction = new THREE.Vector3(0, -1, 0);
      break;
    case "left":
      direction = new THREE.Vector3(-1, 0, 0);
      break;
    case "right":
      direction = new THREE.Vector3(1, 0, 0);
      break;
    case "front":
      direction = new THREE.Vector3(0, 0, 1);
      break;
    case "back":
      direction = new THREE.Vector3(0, 0, -1);
      break;
    case "iso":
      direction = new THREE.Vector3(1, 1, 1).normalize();
      break;
  }

  const currentDistance = camera.position.distanceTo(target);
  const newPosition = target
    .clone()
    .add(direction.multiplyScalar(currentDistance));

  camera.position.copy(newPosition);
  controls.update();
};

export const resetCamera = async (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: InstanceType<typeof OrbitControls>,
  model: THREE.Group,
  duration: number = 800,
) => {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Posição padrão isométrica
  const dist = maxDim * 2.0; // Ajuste conforme necessário
  const offset = new THREE.Vector3(dist, dist * 0.8, dist); // ISO view
  const targetPos = center.clone().add(offset);

  await Promise.all([
    animateVector3(camera.position.clone(), targetPos, duration, (v) => {
      camera.position.copy(v);
      controls.update();
    }),
    animateVector3(controls.target.clone(), center, duration, (v) => {
      controls.target.copy(v);
      controls.update();
    }),
  ]);
};

/* -------------------- Suporte para PecaItem e VisualizadorModal -------------------- */

export async function getTopLevelNodes(url: string): Promise<string[]> {
  try {
    const model = await loadGLB(url);
    const names = new Set<string>();

    model.traverse((child) => {
      const level = child.userData?.level ?? 0;
      if (level <= 2 && child.name) {
        names.add(child.name);
      }
    });

    return Array.from(names);
  } catch (err) {
    console.error("Erro ao obter nós de topo:", err);
    return [];
  }
}

/**
 * Extrai um nó (peça ou submontagem) por nome do modelo carregado
 * Retorna um clone centrado e normalizado para inserção como isolatedPart.
 */
export function extractPartByName(
  model: THREE.Object3D,
  partName: string,
): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  model.traverse((child) => {
    if (child.name && child.name.toLowerCase() === partName.toLowerCase()) {
      found = child;
    }
  });
  if (!found) return null;

  // clone profundo e normalize posição
  const clone = (
    found as unknown as { clone: (deep?: boolean) => THREE.Object3D }
  ).clone(true) as THREE.Object3D;
  // remove possíveis parent transforms (re-aplica world matrix to geometry if needed)
  // For safety, set local transforms to zero — we'll rely on normalizeModelSizeAndPosition
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  normalizeModelSizeAndPosition(clone);
  return clone;
}
