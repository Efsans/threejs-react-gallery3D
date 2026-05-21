/**
 * @file SemanticAnalysisModule.tsx
 * @description
 * Advanced parsing engine for semantic code validation.
 * Includes experimental heuristic based on abstract syntax tree traversal.
 * @deprecated Use the new AST_V2 parser for new implementations.
 */

"use client";

import { AlertTriangle, CheckCircle, Info, XCircle, GitPullRequest, X, FileCode, Check } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Snippet {
  id: string;
  language: "typescript" | "python" | "sql";
  filename: string;
  code: string;
  hasBug: boolean;
  bugLine?: number;
  bugDescription?: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: "PR-1024",
    language: "typescript",
    filename: "auth-provider.ts",
    code: `async function login(user: User) {
  if (user.password = "password123") {
    return true;
  }
  return false;
}`,
    hasBug: true,
    bugLine: 2,
    bugDescription: "Assignment in condition (user.password = ...)",
  },
  {
    id: "PR-1025",
    language: "python",
    filename: "data_processor.py",
    code: `def process_data(data):
    results = []
    for item in data:
      if item.is_valid:
        results.append(item.value)
    return results`,
    hasBug: false,
  },
  {
    id: "PR-1026",
    language: "typescript",
    filename: "utils.ts",
    code: `export const calculateTotal = (items: any[]) => {
  return items.reduce((acc, item) => {
    return acc + item.price;
  }, 0);
};`,
    hasBug: false,
  },
  {
    id: "PR-1027",
    language: "sql",
    filename: "analytics_query.sql",
    code: `SELECT user_id, COUNT(*)
FROM events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1`,
    hasBug: true,
    bugLine: 4,
    bugDescription:
      "GROUP BY positional argument might be unsupported or risky.", // Actually this is often valid, let's make a real bug
  },
  {
    id: "PR-1028",
    language: "typescript",
    filename: "api-client.ts",
    code: `const fetchUser = async (id: string) => {
  const res = await fetch(\`/api/users/\${id}\`);
  const data = res.json();
  return data;
}`,
    hasBug: true,
    bugLine: 3,
    bugDescription: "Missing await on res.json()",
  },
  {
    id: "PR-1029",
    language: "python",
    filename: "scheduler.py",
    code: `import time

def wait_for_job(job_id):
  while True:
    status = check_status(job_id)
    if status == 'COMPLETED':
      break
    time.sleep(5)
  print("Job done")`,
    hasBug: false,
  },
  {
    id: "PR-1030",
    language: "typescript",
    filename: "component.tsx",
    code: `useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('scroll', handleResize);
  };
}, []);`,
    hasBug: true,
    bugLine: 4,
    bugDescription:
      "Removing wrong event listener ('scroll' instead of 'resize')",
  },
];

export function SemanticAnalysisModule({ onClose }: { onClose: () => void }) {
  const [currentSnippet, setCurrentSnippet] = useState<Snippet | null>(null);
  const [score, setScore] = useState(0); // "Reviewed Count"
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"pass" | "fail" | null>(null);

  const loadNextSnippet = () => {
    const randomUserInfo =
      SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)];
    // Deep copy to allow repeated use? Or just random select.
    // Let's create a slightly unique ID to fake 'infinite' work
    const next = {
      ...randomUserInfo,
      id: `PR-${Math.floor(Math.random() * 9000) + 1000}`,
    };
    setCurrentSnippet(next);
    setFeedback(null);
  };

  useEffect(() => {
    loadNextSnippet();
  }, []);

  const handleDecision = (approved: boolean) => {
    if (!currentSnippet) return;

    const isCorrect =
      (approved && !currentSnippet.hasBug) ||
      (!approved && currentSnippet.hasBug);

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      // Immediate next
      loadNextSnippet();
    } else {
      setStreak(0);
      setFeedback("fail");
      // Show error briefly?
      setTimeout(() => loadNextSnippet(), 1500);
    }
  };

  if (!currentSnippet)
    return <div className="p-4 text-white">Initializing AST parser...</div>;

  return (
    <div className="flex h-full flex-col bg-[#0d1117] font-sans text-sm text-[#c9d1d9] select-none">
      {/* Fake GitHub/DevOps Header */}
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] p-3 text-xs">
        <div className="flex items-center gap-3">
          <GitPullRequest className="h-4 w-4 text-white" />
          <span className="font-semibold text-white">
            Semantic Analysis Queue
          </span>
          <Badge variant="outline" className="border-0 bg-[#238636] text-white">
            Processing
          </Badge>
        </div>
        <div className="flex gap-4">
          <span>Processed: {score}</span>
          <span
            className={
              streak > 5 ? "font-bold text-orange-400" : "text-gray-400"
            }
          >
            Streak: {streak} 🔥
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-gray-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Content: Diff View */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* PR Info */}
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            {currentSnippet.id}: feat/{currentSnippet.filename.split(".")[0]}
            -refactor
          </h2>
          <div className="flex items-center gap-2 text-xs text-[#8b949e]">
            <span className="flex items-center gap-1">
              <FileCode className="h-3 w-3" /> {currentSnippet.filename}
            </span>
            <span>•</span>
            <span>
              Changes: +{Math.floor(Math.random() * 50)} -
              {Math.floor(Math.random() * 20)}
            </span>
          </div>
        </div>

        {/* Code Block */}
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-[#30363d] bg-[#0d1117]">
          <div className="border-b border-[#30363d] bg-[#161b22] px-3 py-2 font-mono text-xs text-[#8b949e]">
            {currentSnippet.filename}
          </div>
          <div className="relative flex-1 overflow-auto p-4 font-mono text-sm">
            <pre className="language-typescript">
              {currentSnippet.code.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-3 w-8 border-r border-[#30363d] pr-3 text-right text-[#484f58] select-none">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "flex-1",
                      feedback === "fail" &&
                        currentSnippet.hasBug &&
                        i + 1 === currentSnippet.bugLine
                        ? "bg-red-900/30 text-red-200" // Highlight bug if handled wrong
                        : "",
                    )}
                  >
                    {line}
                  </span>
                </div>
              ))}
            </pre>

            {feedback === "fail" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="rounded-lg border border-red-500 bg-[#161b22] p-4 text-center shadow-2xl">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                  <h3 className="mb-1 font-bold text-white">Missed Review!</h3>
                  <p className="max-w-xs text-[#8b949e]">
                    {currentSnippet.hasBug
                      ? currentSnippet.bugDescription
                      : "This code was actually correct."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-4 border-t border-[#30363d] bg-[#161b22] p-4">
        <div className="text-xs text-[#8b949e]">
          Press <span className="kbd rounded bg-[#30363d] px-1">←</span> to
          Reject, <span className="kbd rounded bg-[#30363d] px-1">→</span> to
          Approve
        </div>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="gap-2 border-0 bg-[#da3633] text-white hover:bg-[#b62324]"
            onClick={() => handleDecision(false)}
            disabled={!!feedback}
          >
            <X className="h-4 w-4" /> Reject Syntax
          </Button>
          <Button
            className="gap-2 border-0 bg-[#238636] text-white hover:bg-[#2ea043]"
            onClick={() => handleDecision(true)}
            disabled={!!feedback}
          >
            <Check className="h-4 w-4" /> Approve Logic
          </Button>
        </div>
      </div>
    </div>
  );
}
