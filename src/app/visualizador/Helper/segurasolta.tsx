// app/(protected)/visualizador/Helper/segurasolta.tsx
"use client";

import JSZip from "jszip";
import { Box, FileText, Loader2 } from "lucide-react";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

interface DragDropUploadProps {
  onUpload: (modelo: any) => void;
}

interface FoundFiles {
  glb: File | null;
  json: File | null;
}

export function DragDropUpload({ onUpload }: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [foundFiles, setFoundFiles] = useState<FoundFiles>({
    glb: null,
    json: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen && !isUploading)
        setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen, isUploading]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processDragItems = async (
    items: DataTransferItemList,
  ): Promise<FoundFiles> => {
    const found: FoundFiles = { glb: null, json: null };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        if (typeof item.webkitGetAsEntry === "function") {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            await processDirectory(entry as FileSystemDirectoryEntry, found);
          } else {
            const file = item.getAsFile();
            if (file) await processFile(file, found);
          }
        } else {
          const file = item.getAsFile();
          if (file) await processFile(file, found);
        }
      }
    }

    return found;
  };

  // Processa um diretório recursivamente
  const processDirectory = async (
    entry: FileSystemDirectoryEntry,
    found: FoundFiles,
  ): Promise<void> => {
    return new Promise((resolve) => {
      const reader = entry.createReader();

      reader.readEntries(async (entries: FileSystemEntry[]) => {
        for (const entry of entries) {
          if (found.glb && found.json) break; // Para se já encontrou ambos

          if (entry.isDirectory) {
            await processDirectory(entry as FileSystemDirectoryEntry, found);
          } else if (entry.isFile) {
            await new Promise<void>((fileResolve) => {
              (entry as FileSystemFileEntry).file((file: File) => {
                processFile(file, found);
                fileResolve();
              });
            });
          }
        }
        resolve();
      });
    });
  };

  // Processa um arquivo ZIP
  const processZipFile = async (
    file: File,
    found: FoundFiles,
  ): Promise<void> => {
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files);

      for (const entry of entries) {
        if (found.glb && found.json) break;
        if (entry.dir) continue;

        const fileName = entry.name.toLowerCase();
        // Ignora arquivos que começam com __MACOSX ou .DS_Store (comuns em zips de mac)
        if (fileName.includes("__macosx") || fileName.includes(".ds_store"))
          continue;

        if (fileName.endsWith(".glb") && !found.glb) {
          const blob = await entry.async("blob");
          found.glb = new File(
            [blob],
            entry.name.split("/").pop() || entry.name,
            {
              type: "model/gltf-binary",
            },
          );
        } else if (fileName.endsWith(".json") && !found.json) {
          const blob = await entry.async("blob");
          found.json = new File(
            [blob],
            entry.name.split("/").pop() || entry.name,
            {
              type: "application/json",
            },
          );
        }
      }
    } catch (error) {
      console.error("Erro ao processar arquivo ZIP:", error);
      toast.error("Falha ao ler o arquivo compactado.");
    }
  };

  // Processa um arquivo individual
  const processFile = async (file: File, found: FoundFiles): Promise<void> => {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".zip") || fileName.endsWith(".rar")) {
      await processZipFile(file, found);
    } else if (fileName.endsWith(".glb") && !found.glb) {
      found.glb = file;
    } else if (fileName.endsWith(".json") && !found.json) {
      found.json = file;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    console.log("handleDrop triggered");
    setIsDragging(false);
    setIsProcessing(true);
    setFoundFiles({ glb: null, json: null });

    try {
      console.log("Processing drag items...");
      const found = await processDragItems(e.dataTransfer.items);
      console.log("Found files:", found);
      setFoundFiles(found);
      setIsProcessing(false);

      if (found.glb && found.json) {
        console.log("Files found. Uploading...");
        toast.info(
          `Arquivos: ${found.glb.name} e ${found.json.name}. Iniciando upload...`,
        );
        await handleUpload(found.glb, found.json);
      } else if (found.glb || found.json) {
        console.log("Partial files:", found);
        const glbStatus = found.glb ? `✅ ${found.glb.name} ` : "❌ .glb";
        const jsonStatus = found.json ? `✅ ${found.json.name} ` : "❌ .json";
        toast.info(`Status: ${glbStatus} | ${jsonStatus} `);
      } else {
        console.warn("No valid files found in drop.");
        toast.error("Nenhum arquivo .glb ou .json válido encontrado.");
      }
    } catch (error) {
      console.error("Erro ao processar pasta:", error);
      toast.error("Erro ao processar a pasta.");
      setIsProcessing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const found: FoundFiles = { glb: null, json: null };
      Array.from(files).forEach((file) => processFile(file, found));
      setFoundFiles(found);
    }
  };

  const handleUpload = async (glbFile?: File, jsonFile?: File) => {
    console.log("handleUpload called");
    const glb = glbFile || foundFiles.glb;
    const json = jsonFile || foundFiles.json;

    console.log("Files to upload:", { glb: glb?.name, json: json?.name });

    if (!glb || !json) {
      console.error("Missing files for upload");
      toast.error("São necessários ambos os arquivos: .glb e .json");
      return;
    }

    setIsUploading(true);

    try {
      // Local conversion for Standalone App
      const glbUrl = URL.createObjectURL(glb);
      let materialText = "{}";
      if (json) {
        materialText = await json.text();
      }

      const newModelo = {
        id: Date.now().toString(),
        nome: glb.name.replace(/\.glb$/i, ""),
        codigo: glb.name.split('.')[0] || "MDL-" + Date.now().toString(),
        urlModelo: glbUrl,
        revisao: "00",
        material: materialText
      };

      onUpload(newModelo);

      toast.success("Modelo carregado com sucesso!");
      setIsModalOpen(false);
      setFoundFiles({ glb: null, json: null });
    } catch (error: unknown) {
      console.error("Erro no upload:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao fazer upload dos arquivos",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canUpload =
    foundFiles.glb && foundFiles.json && !isUploading && !isProcessing;

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="mb-6 flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload de Modelos
          </Button>
        </DialogTrigger>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-card border-border w-full max-w-md rounded-xl border shadow-2xl transition-all duration-200">
              <div className="border-border flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-foreground text-lg font-semibold">
                  Upload de Modelos 3D
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => !isUploading && setIsModalOpen(false)}
                >
                  ✕
                </Button>
              </div>

              <div className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  aria-disabled={isUploading}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.json,.zip"
                    multiple
                    onChange={handleFileInput}
                    disabled={isUploading || isProcessing}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center justify-center">
                    {isUploading || isProcessing ? (
                      <>
                        <Loader2 className="text-primary mb-4 h-12 w-12 animate-spin" />
                        <p className="text-foreground text-base font-medium">
                          {isProcessing
                            ? "Processando pasta..."
                            : "Fazendo upload..."}
                        </p>
                        <p className="text-muted-foreground mt-2 text-sm">
                          {isProcessing
                            ? "Buscando arquivos..."
                            : "Aguarde enquanto seus arquivos são processados"}
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="text-muted-foreground mb-3 h-12 w-12"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-foreground text-base font-medium">
                          Arraste sua pasta ou arquivo .zip aqui
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          ou clique para selecionar
                        </p>
                        <p className="text-muted-foreground/70 mt-1 text-xs">
                          São necessários: arquivo .glb e .json (ou .zip
                          contendo ambos)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview dos arquivos encontrados */}
                {(foundFiles.glb || foundFiles.json) && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-foreground text-sm font-medium">
                      Arquivos encontrados:
                    </h3>
                    <div className="space-y-2">
                      {foundFiles.glb && (
                        <div className="bg-primary/10 flex items-center gap-2 rounded-md p-3">
                          <Box className="text-primary h-4 w-4" />
                          <span className="text-foreground text-sm">
                            {foundFiles.glb.name}
                          </span>
                        </div>
                      )}
                      {foundFiles.json && (
                        <div className="bg-primary/10 flex items-center gap-2 rounded-md p-3">
                          <FileText className="text-primary h-4 w-4" />
                          <span className="text-foreground text-sm">
                            {foundFiles.json.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Botão de upload */}
                {canUpload && (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => handleUpload()}
                    disabled={!canUpload}
                  >
                    Fazer Upload do Modelo
                  </Button>
                )}

                {!isUploading && !isProcessing && (
                  <p className="text-muted-foreground mt-5 text-center text-sm">
                    Arraste uma pasta ou .zip contendo o arquivo .glb e .json
                    correspondente.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

export default DragDropUpload;
