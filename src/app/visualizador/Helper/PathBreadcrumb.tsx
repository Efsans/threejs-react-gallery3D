"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface PathBreadcrumbProps {
  path: string[];
  onPathClick?: (index: number) => void;
}

export function PathBreadcrumb({ path, onPathClick }: PathBreadcrumbProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleSegments, setVisibleSegments] = useState<number>(0);

  useEffect(() => {
    if (path.length === 0) {
      setVisibleSegments(0);
      return;
    }

    setVisibleSegments(0);

    const animatePath = () => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < path.length) {
          setVisibleSegments(currentIndex + 1);
          currentIndex++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({
                left: scrollRef.current.scrollWidth,
                behavior: "smooth",
              });
            }
          }, 200);
        }
      }, 150);
    };

    setTimeout(animatePath, 100);
  }, [path]);

  if (path.length === 0) return null;

  return (
    <div className="border-border bg-card border-t">
      <div
        ref={scrollRef}
        className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex overflow-x-auto"
        style={{
          scrollbarWidth: "thin",
        }}
      >
        <div ref={containerRef} className="flex items-center gap-1 px-4 py-2">
          {path.map((segment, index) => {
            const isVisible = index < visibleSegments;
            return (
              <div
                key={index}
                className={`flex items-center gap-1 transition-all duration-300 ${
                  isVisible
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-4 opacity-0"
                }`}
                style={{
                  transitionDelay: `${index * 150}ms`,
                }}
              >
                {index > 0 && (
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <button
                  onClick={() => onPathClick?.(index)}
                  className={`rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    index === path.length - 1
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {segment.split("-")[0]}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
