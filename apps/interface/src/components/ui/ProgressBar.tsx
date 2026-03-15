"use client";

import React from "react";

interface ProgressBarProps {
  progress: number; // 0–100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="w-full bg-gray-800 rounded-full h-2">
      <div
        className="bg-indigo-500 h-2 rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
