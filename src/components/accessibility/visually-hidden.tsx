"use client";

import * as React from "react";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The content to hide visually but keep accessible to screen readers */
  children?: React.ReactNode;
}

/**
 * VisuallyHidden — Hides content visually but keeps it accessible to screen readers.
 * Uses the sr-only pattern as a reusable component.
 * Meets WCAG 2.1 AA requirement (A11Y-002).
 */
export function VisuallyHidden({
  children,
  className,
  ...props
}: VisuallyHiddenProps) {
  return (
    <div
      className={["sr-only", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
