// /app/seu-caminho/components/common/view-3d.tsx
"use client";

import { Camera, Eye, Hand, Maximize2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import {
  applyDisplayMode,
  applyExplodeView,
  applySectionView,
  applyVisualMode,
  collectOriginalMaterials,
  disposeObject,
  ExplosionDebugInfo,
  fitCameraToObject,
  getIntersects,
  InteractiveThreeScene,
  loadModel,
  normalizeModelSizeAndPosition,
  removeSectionView,
  resetCamera,
  resetModelColor,
  setupInteraction,
  setupScene,
  setViewOrientation,
} from "@/actions/solid-works/three-setup/three-setup";

//  Sistema de easing functions para animações suaves
const EasingFunctions = {
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

export interface ViewerState {
  displayMode: "perspective" | "orthographic";
  visualMode: "shaded" | "wireframe" | "hidden" | "hlr";
  section: {
    active: boolean;
    type: "xy" | "yz" | "xz" | "planar";
    position: number;
    capping: boolean;
  };
  explode: {
    active: boolean;
    distance: number;
  };
}

export type View3DRef = {
  isModelLoaded: () => boolean;
  getSelectedPartName: () => string | null;
  highlightPartByName: (partName: string | null) => void;
  setViewerState: (state: Partial<ViewerState>) => void;
  getViewerState: () => ViewerState;
  setViewOrientation: (
    orientation: "top" | "bottom" | "left" | "right" | "front" | "back" | "iso",
  ) => void;
  animateToPart: (partName: string, duration?: number) => Promise<void>;
  explodeAssembly: (distance: number) => Promise<void>;
  resetExplosion: (duration?: number) => Promise<void>;
  isolatePart: (partName: string | null, duration?: number) => Promise<void>;
  getPathToPart: (partName: string) => string[];
};

interface View3DProps {
  modelUrl: string;
  className?: string;
  onModelLoaded?: (model: THREE.Group) => void;
  onModelError?: (error: Error) => void;
  onPartSelected?: (partName: string | null) => void;
  thumbnailMode?: boolean;
  selectedPartName?: string | null;
  isolatedPart?: THREE.Object3D | null;
  thumbnailSize?: number;
  initialViewerState?: Partial<ViewerState>;
  onAddToCart?: (item: { name: string; path: string }) => void;
  onViewProperties?: (name: string | null) => void;
  enableAnimations?: boolean;
  animationDuration?: number;
  interactionMode?:
    | "interactive"
    | "view-only"
    | "static-highlight"
    | "static-isolation";
  lockedPart?: string;
  performanceMode?: boolean;
  onCameraChange?: (
    rotation: { x: number; y: number; z: number },
    matrix3d?: string,
  ) => void;
}

export const View3D = React.forwardRef<View3DRef, View3DProps>(
  (
    {
      modelUrl,
      onModelLoaded,
      onModelError,
      onPartSelected,
      thumbnailMode = false,
      selectedPartName = null,
      isolatedPart = null,
      initialViewerState = {},
      onAddToCart,
      onViewProperties,
      enableAnimations = true,
      animationDuration = 800,
      className,
      interactionMode = "interactive",
      lockedPart,
      performanceMode = false,
      onCameraChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<InteractiveThreeScene | null>(null);
    const animationFrameRef = useRef<number>(0);

    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [currentSelectedPart, setCurrentSelectedPart] = useState<
      string | null
    >(null);
    const [isLoadingPart, setIsLoadingPart] = useState(true);
    const [isIsolatedMode, setIsIsolatedMode] = useState(false);

    // Context menu state
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [contextMenuTarget, setContextMenuTarget] = useState<string | null>(
      null,
    );
    const mouseDownTimeRef = useRef(0); // 🎯 Changed to Ref for instant access
    const [touchStartPosition, setTouchStartPosition] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const lastTouchTimeRef = useRef<number>(0); // 🎯 Ref para evitar conflito Touch -> Mouse emulado
    const [isLongPress, setIsLongPress] = useState(false);
    const longPressThreshold = 300;

    const onCameraChangeRef = useRef(onCameraChange);
    useEffect(() => {
      onCameraChangeRef.current = onCameraChange;
    }, [onCameraChange]);

    const [viewerState, setViewerState] = useState<ViewerState>({
      displayMode: "perspective",
      visualMode: "shaded",
      section: {
        active: false,
        type: "xy",
        position: 0,
        capping: true,
      },
      explode: {
        active: false,
        distance: 0,
      },
      ...initialViewerState,
    });

    const [debugMode, setDebugMode] = useState(false);
    const [debugInfo, setDebugInfo] = useState<ExplosionDebugInfo | null>(null);
    const [manipulationMode, setManipulationMode] = useState<"view" | "move">(
      "view",
    );
    const [dragState, setDragState] = useState<{
      active: boolean;
      object: THREE.Object3D | null;
      plane: THREE.Plane;
      offset: THREE.Vector3;
      hasMoved: boolean;
      startScreenPos: { x: number; y: number } | null;
    }>({
      active: false,
      object: null,
      plane: new THREE.Plane(),
      offset: new THREE.Vector3(),
      hasMoved: false,
      startScreenPos: null,
    });
    const [movedParts, setMovedParts] = useState<Set<string>>(new Set());

    //  Função para validar nomes de peças (ignora meshs genéricos)
    const isValidPartName = useCallback((name: string | null): boolean => {
      if (!name) return false;

      const lowerName = name.toLowerCase();
      return (
        !lowerName.includes("mesh") &&
        !lowerName.includes("default") &&
        !lowerName.includes("scene") &&
        !lowerName.includes("predeterminada") &&
        name.trim() !== "" &&
        name !== "unnamed"
      );
    }, []);

    //  Encontra o ancestor que representa um "grupo" real
    const findGroupCandidate = useCallback(
      (
        node: THREE.Object3D | null,
        root: THREE.Object3D,
      ): THREE.Object3D | null => {
        if (!node) return null;

        // Procura o primeiro ancestor com nome válido
        const candidate: THREE.Object3D | null = node;

        // Se o próprio nó tem nome válido, usa ele
        if (isValidPartName(candidate.name)) {
          return candidate;
        }

        // Sobe procurando ancestor com nome válido
        let p = candidate.parent;
        while (p && p !== root) {
          if (isValidPartName(p.name)) {
            return p;
          }
          p = p.parent;
        }

        return candidate;
      },
      [isValidPartName],
    );

    // Memoized scene setup
    const sceneConfig = useMemo(
      () => ({
        pixelRatio: thumbnailMode
          ? 1
          : performanceMode
            ? 1
            : Math.min(window.devicePixelRatio || 1, 2),
        performanceMode,
        controls: {
          enableDamping: !thumbnailMode,
          dampingFactor: 0.05,
          rotateSpeed: 1.0,
        },
      }),
      [thumbnailMode, performanceMode],
    );

    // Sistema de animação genérico
    const animateValue = useCallback(
      async (
        from: number,
        to: number,
        duration: number,
        update: (value: number) => void,
        easing: (t: number) => number = EasingFunctions.easeInOutCubic,
      ): Promise<void> => {
        if (!enableAnimations || duration === 0) {
          update(to);
          return;
        }

        return new Promise((resolve) => {
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easing(progress);
            const currentValue = from + (to - from) * easedProgress;

            update(currentValue);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(animate);
        });
      },
      [enableAnimations],
    );

    // Animação de câmera suave
    const animateCameraToObject = useCallback(
      async (
        targetObject: THREE.Object3D,
        duration: number = animationDuration,
      ): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.camera || !current.controls) return;

        const startPosition = current.camera.position.clone();
        const startTarget = current.controls.target.clone();

        const aspect = containerRef.current
          ? containerRef.current.clientWidth / containerRef.current.clientHeight
          : 1;

        // Calcular posição final
        const tempCamera = current.camera.clone();
        const tempControls = current.controls;
        fitCameraToObject(
          tempCamera,
          tempControls,
          targetObject,
          aspect,
          false,
        );

        const endPosition = tempCamera.position.clone();
        const endTarget = tempControls.target.clone();

        const direction = new THREE.Vector3().subVectors(
          endPosition,
          endTarget,
        );
        const distance = direction.length();

        const newDistance = distance * 1.63;
        direction.normalize().multiplyScalar(newDistance);
        endPosition.copy(endTarget).add(direction);

        await animateValue(0, 1, duration, (progress) => {
          if (!current.camera || !current.controls) return;

          current.camera.position.lerpVectors(
            startPosition,
            endPosition,
            progress,
          );
          current.controls.target.lerpVectors(startTarget, endTarget, progress);
          current.controls.update();
        });
      },
      [animateValue, animationDuration],
    );

    //  Animação de isolamento - peças saem de cena
    // VERSÃO MELHORADA - Animação de isolamento mais suave, lenta e com fade out melhorado
    const animateIsolation = useCallback(
      async (
        target: THREE.Object3D | null,
        duration: number = 2500, // Duração base ajustada para ser suave mas não excessivamente lenta
      ): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        const mesh = current.mesh;
        const visibleSet = new Set<THREE.Object3D>();

        if (target) {
          target.traverse((c) => visibleSet.add(c));
          let p: THREE.Object3D | null = target;
          while (p && p !== mesh) {
            visibleSet.add(p);
            p = p.parent;
          }
          visibleSet.add(mesh);
        }

        const invisibleParts: {
          child: THREE.Object3D;
          distance: number;
          originalPos: THREE.Vector3;
          originalOpacity: number;
        }[] = [];
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());

        // Calcular tamanho máximo para normalizar distâncias
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);

        mesh.traverse((child) => {
          if (!visibleSet.has(child)) {
            const childBox = new THREE.Box3().setFromObject(child);
            const childCenter = childBox.getCenter(new THREE.Vector3());
            const distance = childCenter.distanceTo(center);

            let originalOpacity = 1;
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
              const mat = mats[0] as THREE.MeshStandardMaterial;
              originalOpacity = mat.opacity ?? 1;
            }

            invisibleParts.push({
              child,
              distance,
              originalPos: child.position.clone(),
              originalOpacity,
            });
          }
        });

        // Ordena de fora pra dentro
        invisibleParts.sort((a, b) => b.distance - a.distance);

        // Configurações da animação

        // Distância de explosão relativa ao tamanho do modelo
        const explosionScale = maxDimension * 2.5;

        await animateValue(0, 1, duration, (progress) => {
          invisibleParts.forEach(
            ({ child, originalPos, originalOpacity }, i) => {
              // Delay escalonado suave
              // As peças mais distantes começam primeiro
              const normalizedIndex = i / Math.max(invisibleParts.length, 1);

              // Curva de progresso individual
              // Ajuste para que todas terminem juntas mas comecem em tempos diferentes
              const startOffset = normalizedIndex * 0.4; // 40% do tempo é stagger
              const effectiveProgress = Math.max(
                0,
                (progress - startOffset) / (1 - startOffset),
              );

              // Easing suave para o movimento
              const moveEased =
                EasingFunctions.easeInOutCubic(effectiveProgress);

              if (effectiveProgress > 0) {
                const childBox = new THREE.Box3().setFromObject(child);
                const childCenter = childBox.getCenter(new THREE.Vector3());
                const dir = new THREE.Vector3()
                  .subVectors(childCenter, center)
                  .normalize();

                // Movimento radial suave
                const offset = dir.multiplyScalar(explosionScale * moveEased);

                child.position.copy(originalPos).add(offset);

                // Fade out sincronizado com o movimento
                // Começa a desaparecer assim que começa a mover
                const fadeProgress = Math.min(1, effectiveProgress * 1.5); // Fade mais rápido que o movimento
                const opacity = originalOpacity * (1 - fadeProgress);

                if (child instanceof THREE.Mesh && child.material) {
                  const mats = Array.isArray(child.material)
                    ? child.material
                    : [child.material];
                  mats.forEach((m) => {
                    const mat = m as THREE.MeshStandardMaterial;
                    mat.transparent = true;
                    mat.opacity = Math.max(0, opacity);
                    mat.needsUpdate = true;
                  });
                }
              }
            },
          );

          // Garante que as peças visíveis fiquem no lugar
          mesh.traverse((child) => {
            if (visibleSet.has(child) && child.userData.originalPosition) {
              child.position.copy(child.userData.originalPosition);
            }
          });

          current.renderer.render(current.scene, current.camera);
        });

        // Finalização
        mesh.traverse((child) => {
          const visible = visibleSet.has(child);
          child.visible = visible;
        });

        setIsIsolatedMode(true);
        current.renderer.render(current.scene, current.camera);
      },
      [animateValue],
    );

    // Sistema de destaque (comportamento atual - apenas transparência)
    const showOnlyAncestorsAndDescendants = useCallback(
      async (
        target: THREE.Object3D | null,
        duration: number = 600,
      ): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        const mesh = current.mesh;
        const visibleSet = new Set<THREE.Object3D>();

        if (target) {
          target.traverse((c) => visibleSet.add(c));
          let p: THREE.Object3D | null = target;
          while (p && p !== mesh) {
            visibleSet.add(p);
            p = p.parent;
          }
          visibleSet.add(mesh);
        } else {
          mesh.traverse((c) => visibleSet.add(c));
        }

        // Apenas aplica transparência (comportamento original)
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const isVisible = visibleSet.has(child);
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((material) => {
              const mat = material as THREE.MeshStandardMaterial;
              mat.opacity = isVisible ? 1 : 0.15;
              mat.transparent = true;
              mat.needsUpdate = true;

              if (isVisible && target && child === target && mat.emissive) {
                mat.emissive.set(0x0077ff);
                mat.emissiveIntensity = 0.35;
              } else if (mat.emissiveIntensity) {
                mat.emissiveIntensity = 0;
              }
            });
          }
        });

        current.renderer.render(current.scene, current.camera);

        if (target && enableAnimations) {
          await animateCameraToObject(target, duration);
        }
      },
      [animateCameraToObject, enableAnimations],
    );

    const isolateObjectByName = useCallback(
      async (name: string | null, duration: number = 4000): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        if (!name) {
          // Reset será feito pela função resetVisibility que será chamada externamente
          setIsIsolatedMode(false);
          return;
        }

        let target: THREE.Object3D | null = null;
        const searchName = name.toLowerCase();

        // Busca exata primeiro
        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === searchName) {
            target = child;
          }
        });

        // Se não encontrou, busca pelo primeiro segmento (antes do hífen)
        if (!target) {
          const baseName = searchName.split("-")[0];
          current.mesh.traverse((child) => {
            if (!child.name) return;
            const childBase = child.name.toLowerCase().split("-")[0];
            if (childBase === baseName && isValidPartName(child.name)) {
              target = child;
            }
          });
        }

        // Se encontrou, usa findGroupCandidate para garantir que pega o grupo correto
        if (target) {
          const groupCandidate = findGroupCandidate(target, current.mesh);
          // USA ANIMAÇÃO DE ISOLAMENTO REAL com duração aumentada
          await animateIsolation(groupCandidate || target, duration);
        }
      },
      [animateIsolation, findGroupCandidate, isValidPartName],
    );

    // Aplicar mudanças de estado do visualizador
    useEffect(() => {
      const current = sceneRef.current;
      if (!current || !current.mesh) return;

      const applyViewerStateChanges = async () => {
        try {
          if (containerRef.current) {
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const newCamera = applyDisplayMode(
              current.camera,
              current.renderer,
              viewerState.displayMode,
              current.controls,
              width,
              height,
            );
            if (newCamera !== current.camera) {
              current.camera = newCamera;
              current.controls.object = newCamera;
            }
          }

          applyVisualMode(
            current.scene,
            current.mesh as THREE.Group,
            viewerState.visualMode,
            current.originalMaterials,
          );

          if (viewerState.section.active) {
            applySectionView(
              current.scene,
              current.renderer,
              viewerState.section,
            );
          } else {
            removeSectionView(current.scene, current.renderer);
          }

          applyExplodeView(
            current.mesh as THREE.Group,
            viewerState.explode,
            debugMode,
            (info) => {
              setDebugInfo(info);
            },
          );
        } catch (error) {
          console.error("Erro ao aplicar estado do visualizador:", error);
        }
      };

      applyViewerStateChanges();
    }, [viewerState, debugMode]);

    // Setup otimizado da cena
    useEffect(() => {
      let activeScene: InteractiveThreeScene | null = null;
      let isMounted = true;
      let renderLoopId: number;

      const runSetup = async (model: THREE.Group) => {
        if (!isMounted) return;

        try {
          const container = containerRef.current;
          if (!container) return;

          const scene = setupScene(container, sceneConfig);

          Object.assign(scene.renderer.domElement.style, {
            pointerEvents: "auto",
            touchAction: "none",
            width: "100%",
            height: "100%",
            position: "absolute",
            outline: "none",
          });
          scene.renderer.domElement.tabIndex = 1;

          if (thumbnailMode) {
            scene.scene.background = new THREE.Color(0xf0f0f0);
            scene.controls.enableRotate = false;
            scene.controls.enablePan = false;
            scene.controls.enableZoom = false;
          }

          const interactive = setupInteraction(scene);
          activeScene = interactive;

          const originalMaterials = new Map<
            THREE.Mesh,
            THREE.Material | THREE.Material[]
          >();
          collectOriginalMaterials(model, originalMaterials);
          interactive.originalMaterials = originalMaterials;

          interactive.scene.add(model);
          normalizeModelSizeAndPosition(model);
          interactive.mesh = model;

          // 🎯 Preparar modelo
          model.traverse((child) => {
            if (child.name && child.name !== "") {
              child.userData.isComponent = true;
              child.userData.originalPosition = child.position.clone();
              child.userData.originalMatrix = child.matrix.clone();

              if (child instanceof THREE.Mesh && child.material) {
                const materials = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                materials.forEach((mat) => {
                  if (!mat.transparent) {
                    mat.transparent = true;
                    (
                      mat as THREE.Material & { depthWrite: boolean }
                    ).depthWrite = true;
                  }
                });
              }
            }
          });

          const aspectRatio = container.clientWidth / container.clientHeight;
          if (enableAnimations) {
            await fitCameraToObject(
              interactive.camera,
              interactive.controls,
              model,
              aspectRatio,
              true,
            );
          } else {
            fitCameraToObject(
              interactive.camera,
              interactive.controls,
              model,
              aspectRatio,
              false,
            );
          }

          applyVisualMode(
            interactive.scene,
            model,
            viewerState.visualMode,
            originalMaterials,
          );

          sceneRef.current = activeScene;
          setIsModelLoaded(true);
          setIsLoadingPart(false);
          onModelLoaded?.(model);

          if (!thumbnailMode) {
            // Adicionar listener de mudança de câmera
            activeScene.controls.addEventListener("change", () => {
              if (onCameraChangeRef.current && activeScene) {
                // Calculate CSS Matrix
                const camera = activeScene.camera;
                const matrix = new THREE.Matrix4();
                matrix.copy(camera.matrixWorldInverse);
                matrix.setPosition(0, 0, 0);

                const e = matrix.elements;

                const cssMatrix = `matrix3d(
                  ${e[0]}, ${e[1]}, ${e[2]}, ${e[3]},
                  ${e[4]}, ${e[5]}, ${e[6]}, ${e[7]},
                  ${e[8]}, ${e[9]}, ${e[10]}, ${e[11]},
                  ${e[12]}, ${e[13]}, ${e[14]}, ${e[15]}
                )`;

                onCameraChangeRef.current(
                  {
                    x: activeScene.camera.rotation.x,
                    y: activeScene.camera.rotation.y,
                    z: activeScene.camera.rotation.z,
                  },
                  cssMatrix,
                );
              }
            });

            const animate = () => {
              if (!isMounted || !activeScene) return;

              renderLoopId = requestAnimationFrame(animate);
              activeScene.controls.update();
              activeScene.renderer.render(
                activeScene.scene,
                activeScene.camera,
              );
            };
            animate();
          } else {
            activeScene.renderer.render(activeScene.scene, activeScene.camera);
          }
        } catch (error) {
          console.error("Erro no setup da cena:", error);
          onModelError?.(error as Error);
          setIsLoadingPart(false);
        }
      };

      const cleanup = () => {
        isMounted = false;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (renderLoopId) {
          cancelAnimationFrame(renderLoopId);
        }

        if (activeScene) {
          try {
            if (activeScene.mesh) {
              disposeObject(activeScene.mesh);
              activeScene.scene.remove(activeScene.mesh);
              activeScene.mesh = null;
            }
            activeScene.controls.dispose();
            activeScene.renderer.dispose();
            activeScene.originalMaterials.clear();
          } catch (e) {
            console.warn("Erro no cleanup:", e);
          }
          sceneRef.current = null;
        }
      };

      if (isolatedPart) {
        runSetup(isolatedPart as THREE.Group);
      } else if (modelUrl) {
        setIsLoadingPart(true);
        loadModel(modelUrl, (progress) => {
          if (isMounted) {
            setLoadProgress(Math.round(progress.percent));
          }
        })
          .then((model) => {
            if (isMounted) runSetup(model);
          })
          .catch((error) => {
            console.error("Erro carregando modelo:", error);
            onModelError?.(error);
            setIsLoadingPart(false);
          });
      }

      return cleanup;
    }, [
      modelUrl,
      isolatedPart,
      thumbnailMode,
      onModelLoaded,
      onModelError,
      sceneConfig,
      enableAnimations,
      viewerState.visualMode,
    ]);

    // 🎯 Handle Static Modes (Highlight & Isolation)
    useEffect(() => {
      if (!isModelLoaded || !lockedPart) return;

      const applyStaticMode = async () => {
        if (interactionMode === "static-highlight") {
          // Ensure highlight is applied
          const current = sceneRef.current;
          if (current) {
            // We use showOnlyAncestorsAndDescendants for highlighting
            // Find the object first to pass it
            let target: THREE.Object3D | null = null;
            const searchName = lockedPart.toLowerCase();

            current.mesh?.traverse((child) => {
              if (child.name && child.name.toLowerCase() === searchName) {
                target = child;
              }
            });

            // Fallback search
            if (!target) {
              const baseName = searchName.split("-")[0];
              current.mesh?.traverse((child) => {
                if (child.name) {
                  const childBase = child.name.toLowerCase().split("-")[0];
                  if (childBase === baseName && isValidPartName(child.name)) {
                    target = child;
                  }
                }
              });
            }

            if (target) {
              await showOnlyAncestorsAndDescendants(target, 0); // 0 duration for instant
            }
          }
        } else if (interactionMode === "static-isolation") {
          // Ensure isolation is applied
          await isolateObjectByName(lockedPart, 0); // 0 duration for instant
        }
      };

      applyStaticMode();
    }, [
      isModelLoaded,
      interactionMode,
      lockedPart,
      showOnlyAncestorsAndDescendants,
      isolateObjectByName,
      isValidPartName,
    ]);

    // 🎯 Apenas mover câmera quando selectedPartName mudar externamente
    useEffect(() => {
      const current = sceneRef.current;
      if (!current || !current.mesh) return;

      const handleExternalSelection = async () => {
        if (selectedPartName) {
          const base = selectedPartName.toLowerCase();
          let target: THREE.Object3D | undefined;

          current.mesh?.traverse((child) => {
            if (!child.name) return;
            const childBase = child.name.split("-")[0].toLowerCase();
            if (childBase === base) {
              target = child;
            }
          });

          if (target) {
            if (enableAnimations) {
              await animateCameraToObject(target, 600);
            } else {
              const aspect = containerRef.current
                ? containerRef.current.clientWidth /
                  containerRef.current.clientHeight
                : 1;
              fitCameraToObject(
                current.camera,
                current.controls,
                target,
                aspect,
                false,
              );
            }
          }
        }
      };

      handleExternalSelection();
    }, [selectedPartName, enableAnimations, animateCameraToObject]);

    const getObjectUnderPointer = useCallback(
      (
        clientX: number,
        clientY: number,
      ): { object: THREE.Object3D | null; name: string | null } => {
        const container = containerRef.current;
        const currentScene = sceneRef.current;
        if (!container || !currentScene || !currentScene.mesh)
          return { object: null, name: null };

        const rect = container.getBoundingClientRect();
        currentScene.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        currentScene.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        const intersects = getIntersects(
          currentScene.mouse,
          currentScene.camera,
          [currentScene.mesh],
        );
        if (intersects.length === 0) return { object: null, name: null };

        let object = intersects[0].object as THREE.Object3D;

        //  CORREÇÃO: Busca o PRIMEIRO ancestor nomeado (conjunto)
        let depth = 0;
        const maxDepth = 8;

        while (
          object.parent &&
          object.parent !== currentScene.mesh &&
          object !== currentScene.mesh &&
          depth < maxDepth
        ) {
          //  VERIFICA se o nó atual tem um nome válido (não é mesh genérico)
          if (isValidPartName(object.name)) {
            break;
          }
          object = object.parent;
          depth++;
        }

        //  SE chegou na raiz sem nome válido, tenta o parent
        if (!isValidPartName(object.name) && object.parent) {
          object = object.parent;
        }

        const name = isValidPartName(object.name) ? object.name : null;
        return { object, name };
      },
      [isValidPartName],
    );

    //  Função específica para mostrar grupos (apenas transparência)
    const showGroupOnly = useCallback(
      async (groupCandidate: THREE.Object3D | null): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        const mesh = current.mesh;
        const visibleSet = new Set<THREE.Object3D>();

        if (groupCandidate) {
          groupCandidate.traverse((c) => visibleSet.add(c));

          let p: THREE.Object3D | null = groupCandidate;
          while (p && p !== mesh) {
            visibleSet.add(p);
            p = p.parent;
          }
          visibleSet.add(mesh);
        } else {
          mesh.traverse((c) => visibleSet.add(c));
        }

        //  Apenas aplica transparência
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const isVisible = visibleSet.has(child);
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((material) => {
              const mat = material as THREE.MeshStandardMaterial;
              mat.opacity = isVisible ? 1 : 0.15;
              mat.transparent = true;
              mat.needsUpdate = true;

              if (mat.emissiveIntensity) {
                mat.emissiveIntensity = 0;
              }
            });
          }
        });

        current.renderer.render(current.scene, current.camera);

        if (groupCandidate && enableAnimations) {
          await animateCameraToObject(groupCandidate, 600);
        }
      },
      [animateCameraToObject, enableAnimations],
    );

    // Vista explodida animada
    // Vista explodida animada - VERSÃO MELHORADA
    const explodeAssembly = useCallback(
      async (distance: number): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        // Usa a função auxiliar animada
        await applyExplodeView(current.mesh as THREE.Group, {
          active: true,
          distance,
        });

        // Atualiza o estado
        setViewerState((prev) => ({
          ...prev,
          explode: { active: true, distance },
        }));
      },
      [],
    );

    const resetExplodeView = useCallback(async (): Promise<void> => {
      const current = sceneRef.current;
      if (!current || !current.mesh) return;

      applyExplodeView(current.mesh as THREE.Group, {
        active: false,
        distance: 0,
      });

      // Garante reset completo
      setViewerState((prev) => ({
        ...prev,
        explode: { active: false, distance: 0 },
      }));
    }, []);

    const resetExplosion = useCallback(
      async (duration: number = 400): Promise<void> => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        const model = current.mesh;
        const startPositions = new Map<THREE.Object3D, THREE.Vector3>();

        model.traverse((object) => {
          if (object.userData.originalPosition) {
            startPositions.set(object, object.position.clone());
          }
        });

        await animateValue(0, 1, duration, (progress) => {
          model.traverse((object) => {
            if (object.userData.originalPosition) {
              const startPos = startPositions.get(object);
              const endPos = object.userData.originalPosition as THREE.Vector3;
              if (startPos) {
                object.position.lerpVectors(startPos, endPos, progress);
              }
            }
          });
        });

        await resetExplodeView();
      },
      [animateValue, resetExplodeView],
    );

    // 🎯 Reset de visibilidade - CORREÇÃO: restaura layers e visibilidade
    const resetVisibility = useCallback(async (): Promise<void> => {
      const current = sceneRef.current;
      if (!current || !current.mesh) return;

      // 🎯 RESTAURA tudo
      current.mesh.traverse((child) => {
        child.visible = true;

        if (child instanceof THREE.Mesh) {
          child.layers.enable(0); // Reativa layer padrão para raycasting
        }

        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          materials.forEach((mat) => {
            (mat as THREE.Material & { opacity: number }).opacity = 1;
            (mat as THREE.Material & { transparent: boolean }).transparent =
              false;

            if ((mat as THREE.MeshStandardMaterial).emissiveIntensity) {
              (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0;
            }
          });
        }

        // 🎯 Restaura posição original se existir
        if (child.userData.originalPosition) {
          child.position.copy(child.userData.originalPosition);
        }
      });

      resetModelColor(current.mesh, current.originalMaterials);
      setIsIsolatedMode(false);
      current.renderer.render(current.scene, current.camera);
    }, []);

    // 🎯 Handlers para mouse down e up
    const handleMouseDown = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        // Ignora mouse se houve toque recente (evita duplo disparo em mobile/F12)
        if (Date.now() - lastTouchTimeRef.current < 1000) return;

        if (thumbnailMode || isolatedPart) return;
        if (interactionMode !== "interactive") return;

        if (manipulationMode === "move") {
          const { object, name } = getObjectUnderPointer(
            event.clientX,
            event.clientY,
          );
          if (object && name) {
            // Encontrar o grupo pai nomeado (respeitar hierarquia)
            const currentScene = sceneRef.current;
            if (!currentScene) return;

            const target = object;

            const plane = new THREE.Plane();
            const normal = new THREE.Vector3();
            currentScene.camera.getWorldDirection(normal);
            plane.setFromNormalAndCoplanarPoint(normal, target.position);

            const raycaster = new THREE.Raycaster();
            const rect = event.currentTarget.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );

            raycaster.setFromCamera(mouse, currentScene.camera);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersectPoint);

            const offset = new THREE.Vector3().subVectors(
              target.position,
              intersectPoint,
            );

            setDragState({
              active: true,
              object: target,
              plane,
              offset,
              hasMoved: false,
              startScreenPos: { x: event.clientX, y: event.clientY },
            });

            // Desabilita controles de órbita durante o drag
            currentScene.controls.enabled = false;
            return; // Impede seleção normal
          }
        }

        mouseDownTimeRef.current = Date.now();
        setIsLongPress(false);

        // Timer para detectar segurar o botão
        const timer = setTimeout(() => {
          setIsLongPress(true);
        }, longPressThreshold);

        // Armazena o timer para limpeza
        const currentTarget = event.currentTarget;
        currentTarget.addEventListener("mouseup", () => clearTimeout(timer), {
          once: true,
        });
        currentTarget.addEventListener(
          "mouseleave",
          () => clearTimeout(timer),
          { once: true },
        );
      },
      [
        thumbnailMode,
        isolatedPart,
        manipulationMode,
        getObjectUnderPointer,
        interactionMode,
      ],
    );

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (Date.now() - lastTouchTimeRef.current < 1000) return;

        if (
          manipulationMode === "move" &&
          dragState.active &&
          dragState.object
        ) {
          const currentScene = sceneRef.current;
          if (!currentScene) return;

          const rect = event.currentTarget.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
          );

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, currentScene.camera);
          const intersectPoint = new THREE.Vector3();

          if (raycaster.ray.intersectPlane(dragState.plane, intersectPoint)) {
            const newPos = intersectPoint.add(dragState.offset);
            dragState.object.position.copy(newPos);

            // Adiciona ao set de peças movidas
            if (dragState.object.name) {
              setDragState((prev) => ({ ...prev, hasMoved: true }));
              setMovedParts((prev) =>
                new Set(prev).add(dragState.object!.name),
              );
            }

            currentScene.renderer.render(
              currentScene.scene,
              currentScene.camera,
            );
          }
        }
      },
      [manipulationMode, dragState],
    );

    // Clique esquerdo - seleciona peça e aplica destaque visual
    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (Date.now() - lastTouchTimeRef.current < 1000) return;

        if (thumbnailMode || isolatedPart) return;
        if (interactionMode !== "interactive") return;

        const container = containerRef.current;
        const currentScene = sceneRef.current;
        if (!container || !currentScene || !currentScene.mesh) return;

        const rect = container.getBoundingClientRect();
        currentScene.mouse.x =
          ((event.clientX - rect.left) / rect.width) * 2 - 1;
        currentScene.mouse.y =
          -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const intersects = getIntersects(
          currentScene.mouse,
          currentScene.camera,
          [currentScene.mesh],
        );

        let newSelectedPartName: string | null = null;

        if (intersects.length > 0) {
          const object = intersects[0].object as THREE.Mesh;
          let partNode: THREE.Object3D = object;

          // Busca o PRIMEIRO ancestor nomeado (conjunto)
          let depth = 0;
          const maxDepth = 8;

          while (
            partNode.parent &&
            partNode.parent !== currentScene.mesh &&
            partNode !== currentScene.mesh &&
            depth < maxDepth
          ) {
            if (isValidPartName(partNode.name)) {
              break;
            }
            partNode = partNode.parent;
            depth++;
          }

          // Se chegou na raiz sem nome válido, tenta o parent
          if (!isValidPartName(partNode.name) && partNode.parent) {
            partNode = partNode.parent;
          }

          newSelectedPartName = isValidPartName(partNode.name)
            ? partNode.name
            : null;
        }

        // Toggle selection
        if (
          newSelectedPartName &&
          newSelectedPartName === currentSelectedPart
        ) {
          newSelectedPartName = null;
        }

        setCurrentSelectedPart(newSelectedPartName);
        onPartSelected?.(newSelectedPartName);

        // Aplica destaque visual quando clica em uma peça
        if (
          newSelectedPartName &&
          newSelectedPartName !== currentSelectedPart
        ) {
          const { name } = getObjectUnderPointer(event.clientX, event.clientY);
          if (name) {
            // 📳 Haptic Feedback na seleção
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(10);
            }

            // Aplica destaque visual (transparência + zoom)
            showOnlyAncestorsAndDescendants(
              findGroupCandidate(
                currentScene.mesh.getObjectByName(name) || null,
                currentScene.mesh,
              ),
              500,
            );
          }
        } else if (!newSelectedPartName) {
          // 🎯 [User Request] Ignorar clique no vazio para não desselecionar
          // Retorna sem fazer nada, mantendo a seleção atual.
          return;
        }
      },
      [
        currentSelectedPart,
        onPartSelected,
        thumbnailMode,
        isolatedPart,
        resetVisibility,
        getObjectUnderPointer,
        isValidPartName,
        showOnlyAncestorsAndDescendants,
        findGroupCandidate,
        viewerState.explode.active,
        viewerState.explode.distance,
        interactionMode,
      ],
    );

    const handleMouseUp = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (Date.now() - lastTouchTimeRef.current < 1000) return;

        if (thumbnailMode || isolatedPart) return;

        if (manipulationMode === "move" && dragState.active) {
          const wasClick = !dragState.hasMoved;
          setDragState((prev) => ({
            ...prev,
            active: false,
            object: null,
            hasMoved: false,
            startScreenPos: null,
          }));
          const currentScene = sceneRef.current;
          if (currentScene) {
            currentScene.controls.enabled = true;
          }

          // Se não moveu significativamente, trata como clique para selecionar
          if (wasClick) {
            handleClick(event);
          }
          return;
        }

        const clickDuration = Date.now() - mouseDownTimeRef.current;

        // Se foi um clique rápido (não segurou), processa o clique normal
        if (clickDuration < longPressThreshold && !isLongPress) {
          handleClick(event);
        }
      },
      [
        thumbnailMode,
        isolatedPart,
        isLongPress,
        handleClick,
        manipulationMode,
        dragState.active,
      ],
    );

    const handleTouchStart = useCallback(
      (event: React.TouchEvent<HTMLDivElement>) => {
        lastTouchTimeRef.current = Date.now();

        if (thumbnailMode || isolatedPart) return;
        if (interactionMode !== "interactive") return;
        if (event.touches.length > 1) return;

        const touch = event.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        setTouchStartPosition({ x: clientX, y: clientY });
        mouseDownTimeRef.current = Date.now(); // 🎯 Update Ref

        if (manipulationMode === "move") {
          const { object, name } = getObjectUnderPointer(clientX, clientY);
          if (object && name) {
            // Previne scroll ao tentar arrastar peça
            // event.preventDefault(); // React synthetic event might not support this directly in time, but styled touch-action helps

            const currentScene = sceneRef.current;
            if (!currentScene) return;

            const target = object;

            // Preparar drag
            const plane = new THREE.Plane();
            const normal = new THREE.Vector3();
            currentScene.camera.getWorldDirection(normal);
            plane.setFromNormalAndCoplanarPoint(normal, target.position);

            const raycaster = new THREE.Raycaster();
            const rect = event.currentTarget.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((clientX - rect.left) / rect.width) * 2 - 1,
              -((clientY - rect.top) / rect.height) * 2 + 1,
            );

            raycaster.setFromCamera(mouse, currentScene.camera);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersectPoint);

            const offset = new THREE.Vector3().subVectors(
              target.position,
              intersectPoint,
            );

            // 📳 Haptic Feedback no início do drag
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(15);
            }

            setDragState({
              active: true,
              object: target,
              plane,
              offset,
              hasMoved: false,
              startScreenPos: { x: clientX, y: clientY },
            });

            currentScene.controls.enabled = false;
            return;
          }
        }

        mouseDownTimeRef.current = Date.now();
        setIsLongPress(false);

        // Timer para long press (igual mouse)
        const timer = setTimeout(() => {
          setIsLongPress(true);
        }, longPressThreshold);

        const currentTarget = event.currentTarget;
        const cleanUp = () => clearTimeout(timer);
        currentTarget.addEventListener("touchend", cleanUp, { once: true });
        currentTarget.addEventListener("touchcancel", cleanUp, { once: true });
      },
      [
        thumbnailMode,
        isolatedPart,
        manipulationMode,
        getObjectUnderPointer,
        interactionMode,
      ],
    );

    const handleTouchMove = useCallback(
      (event: React.TouchEvent<HTMLDivElement>) => {
        if (
          manipulationMode === "move" &&
          dragState.active &&
          dragState.object
        ) {
          // Previne scroll enquanto arrasta
          // event.preventDefault();

          const touch = event.touches[0];
          const currentScene = sceneRef.current;
          if (!currentScene) return;

          const rect = event.currentTarget.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((touch.clientX - rect.left) / rect.width) * 2 - 1,
            -((touch.clientY - rect.top) / rect.height) * 2 + 1,
          );

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, currentScene.camera);
          const intersectPoint = new THREE.Vector3();

          if (raycaster.ray.intersectPlane(dragState.plane, intersectPoint)) {
            const newPos = intersectPoint.add(dragState.offset);
            dragState.object.position.copy(newPos);

            if (dragState.object.name) {
              setMovedParts((prev) =>
                new Set(prev).add(dragState.object!.name),
              );
            }

            currentScene.renderer.render(
              currentScene.scene,
              currentScene.camera,
            );
          }
        }
      },
      [manipulationMode, dragState],
    );

    const handleTouchEnd = useCallback(
      (event: React.TouchEvent<HTMLDivElement>) => {
        lastTouchTimeRef.current = Date.now();
        const touch = event.changedTouches[0]; // changedTouches para touchend

        if (manipulationMode === "move" && dragState.active) {
          setDragState((prev) => ({ ...prev, active: false, object: null }));
          const currentScene = sceneRef.current;
          if (currentScene) {
            currentScene.controls.enabled = true;
          }
          return;
        }

        if (thumbnailMode || isolatedPart) return;

        // Validação de movimento para diferenciar Tap de Orbit (Scroll)
        if (touchStartPosition) {
          const moveX = Math.abs(touch.clientX - touchStartPosition.x);
          const moveY = Math.abs(touch.clientY - touchStartPosition.y);
          // Se moveu mais que 5 pixels, considera como gesto (orbit/scroll) e não click
          if (moveX > 5 || moveY > 5) {
            return;
          }
        }

        const clickDuration = Date.now() - mouseDownTimeRef.current;

        if (clickDuration < longPressThreshold && !isLongPress) {
          // Simula click para seleção
          // Precisamos criar um evento fake ou refatorar handleClick para aceitar coords
          // Vamos refatorar handleClick para aceitar coordenadas explícitas opcionalmente

          // Calling handleClick logic manually for touch to avoid event type mismatch
          if (interactionMode !== "interactive") return;

          const container = containerRef.current;
          const currentScene = sceneRef.current;
          if (!container || !currentScene || !currentScene.mesh) return;

          const rect = container.getBoundingClientRect();
          currentScene.mouse.x =
            ((touch.clientX - rect.left) / rect.width) * 2 - 1;
          currentScene.mouse.y =
            -((touch.clientY - rect.top) / rect.height) * 2 + 1;

          const intersects = getIntersects(
            currentScene.mouse,
            currentScene.camera,
            [currentScene.mesh],
          );

          let newSelectedPartName: string | null = null;

          if (intersects.length > 0) {
            const object = intersects[0].object as THREE.Mesh;
            let partNode: THREE.Object3D = object;

            let depth = 0;
            const maxDepth = 8;

            while (
              partNode.parent &&
              partNode.parent !== currentScene.mesh &&
              partNode !== currentScene.mesh &&
              depth < maxDepth
            ) {
              if (isValidPartName(partNode.name)) {
                break;
              }
              partNode = partNode.parent;
              depth++;
            }

            if (!isValidPartName(partNode.name) && partNode.parent) {
              partNode = partNode.parent;
            }

            newSelectedPartName = isValidPartName(partNode.name)
              ? partNode.name
              : null;
          }

          if (
            newSelectedPartName &&
            newSelectedPartName === currentSelectedPart
          ) {
            newSelectedPartName = null;
          }

          setCurrentSelectedPart(newSelectedPartName);
          onPartSelected?.(newSelectedPartName);

          if (
            newSelectedPartName &&
            newSelectedPartName !== currentSelectedPart
          ) {
            const { name } = getObjectUnderPointer(
              touch.clientX,
              touch.clientY,
            );
            if (name) {
              showOnlyAncestorsAndDescendants(
                findGroupCandidate(
                  currentScene.mesh.getObjectByName(name) || null,
                  currentScene.mesh,
                ),
                500,
              );
            }
          } else if (!newSelectedPartName) {
            if (
              !viewerState.explode.active ||
              viewerState.explode.distance === 0
            ) {
              resetVisibility();
            }
          }
        }
      },
      [
        thumbnailMode,
        isolatedPart,
        isLongPress,
        manipulationMode,
        dragState.active,
        interactionMode,
        getObjectUnderPointer,
        isValidPartName,
        currentSelectedPart,
        onPartSelected,
        showOnlyAncestorsAndDescendants,
        findGroupCandidate,
        viewerState.explode.active,
        viewerState.explode.distance,
        resetVisibility,
        touchStartPosition,
      ],
    );

    // 🎯 Context menu handling - NÃO seleciona/destaca, apenas abre o menu
    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (thumbnailMode || isolatedPart || isLongPress) return;
        if (interactionMode !== "interactive") return;

        const { name } = getObjectUnderPointer(e.clientX, e.clientY);
        setContextMenuTarget(name);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setContextMenuVisible(true);
        // NÃO chama highlightPartByName - apenas abre o menu sem destacar
      },
      [
        thumbnailMode,
        isolatedPart,
        isLongPress,
        getObjectUnderPointer,
        interactionMode,
      ],
    );

    useEffect(() => {
      const handleDocClick = () => {
        if (contextMenuVisible) setContextMenuVisible(false);
      };
      document.addEventListener("click", handleDocClick);
      return () => document.removeEventListener("click", handleDocClick);
    }, [contextMenuVisible]);

    // 🎯 API ref expandida
    useImperativeHandle(ref, () => ({
      isModelLoaded: () => isModelLoaded,
      getSelectedPartName: () => currentSelectedPart,
      highlightPartByName: async (partName: string | null) => {
        setCurrentSelectedPart(partName);

        // Aplica destaque visual quando highlightPartByName é chamado
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        if (!partName) {
          await resetVisibility();
          return;
        }

        // Encontra o objeto pelo nome
        let target: THREE.Object3D | null = null;
        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === partName.toLowerCase()) {
            target = child;
          }
        });

        if (target) {
          const groupCandidate = findGroupCandidate(target, current.mesh);
          await showOnlyAncestorsAndDescendants(groupCandidate, 500);
        }
      },
      setViewerState: (newState: Partial<ViewerState>) => {
        setViewerState((prev) => ({ ...prev, ...newState }));
      },
      getViewerState: () => viewerState,
      setViewOrientation: (
        orientation:
          | "top"
          | "bottom"
          | "left"
          | "right"
          | "front"
          | "back"
          | "iso",
      ) => {
        const current = sceneRef.current;
        if (current) {
          setViewOrientation(current.camera, current.controls, orientation);
        }
      },
      animateToPart: async (partName: string, duration: number = 600) => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        let target: THREE.Object3D | undefined;
        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === partName.toLowerCase()) {
            target = child;
          }
        });

        if (target) {
          await animateCameraToObject(target, duration);
        }
      },
      explodeAssembly: async (distance: number) => {
        await explodeAssembly(distance);
      },
      resetExplosion: async (duration: number = 400) => {
        await resetExplosion(duration);
      },
      isolatePart: async (partName: string | null, duration?: number) => {
        if (!partName) {
          await resetVisibility();
          return;
        }
        await isolateObjectByName(partName, duration);
      },
      getPathToPart: (partName: string) => {
        const current = sceneRef.current;
        if (!current || !current.mesh) return [];

        let target: THREE.Object3D | null = null;
        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === partName.toLowerCase()) {
            target = child;
          }
        });

        if (target) {
          const groupCandidate = findGroupCandidate(target, current.mesh);
          const startNode = groupCandidate || target;

          const parts: string[] = [];
          let p: THREE.Object3D | null = startNode;

          while (p && p !== current.mesh) {
            if (p.name && isValidPartName(p.name)) {
              parts.unshift(p.name);
            }
            p = p.parent;
          }
          return parts;
        }

        return [];
      },
    }));

    const splitCurrentSelectedPart = currentSelectedPart?.split("-")[0];

    //  Context menu component
    const ContextMenu = useMemo(() => {
      if (!contextMenuVisible) return null;

      const handleIsolate = async () => {
        setContextMenuVisible(false);
        //
        // NÃO seleciona automaticamente - apenas isola
        if (contextMenuTarget) {
          await isolateObjectByName(contextMenuTarget, 4000);
        }
      };

      const handleShowGroupOnly = async () => {
        setContextMenuVisible(false);
        const current = sceneRef.current;
        if (!current || !current.mesh) return;

        let targetObj: THREE.Object3D | null = null;
        if (!contextMenuTarget) {
          await resetVisibility();
          return;
        }

        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === contextMenuTarget?.toLowerCase()) {
            targetObj = child;
          }
        });

        if (!targetObj) return;

        const groupCandidate = findGroupCandidate(targetObj, current.mesh);
        //  usa apenas destaque / transparência
        await showGroupOnly(groupCandidate);
      };

      const handleAddToCart = () => {
        setContextMenuVisible(false);
        if (!contextMenuTarget) return;
        const current = sceneRef.current;
        let targetObj: THREE.Object3D | null = null;
        if (!current || !current.mesh) return;

        current.mesh.traverse((child) => {
          if (!child.name) return;
          if (child.name.toLowerCase() === contextMenuTarget?.toLowerCase()) {
            targetObj = child;
          }
        });

        let path = contextMenuTarget;
        if (targetObj) {
          const parts: string[] = [];
          let p: THREE.Object3D | null = targetObj;
          while (p && p !== current.mesh) {
            parts.unshift(p.name ?? ("unnamed" as string));
            p = p.parent as THREE.Object3D | null;
          }
          path = parts.join(" > ");
        }

        onAddToCart?.({ name: contextMenuTarget, path });
      };

      const handleViewProperties = () => {
        setContextMenuVisible(false);
        onViewProperties?.(contextMenuTarget);
      };

      const handleReset = async () => {
        setContextMenuVisible(false);
        await resetVisibility();
        setCurrentSelectedPart(null);
        onPartSelected?.(null);
      };

      return (
        <div
          className="bg-popover text-popover-foreground border-border fixed z-50 min-w-[200px] rounded-lg border py-2 text-sm shadow-xl"
          style={{
            left: contextMenuPos.x,
            top: contextMenuPos.y,
          }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b px-3 py-2 text-xs text-gray-500">
            {contextMenuTarget
              ? `Opções para: ${contextMenuTarget.split("-")[0]}`
              : "Opções"}
          </div>
          <button
            className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
            onClick={handleIsolate}
          >
            Isolar peça
          </button>
          <button
            className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
            onClick={handleShowGroupOnly}
          >
            Mostrar apenas este conjunto
          </button>
          <button
            className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
            onClick={handleAddToCart}
          >
            Adicionar ao carrinho
          </button>
          <button
            className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
            onClick={handleViewProperties}
          >
            Ver propriedades
          </button>

          {movedParts.has(contextMenuTarget || "") && (
            <button
              className="text-destructive hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
              onClick={() => {
                setContextMenuVisible(false);
                const current = sceneRef.current;
                if (!current || !current.mesh || !contextMenuTarget) return;

                const target = current.mesh.getObjectByName(contextMenuTarget);
                if (target && target.userData.originalPosition) {
                  target.position.copy(target.userData.originalPosition);
                  setMovedParts((prev) => {
                    const next = new Set(prev);
                    next.delete(contextMenuTarget);
                    return next;
                  });
                  current.renderer.render(current.scene, current.camera);
                }
              }}
            >
              Resetar Posição
            </button>
          )}

          <div className="border-border my-1 border-t" />
          <button
            className="text-primary hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left"
            onClick={handleReset}
          >
            Voltar para montagem
          </button>
        </div>
      );
    }, [
      contextMenuVisible,
      contextMenuPos,
      contextMenuTarget,
      isolateObjectByName,
      showGroupOnly,
      resetVisibility,
      onAddToCart,
      onViewProperties,
      findGroupCandidate,
      movedParts,
      onPartSelected,
    ]);

    return (
      <div
        ref={containerRef}
        className={`bg-background relative h-full w-full overflow-hidden outline-none ${className}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        tabIndex={0}
      >
        {!isModelLoaded && (
          <div className="bg-background/80 absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
            <span className="text-muted-foreground mt-4 text-lg font-medium">
              {isLoadingPart ? "Carregando Peça..." : "Carregando Modelo 3D..."}
            </span>
            {!isolatedPart && (
              <div className="bg-muted mt-4 h-2 w-3/4 rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {isIsolatedMode && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="bg-secondary text-secondary-foreground absolute top-2 right-2 z-20 rounded-md px-3 py-1 text-sm shadow-sm"
          >
            Modo Isolado
          </div>
        )}

        {currentSelectedPart && !thumbnailMode && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="bg-primary text-primary-foreground absolute top-2 left-2 z-20 rounded-md px-3 py-1 text-sm shadow-sm"
          >
            Selecionado: {splitCurrentSelectedPart}
          </div>
        )}

        {!thumbnailMode && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="border-border/20 bg-card/60 md:border-border md:bg-card/90 absolute top-20 left-4 z-20 flex flex-col gap-3 rounded-2xl border p-1 shadow-lg backdrop-blur-md md:top-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:flex-row md:items-center md:gap-1 md:rounded-lg md:p-1.5"
          >
            <button
              onClick={() => setManipulationMode("view")}
              className={`rounded-full p-3 shadow-sm transition-all md:p-2 md:shadow-none ${
                manipulationMode === "view"
                  ? "bg-primary text-primary-foreground md:bg-primary/10 md:text-primary border-transparent"
                  : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground md:text-muted-foreground md:bg-transparent"
              }`}
              title="Visualizar (Girar/Zoom)"
            >
              <Eye size={24} className="md:h-5 md:w-5" />
            </button>
            <button
              onClick={() => setManipulationMode("move")}
              className={`rounded-full p-3 shadow-sm transition-all md:p-2 md:shadow-none ${
                manipulationMode === "move"
                  ? "bg-primary text-primary-foreground md:bg-primary/10 md:text-primary border-transparent"
                  : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground md:text-muted-foreground md:bg-transparent"
              }`}
              title="Mover Peças (Arrastar)"
            >
              <Hand size={24} className="md:h-5 md:w-5" />
            </button>
            <div className="bg-border hidden h-6 w-px md:block" />
            <button
              onClick={async () => {
                const current = sceneRef.current;
                if (current && current.mesh) {
                  await resetCamera(
                    current.camera,
                    current.controls,
                    current.mesh as THREE.Group,
                  );
                }
              }}
              className="bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground md:text-muted-foreground rounded-full p-3 shadow-sm transition-all md:bg-transparent md:p-2 md:shadow-none"
              title="Resetar Câmera"
            >
              <Camera size={24} className="md:h-5 md:w-5" />
            </button>

            {/* Botão de Debug movido para cá para limpar a UI */}
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`rounded-full p-3 shadow-sm transition-all md:p-2 md:shadow-none ${
                debugMode
                  ? "bg-destructive text-destructive-foreground md:bg-destructive/10 md:text-destructive"
                  : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground md:text-muted-foreground md:bg-transparent"
              }`}
              title="Debug Mode (F3)"
            >
              <Maximize2 size={24} className="md:h-5 md:w-5" />
            </button>
          </div>
        )}

        {debugMode && debugInfo && (
          <div
            className="pointer-events-auto absolute top-2 left-2 z-30 max-w-sm overflow-hidden rounded bg-black/70 p-2 font-mono text-xs text-white shadow-lg"
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 border-b border-gray-500 pb-1 font-bold">
              DEBUG INFO (F3)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-gray-400">Center:</span>
              <span>
                {debugInfo.center.x.toFixed(2)}, {debugInfo.center.y.toFixed(2)}
                , {debugInfo.center.z.toFixed(2)}
              </span>

              <span className="text-gray-400">Size:</span>
              <span>
                {debugInfo.size.x.toFixed(2)}, {debugInfo.size.y.toFixed(2)},{" "}
                {debugInfo.size.z.toFixed(2)}
              </span>

              <span className="text-gray-400">Scale:</span>
              <span>{debugInfo.scale.toFixed(2)}</span>

              <span className="text-gray-400">Explosion:</span>
              <span>{(viewerState.explode.distance * 100).toFixed(1)}%</span>
            </div>

            <div className="mt-2 border-b border-gray-500 pb-1 font-bold text-gray-300">
              Sample Parts
            </div>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {debugInfo.parts.map((part, i) => (
                <div
                  key={i}
                  className="mb-1 flex flex-col border-b border-gray-700 pb-1 last:border-0"
                >
                  <span className="truncate text-yellow-400">{part.name}</span>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 pl-2 text-[10px] text-gray-300">
                    <span>Dist:</span> <span>{part.dist.toFixed(2)}</span>
                    <span>Dir:</span>{" "}
                    <span>
                      ({part.dir.x.toFixed(1)}, {part.dir.y.toFixed(1)},{" "}
                      {part.dir.z.toFixed(1)})
                    </span>
                    <span>Pos:</span>{" "}
                    <span>
                      ({part.finalPos.x.toFixed(0)},{" "}
                      {part.finalPos.y.toFixed(0)}, {part.finalPos.z.toFixed(0)}
                      )
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ContextMenu}
      </div>
    );
  },
);

View3D.displayName = "View3D";
