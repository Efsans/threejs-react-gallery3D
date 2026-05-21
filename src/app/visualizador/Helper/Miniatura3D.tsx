"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import * as THREE from "three";

import {
  extractPartByName,
  loadModel,
  renderThumbnailToDataURL,
} from "@/actions/solid-works/three-setup/three-setup";

import ErrorScreen, { ErrorInfo } from "./ErrorScreen";
import { VisualizadorModal } from "./VisualizadorModal";

// ============================================================
// 🎯 TIPOS
// ============================================================
export type ThumbnailResolution = "high" | "medium" | "low" | "very_low";

interface Miniatura3DProps {
  urlModelo: string;
  nomePeca: string;
  partName?: string;
  onPartClick?: () => void;
  resolution?: ThumbnailResolution;
  /** optional back button for error screen */
  onBack?: () => void;
}

// Cache para miniaturas
const thumbnailCache = new Map<string, string>();

const getCacheKey = (
  url: string,
  partName: string | undefined,
  resolution: ThumbnailResolution,
) => `${url}::${partName || "FULL_MODEL"}::${resolution}`;

export function Miniatura3D({
  urlModelo,
  nomePeca,
  partName,
  onPartClick,
  resolution = "medium",
  onBack,
}: Miniatura3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, startTransition] = useTransition();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const retryCountRef = useRef(0);

  // ------------------------------------------------------------
  // Gerar miniatura
  // ------------------------------------------------------------
  const generateThumbnail = useCallback(
    async (retry = false) => {
      const cacheKey = getCacheKey(urlModelo, partName, resolution);

      // Verificar cache primeiro
      if (!retry && thumbnailCache.has(cacheKey)) {
        setThumbDataUrl(thumbnailCache.get(cacheKey)!);
        return;
      }

      startTransition(async () => {
        setErrorInfo(null);
        try {
          console.log(
            `Gerando miniatura ${resolution} para: ${partName || "modelo completo"}`,
          );

          const modelGroup = await loadModel(urlModelo);
          let objectToRender: THREE.Object3D;

          if (partName) {
            const part = extractPartByName(modelGroup, partName);
            if (!part) {
              throw new Error(`Peça "${partName}" não encontrada`);
            }
            objectToRender = part;
          } else {
            objectToRender = modelGroup;
          }

          const dataUrl = await renderThumbnailToDataURL(
            objectToRender,
            resolution,
            0xf0f0f0,
          );

          if (!dataUrl || dataUrl === "data:,") {
            throw new Error("Falha ao gerar miniatura - imagem vazia");
          }

          thumbnailCache.set(cacheKey, dataUrl);
          setThumbDataUrl(dataUrl);
          console.log(
            `Miniatura ${resolution} gerada com sucesso para: ${partName || "modelo completo"}`,
          );
        } catch (error) {
          console.error("Erro ao gerar miniatura:", error);
          const err = error as Error & { status?: number };
          setErrorInfo({
            statusCode: err.status,
            message: err.message || String(error),
            stack: err.stack,
            url: urlModelo,
            timestamp: new Date().toISOString(),
            retryCount: retryCountRef.current,
          });
          setThumbDataUrl(null);
        }
      });
    },
    [urlModelo, partName, resolution],
  );

  // ------------------------------------------------------------
  // Lazy‑load observer
  // ------------------------------------------------------------
  useEffect(() => {
    if (thumbDataUrl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "50px" },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [thumbDataUrl]);

  // ------------------------------------------------------------
  // Trigger generation when visible
  // ------------------------------------------------------------
  useEffect(() => {
    if (isVisible && !thumbDataUrl && !errorInfo) {
      generateThumbnail();
    }
  }, [isVisible, thumbDataUrl, errorInfo, generateThumbnail]);

  const handleClick = (e: React.SyntheticEvent) => {
    if (errorInfo) {
      // Se houver erro, não queremos abrir o modal nem propagar o clique para o card pai
      e.stopPropagation();
      return;
    }

    if (onPartClick) {
      onPartClick();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleRetry = () => {
    retryCountRef.current += 1;
    setErrorInfo(null);
    generateThumbnail(true);
  };

  const extension = urlModelo.split(".").pop()?.toLowerCase() || "glb";

  return (
    <>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden rounded-md bg-gray-100/50 transition-shadow duration-300 hover:shadow-lg dark:bg-gray-800/50"
      >
        <div
          className="h-full w-full cursor-pointer"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleClick(e);
          }}
        >
          {/* ------------------------------------------------
              Render states
              ------------------------------------------------ */}
          {thumbDataUrl ? (
            <>
              <img
                src={thumbDataUrl}
                alt={`Miniatura 3D de ${nomePeca}${partName ? ` - ${partName}` : ""}`}
                className="h-full w-full object-cover"
                onError={() => {
                  console.error("Erro ao carregar imagem da miniatura");
                  setErrorInfo({
                    message: "Erro ao carregar imagem",
                    url: urlModelo,
                    timestamp: new Date().toISOString(),
                  });
                  setThumbDataUrl(null);
                }}
              />
              <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 text-xs text-white">
                .{extension}
              </div>
            </>
          ) : errorInfo ? (
            <motion.div
              layout
              layoutId={`error-${urlModelo}`}
              className="h-full w-full"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
              }}
            >
              <ErrorScreen
                errorInfo={errorInfo}
                onRetry={handleRetry}
                onBack={onBack}
                layoutHint={resolution}
              />
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <Eye className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Gerando {partName || "modelo"}...
                  </span>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Carregando...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <VisualizadorModal
          urlModelo={urlModelo}
          nomePeca={nomePeca}
          initialSelectedPart={partName}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
