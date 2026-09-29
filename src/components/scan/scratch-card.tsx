"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type Props = {
  /** Fired on the very first touch — the parent claims the code here. */
  onFirstTouch: () => void;
  /** Fired once enough of the foil has been scratched away. */
  onScratched: () => void;
  revealed: boolean;
  children: ReactNode;
  label?: string;
};

const BRUSH = 38;
const REVEAL_RATIO = 0.45;

function paintFoil(canvas: HTMLCanvasElement, label: string) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const foil = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  foil.addColorStop(0, "#b9b8b3");
  foil.addColorStop(0.45, "#e9e8e3");
  foil.addColorStop(0.55, "#d3d2cc");
  foil.addColorStop(1, "#a3a29c");
  ctx.fillStyle = foil;
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Subtle diagonal sheen lines.
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  for (let x = -rect.height; x < rect.width; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, rect.height);
    ctx.lineTo(x + rect.height, 0);
    ctx.stroke();
  }

  ctx.fillStyle = "#3d3c38";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.width / 2, rect.height / 2);
}

function clearedRatio(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let cleared = 0;
  let sampled = 0;
  // Sample every 16th pixel (stride 64 bytes) — plenty for a coverage estimate.
  for (let i = 3; i < data.length; i += 64) {
    sampled += 1;
    if (data[i] < 128) cleared += 1;
  }
  return sampled ? cleared / sampled : 1;
}

export function ScratchCard({ onFirstTouch, onScratched, revealed, children, label = "Grattez ici" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const touched = useRef(false);
  const done = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) paintFoil(canvas, label);
  }, [label]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scratch(to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    // Opaque brush: destination-out removes foil in proportion to source alpha.
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH;
    ctx.beginPath();
    const from = last.current ?? to;
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;

    moves.current += 1;
    if (!done.current && moves.current % 8 === 0 && clearedRatio(canvas) >= REVEAL_RATIO) {
      done.current = true;
      onScratched();
    }
  }

  return (
    <div className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl shadow-lg">
      <div className="absolute inset-0 grid place-items-center bg-white p-4 text-center text-[#0b0b0b]">{children}</div>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          "absolute inset-0 size-full cursor-pointer touch-none transition-opacity duration-500",
          revealed && "pointer-events-none opacity-0",
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          if (!touched.current) {
            touched.current = true;
            onFirstTouch();
          }
          scratch(point(e));
        }}
        onPointerMove={(e) => {
          if (drawing.current) scratch(point(e));
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
    </div>
  );
}
