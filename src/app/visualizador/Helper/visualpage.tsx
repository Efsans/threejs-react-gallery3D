"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GaleriaComponente } from "./GaleriaComponente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ... imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DeleteConfirmationModal } from "./confirmardeleticao";
import { DragDropUpload } from "./segurasolta";

interface DashboardClientProps {
  modelos: {
    id: string;
    nome: string;
    codigo: string;
    urlModelo: string;
    revisao: string;
    material: string;
  }[];
}

export function DashboardClient({ modelos }: DashboardClientProps) {
  // ... existing state and logic ...
  const [localModelos, setLocalModelos] = useState(modelos);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemId: string | null;
    itemName: string;
  }>({
    isOpen: false,
    itemId: null,
    itemName: "",
  });

  // ... effects ...
  // Carrega preferência de visualização do localStorage
  useEffect(() => {
    const savedView = localStorage.getItem("visualizador-view-mode");
    if (savedView === "grid" || savedView === "list") {
      setViewMode(savedView);
    }
  }, []);

  // Salva preferência de visualização
  useEffect(() => {
    localStorage.setItem("visualizador-view-mode", viewMode);
  }, [viewMode]);

  // Sincroniza estado local quando as props mudam
  useEffect(() => {
    setLocalModelos(modelos);
  }, [modelos]);

  // ... filtering ...
  const filteredModelos = useMemo(() => {
    if (!searchTerm.trim()) return localModelos;
    const lowerSearch = searchTerm.toLowerCase();
    return localModelos.filter(
      (m) =>
        m.nome.toLowerCase().includes(lowerSearch) ||
        m.codigo.toLowerCase().includes(lowerSearch),
    );
  }, [localModelos, searchTerm]);

  // ... delete logic ...
  const openDeleteModal = (id: string, nome: string) => {
    setDeleteModal({
      isOpen: true,
      itemId: id,
      itemName: nome,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      itemId: null,
      itemName: "",
    });
  };

  const handleDeleteModel = async () => {
    if (!deleteModal.itemId) return;
    const idToDelete = deleteModal.itemId;
    setLocalModelos((prev) => prev.filter((item) => item.id !== idToDelete));
    toast.success(`Modelo removido da visualização local!`);
    closeDeleteModal();
  };

  // ... pagination logic ...
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, viewMode]);

  const totalItems = filteredModelos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedModelos = filteredModelos.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  return (
    <div className="bg-background min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* --- HEADER SECTION --- */}
        <header className="border-border flex flex-col items-start justify-between gap-6 border-b pb-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              Plataforma SolidWorks
            </h1>
            <p className="text-muted-foreground text-sm">
              Gestão de Modelos 3D, Importações e Dashboards.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <DragDropUpload onUpload={(newModelo) => setLocalModelos(prev => [newModelo, ...prev])} />
          </div>
        </header>

        <Tabs defaultValue="visualizador" className="space-y-8">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="visualizador" className="px-8">
              Visualizador 3D
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="visualizador"
            className="ring-offset-background space-y-6 focus-visible:outline-none"
          >
            {/* --- MAIN GALLERY SECTION --- */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-foreground text-xl font-semibold">
                Galeria de Modelos
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-full md:w-80">
                  <Input
                    placeholder="Pesquisar por nome ou código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                  />
                </div>

                <div className="border-border flex items-center rounded-lg border p-1 shadow-sm">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("grid")}
                    title="Visualização em Grade"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("list")}
                    title="Visualização em Lista"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-[400px]">
              <GaleriaComponente
                modelos={paginatedModelos}
                viewMode={viewMode}
                onDelete={(id: string) =>
                  openDeleteModal(
                    id,
                    localModelos.find((p) => p.id === id)?.nome || "",
                  )
                }
              />
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="text-muted-foreground flex-1 text-sm">
                Página {page} de {totalPages} ({totalItems} itens)
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={page >= totalPages}
              >
                Próximo
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Confirmação de Exclusão */}
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteModel}
          itemName={deleteModal.itemName}
          itemType="modelo 3D"
        />
      </div>
    </div>
  );
}
