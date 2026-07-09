"use client";

import { HTMLAttributes, useEffect, useRef, useState } from "react";

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  delay?: number;
}

// Fades a block up into place the first time it scrolls into the viewport.
// CSS-only "on mount" animations (like .animate-fade-up elsewhere in this
// codebase) already finish playing before the user ever scrolls to a
// below-the-fold section, so they can't produce this effect — it needs to
// know when the element actually enters the viewport.
export default function Reveal({ children, className = "", delay = 0, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: visible && delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
