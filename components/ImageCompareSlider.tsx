"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";

interface Props {
  srcLeft: string;
  srcRight: string;
  altLeft?: string;
  altRight?: string;
  className?: string;
}

export default function ImageCompareSlider({ srcLeft, srcRight, altLeft = "", altRight = "", className = "" }: Props) {
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getPercent = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * 100;
  }, []);

  const onMove = useCallback((clientX: number) => {
    if (!dragging.current) return;
    setPosition(getPercent(clientX));
  }, [getPercent]);

  const onMouseMove = useCallback((e: React.MouseEvent) => onMove(e.clientX), [onMove]);
  const onTouchMove = useCallback((e: React.TouchEvent) => onMove(e.touches[0].clientX), [onMove]);

  const startDrag = useCallback((clientX: number) => {
    dragging.current = true;
    setPosition(getPercent(clientX));
  }, [getPercent]);

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-square select-none overflow-hidden rounded-3xl border-[3px] border-zinc-700 shadow-[8px_8px_0px_0px_#263A2D] cursor-col-resize ${className}`}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={onTouchMove}
      onTouchEnd={stopDrag}
    >
      {/* Base image: Amado (always full) */}
      <Image src={srcLeft} alt={altLeft} fill priority draggable={false} className="object-cover object-top" />

      {/* Dr. CBD revealed from left as slider moves right */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <div className="relative w-full h-full" style={{ width: position > 0 ? `${10000 / position}%` : "100%" }}>
          <Image src={srcRight} alt={altRight} fill priority draggable={false} className="object-cover object-top" />
        </div>
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] z-10 pointer-events-none"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-white border-[2px] border-zinc-700 shadow-md -translate-y-1/2 -translate-x-1/2 cursor-col-resize"
        style={{ left: `${position}%` }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M6 4L2 9L6 14" stroke="#263A2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 4L16 9L12 14" stroke="#263A2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Labels — show only when respective image is visible */}
      {position < 95 && (
        <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-widest text-white bg-black/40 px-2 py-1 rounded-full pointer-events-none z-10">Amado</span>
      )}
      {position > 5 && (
        <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-widest text-white bg-black/40 px-2 py-1 rounded-full pointer-events-none z-10">Dr. CBD</span>
      )}
    </div>
  );
}
