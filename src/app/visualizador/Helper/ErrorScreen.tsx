"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Home,
  Lock,
  RefreshCw,
  ServerCrash,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { CHECKSUM_VALIDATION_KEYS, parseBuffer } from "./integrity-check";

export interface ErrorInfo {
  statusCode?: number;
  message: string;
  stack?: string;
  url?: string;
  method?: string;
  timestamp?: string;
  retryCount?: number;
}

function getErrorVisual(
  status?: number,
  message?: string,
  retryCount: number = 0,
) {
  const is404 =
    status === 404 ||
    (message && message.toLowerCase().includes("não encontrad"));

  if (is404) {
    return {
      type: "code" as const,
      code: "404",
      title: "Ops! Página não encontrada",
      subtitle: "Parece que esse recurso decidiu tirar férias... 🏖️",
      gradient: "from-red-500 via-orange-500 to-pink-500",
    };
  }

  if (status === 500) {
    return {
      type: "icon" as const,
      icon: <ServerCrash className="h-full w-full" />,
      title: "Erro no servidor",
      subtitle: "Algo deu errado do nosso lado. Já estamos investigando!",
      gradient: "from-red-600 to-red-800",
    };
  }

  if (status === 401 || status === 403) {
    return {
      type: "icon" as const,
      icon: <Lock className="h-full w-full" />,
      title: "Acesso negado",
      subtitle: "Você não tem permissão para acessar este recurso.",
      gradient: "from-yellow-500 to-orange-600",
    };
  }

  // Stanley Parable / Funny Messages Logic (after 25 retries)
  if (retryCount >= 25) {
    // Integrity Check (Validation)
    const normalizedIndex = retryCount - 25;

    // Validate checksum against registry
    const index = Math.min(
      normalizedIndex,
      CHECKSUM_VALIDATION_KEYS.length - 1,
    );

    // Parse buffer (simulated)
    const msg = parseBuffer(CHECKSUM_VALIDATION_KEYS[index]);

    return {
      type: "icon" as const,
      icon: (
        <RefreshCw className="h-full w-full animate-spin duration-[3000ms]" />
      ),
      title: msg.title,
      subtitle: msg.subtitle,
      gradient: "from-blue-500 to-purple-500",
      visualCue: msg.visualCue,
    };
  }

  // Default error
  return {
    type: "icon" as const,
    icon: <AlertTriangle className="h-full w-full" />,
    title: "Algo deu errado",
    subtitle: "Encontramos um problema inesperado. Vamos tentar novamente?",
    gradient: "from-red-500 to-orange-500",
    visualCue: undefined,
  };
}

