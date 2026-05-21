"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { Miniatura3D } from "./Miniatura3D";
import { VisualizadorModal } from "./VisualizadorModal";

// --- Configurações de Animação ---
const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;

interface PecaItemProps {
  peca: {
    id: string; // uploadId
    produtoId?: string; // produtoId
    nome: string;
    codigo: string;
    urlModelo: string;
    revisao: string;
    material: string;
  };
  mode?: "grid" | "list";
  onDelete?: (id: string, nome: string) => void;
}

export function PecaItem({ peca, mode = "grid", onDelete }: PecaItemProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const openModal = () => setIsModalOpen(true);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) onDelete(peca.id, peca.nome);
  };

  const isGrid = mode === "grid";

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        transition={springTransition}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={openModal}
        className={`group border-border bg-card ring-offset-background focus-visible:ring-ring relative flex cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          isGrid ? "flex-col" : "flex-row items-center p-2"
        }`}
        // Efeito de "Lift" no hover apenas em Grid
        whileHover={
          isGrid
            ? { y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)" }
            : { backgroundColor: "rgba(0,0,0,0.02)" }
        }
        whileTap={{ scale: 0.98 }}
      >
        {/* --- Container da Imagem --- */}
        <motion.div
          layout
          layoutId={`image-container-${peca.id}`}
          transition={springTransition}
          className={`bg-muted relative flex items-center justify-center overflow-hidden rounded-lg ${
            isGrid ? "aspect-square w-full" : "h-16 w-16 min-w-[64px]"
          }`}
        >
          <Miniatura3D
            urlModelo={peca.urlModelo}
            nomePeca={peca.nome}
            resolution={isGrid ? "high" : "low"}
            onPartClick={() => {}}
          />

          {/* Overlay Escuro no Grid */}
          {isGrid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
            />
          )}

          {/* Botões Flutuantes (Aparecem no Hover) */}
          <AnimatePresence>
            {isGrid && isHovered && (
              <>
                {/* Botão Deletar */}
                {onDelete && (
                  <motion.button
                    initial={{ opacity: 0, y: -10, x: 10 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
                    whileHover={{ scale: 1.1, backgroundColor: "#fee2e2" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleDelete}
                    className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm backdrop-blur-sm"
                    title="Excluir Modelo"
                  >
                    <Trash2 size={16} />
                  </motion.button>
                )}

                {/* Botão Link Externo */}
                <motion.a
                  initial={{ opacity: 0, y: -10, x: -10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
                  whileHover={{ scale: 1.1, backgroundColor: "#2563eb" }}
                  whileTap={{ scale: 0.9 }}
                  href={`/3d${peca.urlModelo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/90 text-white shadow-sm backdrop-blur-sm"
                  title="Abrir Visualizador Isolado"
                >
                  <ExternalLink size={14} />
                </motion.a>
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* --- Container de Conteúdo --- */}
        <div
          className={`flex flex-1 flex-col justify-center ${
            isGrid ? "gap-1 p-4" : "px-4"
          }`}
        >
          <motion.div layout className="flex items-start justify-between">
            <h3
              className="text-foreground truncate font-semibold"
              title={peca.nome}
            >
              {/* LayoutId no texto permite que ele viaje de Grid para List suavemente */}
              <motion.span
                layout
                layoutId={`title-${peca.id}`}
                transition={springTransition}
              >
                {peca.nome.replace(/^\d+-/, "")}
              </motion.span>
            </h3>
          </motion.div>

          <motion.div
            layout
            className={`flex items-center gap-4 ${
              isGrid ? "mt-2 justify-between" : "mt-1"
            }`}
          >
            <motion.div
              layout
              layoutId={`code-${peca.id}`}
              transition={springTransition}
              className="border-border bg-muted text-muted-foreground rounded border px-2 py-0.5 font-mono text-xs"
            >
              {peca.codigo || "S/ Código"}
            </motion.div>

            {/* Em List Mode mostra Revisão, em Grid esconde suavemente */}
            {!isGrid && (
              <motion.span
                layout
                layoutId={`rev-${peca.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground hidden text-xs sm:block"
              >
                Rev: {peca.revisao || "0"}
              </motion.span>
            )}

            <motion.span
              layout
              layoutId={`material-${peca.id}`}
              transition={springTransition}
              className="text-muted-foreground text-[10px]"
            >
              {peca.material || "N/A"}
            </motion.span>
          </motion.div>
        </div>

        {/* --- Ações da Lista (Sempre visíveis mas interativas) --- */}
        {!isGrid && (
          <motion.div layout className="flex items-center gap-2 pr-4">
            <motion.a
              whileHover={{ scale: 1.1, backgroundColor: "var(--accent)" }}
              whileTap={{ scale: 0.95 }}
              href={`/3d${peca.urlModelo}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground hidden rounded-lg p-2 transition-colors sm:flex"
            >
              <ExternalLink size={18} />
            </motion.a>
            {onDelete && (
              <motion.button
                whileHover={{
                  scale: 1.1,
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDelete}
                className="text-muted-foreground rounded-lg p-2 transition-colors"
              >
                <Trash2 size={18} />
              </motion.button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Modal sem alterações lógicas, apenas renderização condicional */}
      {isModalOpen && (
        <VisualizadorModal
          urlModelo={peca.urlModelo}
          nomePeca={peca.nome}
          produtoId={peca.produtoId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
