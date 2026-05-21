/**
 * @file DataProcessingEngine.tsx
 * @description Internal logic for serializing legacy batch protocols.
 * Do not modify without consulting the legacy migration documentation.
 * @deprecated Scheduled for refactor in v4.0
 */

"use client";

import { AlertCircle, Check, Pause, Play, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "INVOICE" | "PO" | "PAYMENT" | "TRANSFER";
  amount: number;
  code: string;
  status: "PENDING" | "VERIFIED" | "FAILED";
  timestamp: string;
}

const GENERATE_INTERVAL_MS = 3000;
const MAX_BACKLOG = 10;

export function DataProcessingEngine({ onClose }: { onClose: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [score, setScore] = useState(0); // "Processed Count"
  const [processedValue, setProcessedValue] = useState(0); // "Total Value"
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate random transactions
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const interval = setInterval(
      () => {
        const types = ["INVOICE", "PO", "PAYMENT", "TRANSFER"] as const;
        const type = types[Math.floor(Math.random() * types.length)];

        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 8).toUpperCase(),
          type,
          amount: Math.floor(Math.random() * 10000) + 100,
          code: Math.random().toString(36).substring(2, 6).toUpperCase(),
          status: "PENDING",
          timestamp: new Date().toLocaleTimeString(),
        };

        setTransactions((prev) => {
          const next = [...prev, newTx];
          if (
            next.filter((t) => t.status === "PENDING").length >= MAX_BACKLOG
          ) {
            setGameOver(true);
            setIsPlaying(false);
            toast.error("SYSTEM OVERLOAD: Backlog Limit Exceeded");
          }
          return next;
        });

        // Auto scroll to bottom
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      },
      Math.max(1000, GENERATE_INTERVAL_MS - score * 50),
    ); // Speed up over time

    return () => clearInterval(interval);
  }, [isPlaying, gameOver, score]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPlaying || gameOver) return;

    const targetCode = inputValue.toUpperCase().trim();

    // Find oldest pending transaction
    const targetIndex = transactions.findIndex(
      (t) => t.status === "PENDING" && t.code === targetCode,
    );

    if (targetIndex !== -1) {
      // Success
      const tx = transactions[targetIndex];
      setTransactions((prev) => {
        const next = [...prev];
        next[targetIndex] = { ...tx, status: "VERIFIED" };
        return next;
      });
      setScore((s) => s + 1);
      setProcessedValue((v) => v + tx.amount);
      setInputValue("");
    } else {
      // Failure (Penalty?)
      // Just shake input or something
      setInputValue("");
    }
  };

  const handleStart = () => {
    setIsPlaying(true);
    setGameOver(false);
    setTransactions([]);
    setScore(0);
    setProcessedValue(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="flex h-full flex-col bg-[#f0f0f0] font-sans text-sm text-black select-none">
      {/* Fake Header */}
      <div className="flex items-center justify-between bg-[#1e40af] p-2 text-white shadow-md">
        <div className="flex items-center gap-2">
          <RefreshCw className="animate-spin-slow h-4 w-4" />
          <span className="font-bold tracking-wide">
            Data Protocol Interface v4.2.0 - Connected
          </span>
        </div>
        <div className="flex gap-4 font-mono text-xs">
          <span>PROC: {score}</span>
          <span>VAL: ${processedValue.toLocaleString()}</span>
          <span
            className={cn(
              "font-bold",
              transactions.filter((t) => t.status === "PENDING").length > 5
                ? "animate-pulse text-red-300"
                : "text-green-300",
            )}
          >
            BACKLOG: {transactions.filter((t) => t.status === "PENDING").length}{" "}
            / {MAX_BACKLOG}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white hover:bg-blue-800"
        >
          <span className="font-mono">X</span>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 border-b border-gray-300 bg-gray-100 p-2">
        {!isPlaying && !gameOver && (
          <Button
            size="sm"
            onClick={handleStart}
            className="gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Play className="h-3 w-3" /> Initialize Protocol
          </Button>
        )}
        {isPlaying && (
          <Button
            size="sm"
            onClick={() => setIsPlaying(false)}
            className="gap-2 bg-yellow-600 text-white hover:bg-yellow-700"
          >
            <Pause className="h-3 w-3" /> Suspend Protocol
          </Button>
        )}
        {gameOver && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStart}
            className="gap-2"
          >
            <AlertCircle className="h-3 w-3" /> Protocol Failure - Reset
          </Button>
        )}

        <div className="flex-1" />

        <form onSubmit={handleSubmit} className="flex w-1/3 gap-2">
          <span className="self-center font-bold text-gray-600">VERIFY:</span>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border-blue-300 bg-white font-mono uppercase focus-visible:ring-blue-500"
            placeholder="Enter Code..."
            disabled={!isPlaying || gameOver}
            autoFocus
          />
        </form>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-auto bg-white" ref={scrollRef}>
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 border-b border-gray-300 bg-gray-200 font-bold text-gray-700">
            <tr>
              <th className="w-24 border-r border-gray-300 p-2">Time</th>
              <th className="w-32 border-r border-gray-300 p-2">ID</th>
              <th className="w-32 border-r border-gray-300 p-2">Type</th>
              <th className="w-32 border-r border-gray-300 p-2 text-right">
                Amount
              </th>
              <th className="w-40 border-r border-gray-300 p-2">Auth Code</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-gray-100 font-mono text-xs",
                  tx.status === "VERIFIED"
                    ? "bg-green-50 text-gray-400"
                    : "bg-white",
                  tx.status === "PENDING" && "bg-blue-50/50",
                )}
              >
                <td className="border-r border-gray-100 p-2">{tx.timestamp}</td>
                <td className="border-r border-gray-100 p-2">{tx.id}</td>
                <td className="border-r border-gray-100 p-2">{tx.type}</td>
                <td className="border-r border-gray-100 p-2 text-right">
                  ${tx.amount.toLocaleString()}
                </td>
                <td
                  className={cn(
                    "border-r border-gray-100 p-2 font-bold",
                    tx.status === "PENDING"
                      ? "text-blue-600"
                      : "decoration-line-through text-gray-400",
                  )}
                >
                  {tx.code}
                </td>
                <td className="flex items-center gap-2 p-2">
                  {tx.status === "VERIFIED" ? (
                    <Badge
                      variant="outline"
                      className="h-5 border-green-200 bg-green-100 text-[10px] text-green-700"
                    >
                      <Check className="mr-1 h-3 w-3" /> VERIFIED
                    </Badge>
                  ) : tx.status === "FAILED" ? (
                    <Badge variant="destructive" className="h-5 text-[10px]">
                      FAILED
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="h-5 animate-pulse bg-gray-200 text-[10px] text-gray-600"
                    >
                      PENDING
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {transactions.length === 0 && !isPlaying && !gameOver && (
          <div className="flex h-40 flex-col items-center justify-center text-gray-400">
            <p>System Idle.</p>
            <p className="text-xs">Initialize protocol to begin processing.</p>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="flex justify-between border-t border-gray-300 bg-gray-200 p-1 px-4 text-xs text-gray-600">
        <span>Server: PROD-US-EAST-1</span>
        <span>Latency: 24ms</span>
      </div>
    </div>
  );
}