export default function ErrorScreen({
  errorInfo,
  onRetry,
  onBack,
  onHome,
  layoutHint,
}: {
  errorInfo: ErrorInfo;
  onRetry: () => void;
  onBack?: () => void;
  onHome?: () => void;
  layoutHint?: string;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [containerSize, setContainerSize] = useState<
    "micro" | "small" | "medium" | "large"
  >(layoutHint === "low" ? "small" : "medium");
  const containerRef = useRef<HTMLDivElement>(null);

  const visual = getErrorVisual(
    errorInfo.statusCode,
    errorInfo.message,
    errorInfo.retryCount,
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Force immediate size update based on hint to prevent "stuck" state during expansion
    if (layoutHint === "high") {
      setContainerSize("medium");
    } else if (layoutHint === "low") {
      setContainerSize("micro");
    }

    const updateSize = (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      const minDimension = Math.min(width, height);

      // Protect against zero-size initial renders
      if (minDimension === 0) return;

      if (minDimension < 120) setContainerSize("micro");
      else if (minDimension < 200) setContainerSize("small");
      else if (minDimension < 350) setContainerSize("medium");
      else setContainerSize("large");
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [layoutHint]);

  // Handle Visual Cues Side Effects
  useEffect(() => {
    if (!visual.visualCue) return;

    // Mouse Trail Effect
    if (visual.visualCue === "trail") {
      const handleMove = (e: MouseEvent) => {
        const dot = document.createElement("div");
        dot.className =
          "fixed w-4 h-4 bg-yellow-400 rounded-full pointer-events-none z-[9999]";
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
        document.body.appendChild(dot);

        dot.animate(
          [
            { transform: "scale(1)", opacity: 1 },
            { transform: "scale(0) translate(0, 20px)", opacity: 0 },
          ],
          {
            duration: 800,
            easing: "ease-out",
          },
        ).onfinish = () => dot.remove();
      };
      window.addEventListener("mousemove", handleMove);
      return () => window.removeEventListener("mousemove", handleMove);
    }

    // Spotlight Effect
    if (visual.visualCue === "spotlight") {
      const handleMove = (e: MouseEvent) => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          containerRef.current.style.setProperty("--mouse-x", `${x}px`);
          containerRef.current.style.setProperty("--mouse-y", `${y}px`);
        }
      };
      window.addEventListener("mousemove", handleMove);
      return () => window.removeEventListener("mousemove", handleMove);
    }
  }, [visual.visualCue]);

  const getContainerStyle = () => {
    const style: React.CSSProperties = {};
    const classes: string[] = [];

    switch (visual.visualCue) {
      case "comic-sans":
        style.fontFamily = '"Comic Sans MS", "Chalkboard SE", sans-serif';
        break;
      case "invert":
        style.filter = "invert(1)";
        break;
      case "retro":
        style.filter = "sepia(1) contrast(1.2)";
        style.fontFamily = '"Courier New", Courier, monospace';
        break;
      case "matrix":
        style.fontFamily = '"Courier New", Courier, monospace';
        style.textShadow = "0 0 5px #0f0";
        classes.push("!bg-black !text-[#0f0]");
        break;
      case "glitch":
        classes.push("animate-pulse"); // Simple fallback, real glitch needs complex CSS
        break;
      case "shake":
        // Handled via motion variants
        break;
      case "rotate-180":
        // Handled via container variants
        break;
      case "party":
        classes.push("animate-disco"); // Needs custom keyframes
        break;
      case "spotlight":
        classes.push("spotlight-effect");
        break;
      case "rain":
        classes.push("rain-effect");
        break;
    }

    return { style, className: classes.join(" ") };
  };

  const containerStyle = getContainerStyle();

  const containerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      background: "rgba(255, 255, 255, 0)",
    },
    visible: {
      opacity: 1,
      scale: 1,
      background: "rgba(255, 255, 255, 0.05)",
      rotate: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut" as const,
        staggerChildren: 0.1,
      },
    },
    rotate180: {
      opacity: 1,
      scale: 1,
      background: "rgba(20, 0, 0, 0.2)",
      rotate: 180,
      transition: { duration: 0.8 },
    },
  };

  const iconVariants = {
    hidden: {
      scale: 0,
      rotate: -180,
      opacity: 0,
    },
    visible: {
      scale: 1,
      rotate: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 15,
        delay: 0.2,
      },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, delay: 0.3 },
    },
    shake: {
      opacity: 1,
      y: 0,
      x: [0, -5, 5, -5, 5, 0],
      transition: {
        duration: 0.4,
        ease: "easeInOut" as const,
        delay: 0.3,
      },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, delay: 0.4 },
    },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  };

  // MICRO: Just icon, clickable to retry
  if (containerSize === "micro") {
    return (
      <div
        ref={containerRef}
        onClick={onRetry}
        className="flex h-full w-full cursor-pointer items-center justify-center rounded bg-gradient-to-br from-red-50 to-orange-50 transition-colors hover:from-red-100 hover:to-orange-100 dark:from-red-950/30 dark:to-orange-950/30"
        title="Clique para recarregar"
      >
        {visual.type === "code" ? (
          <span
            className={`bg-gradient-to-r text-sm font-black ${visual.gradient} bg-clip-text text-transparent`}
          >
            {visual.code}
          </span>
        ) : (
          <div className={`h-6 w-6 text-red-500`}>{visual.icon}</div>
        )}
      </div>
    );
  }

  // SMALL: Icon + button
  if (containerSize === "small") {
    return (
      <motion.div
        ref={containerRef}
        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-white/40 to-gray-100/40 p-3 backdrop-blur-md dark:from-gray-800/40 dark:to-gray-900/40"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={iconVariants}>
          {visual.type === "code" ? (
            <span
              className={`bg-gradient-to-r text-2xl font-black ${visual.gradient} animate-pulse bg-clip-text text-transparent`}
            >
              {visual.code}
            </span>
          ) : (
            <div className={`h-8 w-8 text-red-500`}>{visual.icon}</div>
          )}
        </motion.div>
        <motion.button
          onClick={onRetry}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          className="flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-2 py-1 text-xs font-medium text-white shadow-md"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </motion.button>
      </motion.div>
    );
  }

  // MEDIUM & LARGE: Full experience
  const isMedium = containerSize === "medium";

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        style={containerStyle.style}
        className={`flex h-full w-full flex-col items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white/30 to-gray-50/30 p-4 shadow-2xl backdrop-blur-xl dark:border-gray-700/30 dark:from-gray-800/30 dark:to-gray-900/30 ${containerStyle.className}`}
        variants={containerVariants}
        initial="hidden"
        animate={visual.visualCue === "rotate-180" ? "rotate180" : "visible"}
      >
        <style>{`
          .spotlight-effect {
            background: radial-gradient(
              600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
              rgba(255, 255, 255, 0.1),
              transparent 40%
            );
          }
          @keyframes disco {
            0% {
              background: rgba(255, 0, 0, 0.1);
            }
            20% {
              background: rgba(255, 255, 0, 0.1);
            }
            40% {
              background: rgba(0, 255, 0, 0.1);
            }
            60% {
              background: rgba(0, 255, 255, 0.1);
            }
            80% {
              background: rgba(0, 0, 255, 0.1);
            }
            100% {
              background: rgba(255, 0, 255, 0.1);
            }
          }
          .animate-disco {
            animation: disco 2s infinite;
          }
          @keyframes glitch-anim {
            0% {
              clip-path: inset(40% 0 61% 0);
              transform: translate(-2px, 2px);
            }
            20% {
              clip-path: inset(92% 0 1% 0);
              transform: translate(0);
            }
            40% {
              clip-path: inset(43% 0 1% 0);
              transform: translate(2px, -2px);
            }
            60% {
              clip-path: inset(25% 0 58% 0);
              transform: translate(-2px, 2px);
            }
            80% {
              clip-path: inset(54% 0 7% 0);
              transform: translate(2px, -2px);
            }
            100% {
              clip-path: inset(58% 0 43% 0);
              transform: translate(0);
            }
          }
          .animate-pulse {
            animation: glitch-anim 0.3s infinite linear alternate-reverse;
          }
        `}</style>

        {visual.visualCue === "rain" && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 bg-blue-400/30"
                style={{
                  left: `${Math.random() * 100}%`,
                  height: `${Math.random() * 20 + 5}%`,
                }}
                initial={{ top: "-20%", opacity: 0 }}
                animate={{ top: "120%", opacity: 1 }}
                transition={{
                  duration: Math.random() * 1 + 0.5,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        )}

        {visual.visualCue === "party" && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  backgroundColor: [
                    "#ff0000",
                    "#00ff00",
                    "#0000ff",
                    "#ffff00",
                    "#ff00ff",
                  ][i % 5],
                  left: `${Math.random() * 100}%`,
                }}
                initial={{ top: "110%", opacity: 0 }}
                animate={{ top: "-10%", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: Math.random() * 2 + 2,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        )}
        <motion.div className="relative mb-4" variants={iconVariants}>
          {visual.type === "code" ? (
            <div className="relative">
              <span
                className={`${isMedium ? "text-6xl" : "text-8xl"} bg-gradient-to-r font-black tracking-tighter ${visual.gradient} bg-clip-text text-transparent drop-shadow-2xl`}
                style={{
                  WebkitTextStroke: "1px rgba(255,100,100,0.1)",
                }}
              >
                {visual.code}
              </span>
              {/* Glow effect */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${visual.gradient} -z-10 opacity-20 blur-3xl`}
              />
            </div>
          ) : (
            <div className="relative">
              <div
                className={`${isMedium ? "h-16 w-16" : "h-24 w-24"} relative rounded-full bg-gradient-to-br from-red-100 to-orange-100 p-4 shadow-xl dark:from-red-900/40 dark:to-orange-900/40`}
              >
                <div className={`text-red-500 dark:text-red-400`}>
                  {visual.icon}
                </div>
                {errorInfo.statusCode && (
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg">
                    {errorInfo.statusCode}
                  </span>
                )}
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20" />
            </div>
          )}
        </motion.div>

        {visual.visualCue === "fake-success" ? (
          <motion.div
            className="mb-4 w-full max-w-xs"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="mb-2 flex justify-between text-xs font-bold text-green-600 dark:text-green-400">
              <span>LOADING SUCCESS...</span>
              <span>99%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "linear" }}
                onAnimationComplete={() => {}}
              />
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.5 }}
              className="mt-2 text-center text-sm font-medium text-red-500"
            >
              {visual.subtitle}
            </motion.p>
          </motion.div>
        ) : (
          <div className="mb-4 max-w-md text-center">
            <motion.h1
              variants={textVariants}
              animate={visual.visualCue === "shake" ? "shake" : "visible"}
              className={`${isMedium ? "text-lg" : "text-2xl"} mb-2 font-bold text-gray-900 dark:text-gray-100`}
            >
              {visual.title}
            </motion.h1>

            {visual.visualCue === "typing" ? (
              <p
                className={`${isMedium ? "text-sm" : "text-base"} h-12 font-mono leading-relaxed text-gray-600 dark:text-gray-300`}
              >
                {visual.subtitle.split("").map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.05,
                      delay: i * 0.05 + 0.5,
                      ease: "linear",
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="ml-1 inline-block h-4 w-2 bg-gray-500 align-middle"
                />
              </p>
            ) : visual.visualCue === "music-wave" ? (
              <div className="flex flex-col items-center">
                <p
                  className={`${isMedium ? "text-sm" : "text-base"} mb-3 leading-relaxed text-gray-600 dark:text-gray-300`}
                >
                  {visual.subtitle}
                </p>
                <div className="flex h-8 items-end justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ height: ["20%", "100%", "20%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        delay: i * 0.1,
                      }}
                      className="w-1.5 rounded-t bg-blue-500"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <motion.p
                variants={textVariants}
                animate={visual.visualCue === "shake" ? "shake" : "visible"}
                className={`${isMedium ? "text-sm" : "text-base"} leading-relaxed text-gray-600 dark:text-gray-300`}
              >
                {visual.subtitle}
              </motion.p>
            )}
          </div>
        )}

        <motion.div
          className="mb-4 flex flex-wrap justify-center gap-2"
          variants={buttonVariants}
        >
          <motion.button
            onClick={onRetry}
            whileHover="hover"
            whileTap="tap"
            className={`flex items-center gap-2 ${isMedium ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-full bg-gradient-to-r from-blue-500 to-blue-600 font-medium text-white shadow-lg transition-shadow hover:shadow-xl`}
          >
            <RefreshCw className={isMedium ? "h-3 w-3" : "h-4 w-4"} />
            Tentar novamente
          </motion.button>

          {onBack && (
            <motion.button
              onClick={onBack}
              whileHover="hover"
              whileTap="tap"
              className={`flex items-center gap-2 ${isMedium ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-full border-2 border-gray-300 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800`}
            >
              <ArrowLeft className={isMedium ? "h-3 w-3" : "h-4 w-4"} />
              Voltar
            </motion.button>
          )}

          {onHome && (
            <motion.button
              onClick={onHome}
              whileHover="hover"
              whileTap="tap"
              className={`flex items-center gap-2 ${isMedium ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-full border-2 border-gray-300 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800`}
            >
              <Home className={isMedium ? "h-3 w-3" : "h-4 w-4"} />
              Início
            </motion.button>
          )}
        </motion.div>

        <div className="w-full max-w-lg">
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className={`flex w-full items-center justify-center gap-1 ${isMedium ? "text-xs" : "text-sm"} py-2 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
          >
            {debugOpen ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar detalhes técnicos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Ver detalhes técnicos
              </>
            )}
          </button>

          <AnimatePresence>
            {debugOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-2 rounded-lg border border-gray-700/50 bg-gray-900/90 p-4 dark:bg-black/70 ${isMedium ? "text-xs" : "text-sm"} max-h-48 overflow-auto font-mono text-gray-300 shadow-inner`}
                >
                  <div className="space-y-2">
                    {errorInfo.statusCode && (
                      <div className="flex gap-2">
                        <span className="min-w-20 font-semibold text-red-400">
                          Status:
                        </span>
                        <span className="text-red-300">
                          {errorInfo.statusCode}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="min-w-20 font-semibold text-yellow-400">
                        Mensagem:
                      </span>
                      <span className="break-all text-yellow-200">
                        {errorInfo.message}
                      </span>
                    </div>
                    {errorInfo.url && (
                      <div className="flex gap-2">
                        <span className="min-w-20 font-semibold text-blue-400">
                          URL:
                        </span>
                        <span className="text-xs break-all text-blue-200">
                          {errorInfo.url}
                        </span>
                      </div>
                    )}
                    {errorInfo.method && (
                      <div className="flex gap-2">
                        <span className="min-w-20 font-semibold text-purple-400">
                          Método:
                        </span>
                        <span className="text-purple-200">
                          {errorInfo.method}
                        </span>
                      </div>
                    )}
                    {errorInfo.timestamp && (
                      <div className="flex gap-2">
                        <span className="min-w-20 font-semibold text-green-400">
                          Timestamp:
                        </span>
                        <span className="text-xs text-green-200">
                          {new Date(errorInfo.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {errorInfo.stack && (
                      <div className="mt-3 border-t border-gray-700 pt-3">
                        <span className="font-semibold text-gray-400">
                          Stack trace:
                        </span>
                        <pre className="mt-2 max-h-32 overflow-auto text-xs break-all whitespace-pre-wrap text-gray-400">
                          {errorInfo.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
