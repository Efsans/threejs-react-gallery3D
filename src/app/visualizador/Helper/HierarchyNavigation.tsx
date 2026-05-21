import { ChevronRight, Layers, ArrowLeft, Search, X, Folder, Box } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { HierarchyNode } from "@/actions/solid-works/three-setup/three-setup";

interface HierarchyNavigationProps {
  tree: HierarchyNode[];
  onSelectNode: (node: HierarchyNode) => void;
  selectedNodeId?: string | null;
}

export function HierarchyNavigation({
  tree,
  onSelectNode,
  selectedNodeId,
}: HierarchyNavigationProps) {
  const [path, setPath] = useState<HierarchyNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward",
  );
  const [animating, setAnimating] = useState(false);

  const currentGroup = path.length > 0 ? path[path.length - 1] : null;
  const parentGroup = path.length > 1 ? path[path.length - 2] : null;

  const rightList = currentGroup ? currentGroup.children : tree;
  const leftList = parentGroup
    ? parentGroup.children
    : path.length === 1
      ? tree
      : [];

  const findPathToNode = useCallback(
    (nodes: HierarchyNode[], targetName: string): HierarchyNode[] | null => {
      for (const node of nodes) {
        if (node.name === targetName) {
          return [node];
        }
        if (node.children && node.children.length > 0) {
          const found = findPathToNode(node.children, targetName);
          if (found) {
            return [node, ...found];
          }
        }
      }
      return null;
    },
    [],
  );

  // 🔍 Filtro de pesquisa (Flatten Tree)
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const results: HierarchyNode[] = [];

    const traverse = (nodes: HierarchyNode[]) => {
      for (const node of nodes) {
        // Busca por nome ou código (assumindo que o nome contém o código)
        if (node.name.toLowerCase().includes(query)) {
          results.push(node);
        }
        if (node.children?.length > 0) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return results;
  }, [searchQuery, tree]);

  useEffect(() => {
    if (!selectedNodeId) return;

    const fullPath = findPathToNode(tree, selectedNodeId);
    if (!fullPath) return;

    const targetParentPath = fullPath.slice(0, -1);
    const targetNode = fullPath[fullPath.length - 1];

    const isSamePath = (p1: HierarchyNode[], p2: HierarchyNode[]) => {
      if (p1.length !== p2.length) return false;
      return p1.every((n, i) => n.name === p2[i].name);
    };

    if (isSamePath(path, targetParentPath)) return;

    if (isSamePath(path, [...targetParentPath, targetNode])) return;

    setPath(targetParentPath);
  }, [selectedNodeId, tree, path, findPathToNode]);

  const handleNodeClick = (node: HierarchyNode, isRightColumn: boolean) => {
    onSelectNode(node);

    if (node.type === "mesh" || node.children.length === 0) {
      return;
    }

    if (isRightColumn) {
      setSlideDirection("forward");
      setAnimating(true);
      setTimeout(() => {
        setPath([...path, node]);
        setAnimating(false);
      }, 300);
    } else {
      const newPath = [...path];
      newPath.pop(); // Remove o atual
      newPath.push(node); // Põe o novo

      setSlideDirection("forward"); // Ou none?
      setPath(newPath);
    }
  };

  const handleBack = () => {
    if (path.length === 0) return;
    // Pega o pai
    const parent = path[path.length - 1];
    // anda no pai
    if (parent) {
      onSelectNode(parent);
    }
    setSlideDirection("backward");
    setAnimating(true);

    setTimeout(() => {
      setPath((prev) => prev.slice(0, -1));
      setAnimating(false);
    }, 300);
  };

  // Breadcrumbs simplificado

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-gray-200 bg-gray-50">
      <div className="border-border bg-card z-10 flex flex-col space-y-2 border-b p-3 shadow-sm">
        <div className="flex items-center space-x-2">
          {path.length > 0 && !searchQuery ? (
            <button
              onClick={handleBack}
              className="hover:bg-accent hover:text-accent-foreground rounded-full p-1 transition-colors"
            >
              <ArrowLeft className="text-muted-foreground h-4 w-4" />
            </button>
          ) : (
            <div className="w-1" /> // Spacer menor
          )}
          <div className="text-foreground flex-1 truncate text-sm font-medium">
            {searchQuery
              ? "Resultados da Pesquisa"
              : path.length === 0
                ? "Montagem Principal"
                : currentGroup?.name}
          </div>
        </div>

        {/* 🔍 Barra de Pesquisa */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código..."
            className="border-input bg-muted/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-primary w-full rounded-md border py-1.5 pr-8 pl-8 text-sm transition-all outline-none focus:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Columns Container or Search Results */}
      <div className="bg-background relative flex flex-1 overflow-hidden">
        {filteredNodes ? (
          // 🔍 Lista de Resultados da Pesquisa (Flat View)
          <div className="bg-background h-full w-full overflow-y-auto p-2">
            {filteredNodes.length === 0 ? (
              <div className="text-muted-foreground mt-8 flex flex-col items-center text-center">
                <Search className="mb-2 h-8 w-8 opacity-20" />
                <span className="text-sm">Nenhum resultado encontrado.</span>
              </div>
            ) : (
              filteredNodes.map((node) => {
                const isSelected =
                  selectedNodeId === node.id ||
                  (node.object &&
                    selectedNodeId === node.name.split("-")[0].trim());

                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      onSelectNode(node);
                      // Opcional: Limpar busca ao selecionar?
                      // setSearchQuery("");
                    }}
                    className={`mb-2 flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm transition-all duration-200 ${
                      isSelected
                        ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                        : "bg-card text-foreground hover:border-border hover:bg-accent hover:text-accent-foreground border-transparent shadow-sm"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {node.type === "group" ||
                      (node.children && node.children.length > 0) ? (
                        <Folder
                          className={`h-4 w-4 ${isSelected ? "text-primary" : "text-yellow-500"}`}
                        />
                      ) : (
                        <Box
                          className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                      )}
                      <div className="flex flex-col truncate">
                        <span className="truncate font-medium">
                          {node.name.split("-")[0].trim()}
                        </span>
                        {node.name.includes("-") && (
                          <span className="text-muted-foreground truncate text-xs">
                            {node.name.substring(node.name.indexOf("-") + 1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // 🌲 Navegação Hierárquica Padrão
          <>
            <div
              className={`border-border bg-muted/30 absolute top-0 bottom-0 w-full transform border-r transition-all duration-300 ease-in-out ${path.length > 0 ? "translate-x-0" : "-translate-x-full"} ${animating && slideDirection === "forward" ? "-translate-x-full opacity-0" : ""} ${animating && slideDirection === "backward" ? "translate-x-0 opacity-100" : ""} `}
              style={{ width: "30%" }} // Esquerda ocupa menos espaço (ícones/lista compacta)
            >
              <div className="scrollbar-custom h-full overflow-y-auto py-2">
                {leftList.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node, false)}
                    className={`mx-1 flex cursor-pointer items-center justify-center rounded p-2 p-3 md:p-2 ${currentGroup?.id === node.id ? "border-border bg-card border shadow-sm" : "hover:bg-accent opacity-60 hover:opacity-100"} `}
                    title={node.name}
                  >
                    {node.type === "group" ? (
                      <Folder className="text-primary h-4 w-4" />
                    ) : (
                      <Box className="text-muted-foreground h-4 h-6 w-4 w-6 md:h-4 md:w-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`bg-background absolute top-0 right-0 bottom-0 transform transition-all duration-300 ease-in-out ${path.length > 0 ? "w-[70%]" : "w-full"} ${animating && slideDirection === "forward" ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"} `}
            >
              <div className="scrollbar-custom h-full space-y-1 overflow-y-auto p-2">
                {rightList.length === 0 ? (
                  <div className="text-muted-foreground mt-10 text-center text-sm">
                    Vazio
                  </div>
                ) : (
                  rightList.map((node) => {
                    const isSelected =
                      selectedNodeId === node.id ||
                      (node.object &&
                        selectedNodeId === node.name.split("-")[0].trim()); // Fallback para nome se ID não bater
                    const hasChildren =
                      node.children && node.children.length > 0;

                    return (
                      <div
                        key={node.id}
                        onClick={() => handleNodeClick(node, true)}
                        className={`group mb-2 flex cursor-pointer items-center justify-between rounded-md border p-2 p-4 text-base text-sm transition-all duration-200 md:mb-0 md:p-2 md:text-sm ${isSelected ? "border-primary/30 bg-primary/10 text-primary font-semibold" : "bg-card text-foreground hover:border-border hover:bg-accent hover:text-accent-foreground border-transparent shadow-sm md:bg-transparent md:shadow-none"} `}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {node.type === "group" ? (
                            <Folder
                              className={`h-4 h-5 w-4 w-5 md:h-4 md:w-4 ${isSelected ? "text-primary" : "text-yellow-500"}`}
                            />
                          ) : (
                            <Box
                              className={`h-4 h-5 w-4 w-5 md:h-4 md:w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                            />
                          )}
                          <span className="truncate font-medium">
                            {node.name.split("-")[0].trim()}
                          </span>
                        </div>

                        {hasChildren && (
                          <ChevronRight className="text-muted-foreground group-hover:text-foreground h-4 w-4" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-border bg-card text-muted-foreground border-t p-2 text-center text-xs">
        {filteredNodes
          ? `${filteredNodes.length} resultado(s)`
          : `${path.length} nível(is) • ${rightList.length} itens`}
      </div>
    </div>
  );
}
