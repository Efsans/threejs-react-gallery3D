"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  itemName: string;
  itemType?: string;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = "modelo",
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-md transform transition-all duration-300">
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirmar Exclusão
              </h3>
              <p className="text-sm text-gray-600">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="mt-4">
            <p className="text-gray-700">
              Tem certeza que deseja excluir o {itemType}{" "}
              <span className="font-semibold text-red-600">
                &quot;{itemName}&quot;
              </span>
              ?
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Todos os dados associados serão permanentemente removidos do
              sistema.
            </p>
          </div>

          {/* Progress Bar */}
          {isDeleting && (
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full animate-pulse bg-red-500"></div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="px-6 transition-all hover:scale-105"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="px-6 transition-all hover:scale-105 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
