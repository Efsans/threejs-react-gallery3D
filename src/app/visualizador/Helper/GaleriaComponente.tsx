"use client";

import { motion } from "framer-motion";
import { Cuboid } from "lucide-react";
import React from "react";

import { PecaItem } from "./PecaItem";

interface Modelo {
  id: string; // uploadId
  produtoId?: string; // produtoId (opcional)
  nome: string;
  codigo: string;
  urlModelo: string;
  revisao: string;
  material: string;
}

interface GaleriaComponenteProps {
  modelos: Modelo[];
  viewMode?: "grid" | "list";
  onDelete?: (id: string, nome: string) => void;
}

export function GaleriaComponente({
  modelos,
  viewMode = "grid",
  onDelete,
}: GaleriaComponenteProps) {
  const isGrid = viewMode === "grid";

  if (modelos.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border-2 border-dashed py-20 text-center">
        <Cuboid size={48} className="mx-auto mb-4 opacity-20" />
        <p>Nenhum modelo encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
        className={`grid gap-4 ${
          isGrid
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1"
        }`}
      >
        {modelos.map((modelo) => (
          <PecaItem
            key={modelo.id}
            peca={modelo}
            mode={viewMode}
            onDelete={onDelete}
          />
        ))}
      </motion.div>
    </div>
  );
}
