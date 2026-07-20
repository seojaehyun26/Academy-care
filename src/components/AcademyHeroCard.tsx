"use client";

import { GraduationCap, Phone } from "lucide-react";
import TiltCard from "@/components/TiltCard";

interface AcademyHeroCardProps {
  name: string;
  intro?: string;
  directorName?: string;
  phone?: string;
  compact?: boolean;
}

export default function AcademyHeroCard({ name, intro, directorName, phone, compact = false }: AcademyHeroCardProps) {
  const displayName = name.trim() || "등록된 학원";

  return (
    <TiltCard intensity={compact ? 6 : 10}>
      <div className={`academy-hero ${compact ? "compact" : ""}`}>
        <div className="academy-hero-blob one" style={{ transform: "translateZ(-40px)" }} />
        <div className="academy-hero-blob two" style={{ transform: "translateZ(-30px)" }} />

        <div className="academy-hero-avatar" style={{ transform: `translateZ(${compact ? 34 : 50}px)` }}>
          {name.trim() ? name.trim()[0].toUpperCase() : <GraduationCap size={compact ? 20 : 28} />}
        </div>

        <div className="academy-hero-name" style={{ transform: `translateZ(${compact ? 22 : 32}px)` }}>
          {displayName}
        </div>

        {intro?.trim() && (
          <div className="academy-hero-intro" style={{ transform: `translateZ(${compact ? 16 : 22}px)` }}>
            {intro.trim()}
          </div>
        )}

        {(directorName || phone) && (
          <div className="academy-hero-meta" style={{ transform: `translateZ(${compact ? 12 : 16}px)` }}>
            {directorName && <span>원장 {directorName}</span>}
            {phone && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Phone size={11} /> {phone}
              </span>
            )}
          </div>
        )}
      </div>
    </TiltCard>
  );
}
