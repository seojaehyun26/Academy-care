"use client";

import { HTMLAttributes, useEffect, useRef, useState } from "react";

interface TiltCardProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: number;
}

// Gives a card a layered 3D feel: a gentle scroll-linked tilt at rest, plus a
// stronger tilt that tracks the mouse on hover. Children can add depth by
// setting their own `transform: translateZ(Npx)` — the preserve-3d context
// here makes those compose with the rotation instead of just moving in 2D.
export default function TiltCard({ children, className = "", style, intensity = 10, ...rest }: TiltCardProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverRotate, setHoverRotate] = useState({ x: 0, y: 0 });
  const [scrollRotate, setScrollRotate] = useState(0);
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const progress = Math.max(-1, Math.min(1, (center - vh / 2) / (vh / 2)));
      setScrollRotate(progress * 6);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setHoverRotate({ y: (px - 0.5) * intensity * 2, x: (0.5 - py) * intensity * 2 });
    setGlow({ x: px * 100, y: py * 100 });
  };

  const handleLeave = () => {
    setHoverRotate({ x: 0, y: 0 });
    setGlow({ x: 50, y: 50 });
  };

  const rotateX = scrollRotate + hoverRotate.x;
  const rotateY = hoverRotate.y;

  return (
    <div ref={wrapRef} className={`tilt-card ${className}`} style={style} {...rest}>
      <div
        className="tilt-card-inner"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` }}
      >
        <div
          className="tilt-card-glow"
          style={{ background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.22), transparent 60%)` }}
        />
        {children}
      </div>
    </div>
  );
}
