"use client";

import { List, Maximize2, Minimize2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as THREE from "three";

import {
  extractPartByName,
  getHierarchy,
  HierarchyNode,
  loadGLB,
  loadModel,
} from "@/actions/solid-works/three-setup/three-setup";
import { View3D, View3DRef, ViewerState } from "@/components/common/view-3d";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import { HierarchyNavigation } from "./HierarchyNavigation";
import { PathBreadcrumb } from "./PathBreadcrumb";

// Interface para o produto do Protheus
interface ProdutoProtheus {
  id: string;
  filial: string;
  codigo: string;
  descricao: string;
  posIpi: string | null;
  chassi: string | null;
}

interface VisualizadorModalProps {
  urlModelo: string;
  nomePeca: string;
  produtoId?: string;
  onClose: () => void;
  initialSelectedPart?: string | null;
}

export function VisualizadorModal({
  urlModelo,
  nomePeca,
  produtoId,
  onClose,
  initialSelectedPart = null,
}: VisualizadorModalProps) {
  const view3DRef = useRef<View3DRef | null>(null);
  const partsListRef = useRef<HTMLDivElement>(null);
  const [isolatedPartObject, setIsolatedPartObject] =
    useState<THREE.Object3D | null>(null);
  const [isLoadingPart, setIsLoadingPart] = useState(true);
  const [selectedPartName, setSelectedPartName] = useState<string | null>(
    initialSelectedPart,
  );
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null); // ID da peça selecionada
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPartsList, setShowPartsList] = useState(false);
  const [hierarchyTree, setHierarchyTree] = useState<HierarchyNode[]>([]);
  const [selectedNodeProperties, setSelectedNodeProperties] = useState<
    Record<string, unknown>
  >({});
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [explodeDistance, setExplodeDistance] = useState<number>(0);
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
  });

  // Estado para as informações do Protheus
  const [produtoProtheus, setProdutoProtheus] =
    useState<ProdutoProtheus | null>(null);
  const [parteProtheus, setParteProtheus] = useState<ProdutoProtheus | null>(
    null,
  );
  const [isLoadingProtheus, setIsLoadingProtheus] = useState(false);
  const [abaPropriedades, setAbaPropriedades] = useState<
    "solidworks" | "protheus"
  >("protheus");

  const getPartPath = (partName: string | null): string[] => {
    if (!partName) return [];

    const path: string[] = [];
    const parts = partName.split("-");

    for (let i = 0; i < parts.length; i++) {
      const segment = parts.slice(0, i + 1).join("-");
      path.push(segment);
    }

    return path;
  };

  // Função para extrair o ID da peça das propriedades do SolidWorks
  const extrairIdDaPeca = (
    propriedades: Record<string, unknown>,
  ): string | null => {
    // Procura por 'proid' ou 'id' nas propriedades
    const proid = propriedades.proid || propriedades.id;

    if (typeof proid === "string" && proid.trim() !== "") {
      return proid.trim();
    }

    // Também pode estar dentro de um objeto 'propriedades'
    if (
      propriedades.propriedades &&
      typeof propriedades.propriedades === "object"
    ) {
      const props = propriedades.propriedades as Record<string, unknown>;
      const proidInterno = props.proid || props.id;
      if (typeof proidInterno === "string" && proidInterno.trim() !== "") {
        return proidInterno.trim();
      }
    }

    return null;
  };

  const fetchProdutoProtheusCompleto = async (id: string) => {
    if (!id) return;
    setIsLoadingProtheus(true);
    setTimeout(() => {
      setProdutoProtheus({
        id,
        filial: "01",
        codigo: `MDL-${id}`,
        descricao: "Produto de demonstração Standalone",
        posIpi: "8479.89.99",
        chassi: null,
      });
      setIsLoadingProtheus(false);
    }, 500);
  };

  const fetchParteProtheus = async (
    partId: string | null,
    partCode: string | null,
  ) => {
    if (!partId && !partCode) {
      setParteProtheus(null);
      return;
    }

    setIsLoadingProtheus(true);
    setTimeout(() => {
      setParteProtheus({
        id: partId || "N/A",
        filial: "01",
        codigo: partCode || "N/A",
        descricao: "Peça de demonstração Standalone",
        posIpi: null,
        chassi: null,
      });
      setIsLoadingProtheus(false);
    }, 500);
  };

  // Buscar informações do Protheus quando o modal abre ou quando o produtoId muda
  useEffect(() => {
    if (produtoId) {
      fetchProdutoProtheusCompleto(produtoId);
    } else {
      setProdutoProtheus(null);
    }
  }, [produtoId]);

  const handlePathClick = async (index: number) => {
    if (selectedPath.length === 0) return;
    const clickedPart = selectedPath[index];
    if (clickedPart) {
      await handlePartSelect(clickedPart, null);
    }
  };

  const loadPartsList = async () => {
    if (hierarchyTree.length > 0) return;
    try {
      const model = await loadModel(urlModelo);
      const tree = getHierarchy(model);
      setHierarchyTree(tree);
    } catch {
      toast.error("Erro ao carregar lista de peças.");
    }
  };

  const togglePartsList = () => {
    if (!showPartsList) loadPartsList();
    setShowPartsList((s) => !s);
  };

  const scrollToSelectedPart = (partName: string) => {
    if (!partsListRef.current || !partName) return;

    setTimeout(() => {
      const selectedElement = partsListRef.current?.querySelector(
        `[data-part-name="${partName}"]`,
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
  };

  const handlePartSelect = async (partName: string, partId: string | null) => {
    if (selectedPartName === partName && selectedPartId === partId) {
      setSelectedPartName(null);
      setSelectedPartId(null);
      setSelectedPath([]);
      setExplodeDistance(0);
      await view3DRef.current?.highlightPartByName(null);
      if (view3DRef.current) {
        await view3DRef.current.isolatePart(null);
        handleViewerStateChange({
          explode: { active: false, distance: 0 },
        });
      }
      return;
    }

    setSelectedPartName(partName);
    setSelectedPartId(partId);

    const partCode = partName
      ? partName.split("-")[0].trim().toUpperCase()
      : null;

    fetchParteProtheus(partId, partCode);
    setExplodeDistance(0);
    await view3DRef.current?.highlightPartByName(partName);

    // Get true hierarchy path from View3D
    if (view3DRef.current) {
      const path = view3DRef.current.getPathToPart(partName);
      setSelectedPath(path);
    } else {
      // Fallback if ref not ready (unlikely)
      const path = getPartPath(partName);
      setSelectedPath(path);
    }
  };

  const handleNodeSelect = async (node: HierarchyNode) => {
    setSelectedNodeProperties(node.properties || {});

    const partId = node.properties ? extrairIdDaPeca(node.properties) : null;

    await handlePartSelect(node.name, partId);
  };

  const handleIsolatePart = async () => {
    if (!selectedPartName) return;
    await view3DRef.current?.isolatePart(selectedPartName, 2000);
  };

  const handleClearSelection = async () => {
    setSelectedPartName(null);
    setSelectedPartId(null);
    setSelectedPath([]);
    setExplodeDistance(0);
    view3DRef.current?.highlightPartByName(null);

    if (view3DRef.current) {
      await view3DRef.current.isolatePart(null);
      handleViewerStateChange({
        explode: { active: false, distance: 0 },
      });
    }
  };

  useEffect(() => {
    if (selectedPartName && showPartsList) {
      scrollToSelectedPart(selectedPartName);
    }
  }, [selectedPartName, showPartsList]);

  useEffect(() => {
    if (initialSelectedPart && !isolatedPartObject) {
      setIsLoadingPart(true);
      (async () => {
        try {
          const fullModel = await loadGLB(urlModelo);
          const part = extractPartByName(fullModel, initialSelectedPart);
          if (part) {
            setIsolatedPartObject(part);
            setSelectedPartName(initialSelectedPart);
            // Aqui precisaríamos extrair o ID do objeto se possível
          } else {
            console.warn(`Peça ${initialSelectedPart} não encontrada.`);
            toast.warning(
              `A peça "${initialSelectedPart}" não foi localizada no modelo.`,
            );
          }
        } catch (error) {
          console.error("Erro ao carregar a peça isolada:", error);
          toast.error("Ocorreu um erro ao buscar a peça isolada.");
        } finally {
          setIsLoadingPart(false);
        }
      })();
    } else if (!initialSelectedPart) {
      setIsLoadingPart(false);
    }
  }, [initialSelectedPart, urlModelo, isolatedPartObject]);

  const toggleFullscreen = () => setIsFullscreen((v) => !v);

  const handleViewerStateChange = (newState: Partial<ViewerState>) => {
    setViewerState((prev) => ({ ...prev, ...newState }));
    view3DRef.current?.setViewerState(newState);
  };

  const handleExplodeChange = (value: number[]) => {
    const distance = value[0];
    setExplodeDistance(distance);
    const scaledDistance = (distance / 100) * 1.0;
    handleViewerStateChange({
      explode: { active: distance > 0, distance: scaledDistance },
    });
  };

  const setViewOrientation = (
    orientation: "top" | "bottom" | "left" | "right" | "front" | "back" | "iso",
  ) => {
    view3DRef.current?.setViewOrientation(orientation);
  };

  const displayTitle = isolatedPartObject
    ? selectedPartName
    : isLoadingPart
      ? "Carregando..."
      : nomePeca;

  const displaySubtitle = isolatedPartObject
    ? "Visualização 3D Isolada"
    : isLoadingPart
      ? "Carregando..."
      : "Visualização da Montagem Completa";

  // Componente para exibir propriedades do SolidWorks em tabela
  const SolidWorksPropertiesTable = () => {
    if (Object.keys(selectedNodeProperties).length === 0) {
      return (
        <div className="text-muted-foreground p-4 text-center">
          Nenhuma propriedade disponível do SolidWorks
        </div>
      );
    }

    return (
      <div className="scrollbar-custom max-h-[300px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr className="border-border border-b">
              <th className="text-muted-foreground px-3 py-2 text-left font-medium">
                Propriedade
              </th>
              <th className="text-muted-foreground px-3 py-2 text-left font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(selectedNodeProperties).map(([key, value]) => {
              // Não exibir campos de ID nas propriedades do SolidWorks
              if (
                key.toLowerCase().includes("proid") ||
                key.toLowerCase() === "id"
              ) {
                return null;
              }

              return (
                <tr
                  key={key}
                  className="border-border/50 hover:bg-muted/50 border-b"
                >
                  <td className="text-foreground px-3 py-2 font-medium">
                    {key.replace(/^SW-/, "")}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Componente para exibir informações do Protheus
  // Componente para exibir informações do Protheus
  const ProtheusInfo = () => {
    const produtoAtual = selectedPartName ? parteProtheus : produtoProtheus;
    const exibindoParte = selectedPartName ? "da Peça" : "da Montagem";

    if (isLoadingProtheus) {
      return (
        <div className="flex items-center justify-center p-6">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
          <span className="text-muted-foreground ml-2 text-sm">
            Carregando informações do Protheus...
          </span>
        </div>
      );
    }

    if (!produtoAtual) {
      return (
        <div className="text-muted-foreground p-4 text-center">
          Nenhuma informação do Protheus disponível{" "}
          {exibindoParte.toLowerCase()}.
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          <div className="border-border border-b pb-2">
            <h4 className="text-foreground font-semibold">
              Informações {exibindoParte}
            </h4>
            {selectedPartId && (
              <p className="text-muted-foreground text-xs">
                ID: {selectedPartId}
              </p>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">ID:</span>
              <span className="text-foreground">{produtoAtual.id}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Filial:</span>
              <span className="text-foreground">{produtoAtual.filial}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Código:</span>
              <span className="text-foreground">{produtoAtual.codigo}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-muted-foreground font-medium">
                Descrição:
              </span>
              <div className="mt-1 min-h-[40px] overflow-hidden">
                <span className="text-foreground break-words whitespace-normal">
                  {produtoAtual.descricao}
                </span>
              </div>
            </div>

            {produtoAtual.posIpi && (
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">
                  Posição IPI:
                </span>
                <span className="text-foreground">{produtoAtual.posIpi}</span>
              </div>
            )}

            {produtoAtual.chassi && (
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">
                  Chassi:
                </span>
                <span className="text-foreground">{produtoAtual.chassi}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ${
        isFullscreen ? "p-0" : "p-4"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-background text-foreground flex flex-col shadow-2xl transition-all duration-300 ${
          isFullscreen
            ? "h-full w-full rounded-none"
            : "border-border h-[90vh] w-[95vw] max-w-7xl rounded-xl border"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-border bg-card/50 flex items-center justify-between border-b p-4 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <h3 className="text-foreground text-xl font-bold">
              {displayTitle}
            </h3>
            <span className="text-muted-foreground text-sm">
              {displaySubtitle}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={showPartsList ? "secondary" : "ghost"}
              size="icon"
              onClick={togglePartsList}
              aria-label="Lista de Peças"
              title="Lista de Peças"
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <List className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              className="hover:bg-accent hover:text-accent-foreground"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Fechar Modal"
              title="Fechar Modal"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {selectedPath.length > 0 && (
          <PathBreadcrumb path={selectedPath} onPathClick={handlePathClick} />
        )}

        <div className="flex flex-1 overflow-hidden">
          {showPartsList && (
            <aside className="border-border bg-card flex w-64 flex-col overflow-hidden border-r">
              <HierarchyNavigation
                tree={hierarchyTree}
                onSelectNode={handleNodeSelect}
                selectedNodeId={selectedPartName}
              />
            </aside>
          )}

          <aside
            className={`border-border bg-card flex w-80 flex-col border-r p-4`}
          >
            <div className="max-h-full space-y-6 overflow-y-auto pr-1">
              <div className="space-y-4">
                <div className="border-border flex items-center gap-2 border-b pb-4">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                  <h4 className="text-foreground font-semibold">
                    Visualização
                  </h4>
                </div>

                {/* Projeção (Segmented Control) */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Projeção
                  </label>
                  <div className="bg-muted flex rounded-lg p-1">
                    <button
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                        viewerState.displayMode === "perspective"
                          ? "bg-background text-primary ring-border shadow-sm ring-1"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() =>
                        handleViewerStateChange({ displayMode: "perspective" })
                      }
                    >
                      Perspectiva
                    </button>
                    <button
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                        viewerState.displayMode === "orthographic"
                          ? "bg-background text-primary ring-border shadow-sm ring-1"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() =>
                        handleViewerStateChange({ displayMode: "orthographic" })
                      }
                    >
                      Ortográfica
                    </button>
                  </div>
                </div>

                {/* Vistas (Grid de Botões) */}
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Vistas Padrão
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["top", "front", "right", "iso"] as const).map(
                      (orientation) => (
                        <button
                          key={orientation}
                          onClick={() => setViewOrientation(orientation)}
                          className="border-input bg-background/50 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-accent-foreground rounded-md border px-3 py-2 text-xs font-medium transition-all active:scale-95"
                        >
                          {orientation === "top"
                            ? "Topo"
                            : orientation === "front"
                              ? "Frente"
                              : orientation === "right"
                                ? "Direita"
                                : "ISO"}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Explosão */}
                <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      Explosão
                    </label>
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold">
                      {explodeDistance}%
                    </span>
                  </div>
                  <Slider
                    value={[explodeDistance]}
                    onValueChange={handleExplodeChange}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="border-border space-y-3 border-t pt-6">
                {selectedPartName ? (
                  <>
                    <div className="border-border bg-muted/20 rounded-md border p-3">
                      <div className="mb-3 flex space-x-1">
                        <button
                          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            abaPropriedades === "protheus"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          }`}
                          onClick={() => setAbaPropriedades("protheus")}
                        >
                          Protheus
                        </button>
                        <button
                          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            abaPropriedades === "solidworks"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          }`}
                          onClick={() => setAbaPropriedades("solidworks")}
                        >
                          SolidWorks
                        </button>
                      </div>

                      <div className="mt-2">
                        <p className="text-foreground mb-2 font-semibold">
                          Cód.{" "}
                          {selectedPartName.split("-")[0].trim().toUpperCase()}
                          {selectedPartId && (
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              (ID: {selectedPartId})
                            </span>
                          )}
                        </p>

                        <div className="mt-3">
                          {abaPropriedades === "protheus" ? (
                            <ProtheusInfo />
                          ) : (
                            <SolidWorksPropertiesTable />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        onClick={handleIsolatePart}
                        className="w-full"
                        variant="secondary"
                      >
                        Isolar Peça
                      </Button>

                      <Button
                        onClick={() =>
                          toast.success(
                            `Peça ${selectedPartName} adicionada ao carrinho.`,
                          )
                        }
                        className="w-full"
                      >
                        Adicionar ao Carrinho
                      </Button>

                      <Button
                        variant="outline"
                        className="text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:border-destructive/30 w-full"
                        onClick={handleClearSelection}
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border-border bg-muted/20 rounded-md border p-3">
                      <div className="mb-3">
                        <h5 className="text-foreground font-semibold">
                          Informações da Montagem
                        </h5>
                      </div>
                      <ProtheusInfo />
                    </div>

                    <div className="bg-accent/20 border-border/50 text-muted-foreground rounded-md border p-3 text-sm">
                      Clique na peça no visualizador ou na lista para destacar e
                      ver detalhes.
                    </div>
                  </>
                )}

                {isolatedPartObject && (
                  <button
                    className="text-primary hover:text-primary/80 w-full py-2 text-sm hover:underline"
                    onClick={() => {
                      setIsolatedPartObject(null);
                      setSelectedPartName(null);
                      setSelectedNodeProperties({});
                      setSelectedPath([]);
                      setSelectedNodeProperties({});
                      setSelectedPartId(null);
                      setExplodeDistance(0);
                      setIsLoadingPart(false);
                      handleClearSelection();
                    }}
                  >
                    ← Voltar para Montagem Completa
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="relative flex-1">
            <div
              className="h-full w-full"
              style={{
                pointerEvents: "auto",
                position: "relative",
              }}
            >
              {!isLoadingPart && (
                <View3D
                  ref={view3DRef}
                  modelUrl={urlModelo}
                  className="h-full w-full"
                  isolatedPart={isolatedPartObject}
                  selectedPartName={selectedPartName}
                  onPartSelected={async (partName) => {
                    if (partName) {
                      await handlePartSelect(partName, null);
                      if (showPartsList) {
                        scrollToSelectedPart(partName);
                      }
                    } else {
                      await handleClearSelection();
                    }
                  }}
                  initialViewerState={viewerState}
                  enableAnimations={true}
                  animationDuration={800}
                />
              )}
            </div>

            {isLoadingPart && (
              <div className="bg-background absolute inset-0 flex items-center justify-center">
                <div className="text-muted-foreground">Carregando...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualizadorModal;
