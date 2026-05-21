"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface OrientationGizmoRef {
  updateRotation: (rotation: { x: number; y: number; z: number }) => void;
  updateMatrix: (matrixStyle: string) => void; // New matrix-based update
}

interface OrientationGizmoProps {
  onOrientationSelect: (
    orientation: "top" | "bottom" | "left" | "right" | "front" | "back" | "iso",
  ) => void;
  className?: string;
}

export const OrientationGizmo = forwardRef<
  OrientationGizmoRef,
  OrientationGizmoProps
>(({ onOrientationSelect, className }, ref) => {
  const cubeRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    updateRotation: (rotation: { x: number; y: number; z: number }) => {
      if (cubeRef.current) {
        const { x, y, z } = rotation;
        cubeRef.current.style.transform = `rotateX(${-x}rad) rotateY(${-y}rad) rotateZ(${-z}rad)`;
      }
    },
    updateMatrix: (matrixStyle: string) => {
      if (cubeRef.current) {
        // Prepend Scale Y (-1) to fix coordinate system (CSS Y-down vs Three Y-up)
        // This mirrors the world vertically, placing "Top" at the top.
        cubeRef.current.style.transform = `scale3d(1, -1, 1) ${matrixStyle}`;
      }
    },
  }));

  return (
    <div
      className={cn(
        "group relative h-20 w-20 select-none perspective-[400px]",
        className,
      )}
    >
      <style>{`
        .cube-container {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transform: rotateX(-25deg) rotateY(-35deg);
          transition: transform 0.1s linear;
          will-change: transform;
        }

        .cube-face {
          position: absolute;
          width: 40px;
          height: 40px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-family: monospace;
          color: white;
          font-size: 10px;
          cursor: pointer;
          transition: background 0.2s;
          left: 50%;
          top: 50%;
          margin-left: -20px;
          margin-top: -20px;
          backdrop-filter: blur(2px);
        }

        .cube-face:hover {
          background: rgba(59, 130, 246, 0.6); /* blue-500 */
          border-color: rgba(59, 130, 246, 0.8);
        }

        /* Side faces - no scaleY(-1) needed as no text */
        .face-front {
          transform: rotateY(0deg) translateZ(20px);
        }
        .face-back {
          transform: rotateY(180deg) translateZ(20px);
        }
        .face-right {
          transform: rotateY(90deg) translateZ(20px);
        }
        .face-left {
          transform: rotateY(-90deg) translateZ(20px);
        }

        /* Swap Top/Bottom definitions to compensate for container scaleY(-1) */
        .face-top {
          transform: rotateX(-90deg) translateZ(20px);
        }
        .face-bottom {
          transform: rotateX(90deg) translateZ(20px);
        }
      `}</style>

      <div className="cube-container hover:scale-110" ref={cubeRef}>
        <div
          className="cube-face face-front bg-blue-500/90 hover:bg-blue-400"
          onClick={() => onOrientationSelect("front")}
          title="Frente"
        />
        <div
          className="cube-face face-back bg-blue-600/90 hover:bg-blue-500"
          onClick={() => onOrientationSelect("back")}
          title="Trás"
        />
        <div
          className="cube-face face-right bg-red-500/90 hover:bg-red-400"
          onClick={() => onOrientationSelect("right")}
          title="Direita"
        />
        <div
          className="cube-face face-left bg-red-600/90 hover:bg-red-500"
          onClick={() => onOrientationSelect("left")}
          title="Esquerda"
        />
        <div
          className="cube-face face-top bg-green-500/90 hover:bg-green-400"
          onClick={() => onOrientationSelect("top")}
          title="Topo"
        />
        <div
          className="cube-face face-bottom bg-green-600/90 hover:bg-green-500"
          onClick={() => onOrientationSelect("bottom")}
          title="Baixo"
        />
      </div>

      <div
        className="absolute right-0 bottom-0 z-10 h-6 w-6 cursor-pointer bg-transparent"
        onClick={() => onOrientationSelect("iso")}
        title="Vista Isométrica (Reset)"
      />
    </div>
  );
});

OrientationGizmo.displayName = "OrientationGizmo";
