"use client";

import * as React from "react";

interface SkipLinkProps {
  /** Target element ID to skip to (default: "main-content") */
  targetId?: string;
  /** Accessible label for the link (default: "Ga naar hoofdinhoud") */
  label?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * SkipLink — A skip-to-content link component for keyboard navigation.
 * Hidden by default, visible on focus. Links to #main-content by default.
 * Meets WCAG 2.1 AA requirement for bypass blocks (A11Y-001).
 */
export function SkipLink({
  targetId = "main-content",
  label = "Ga naar hoofdinhoud",
  className,
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={[
        "skip-link",
        "sr-only focus:not-sr-only",
        "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
        "focus:rounded-md focus:px-4 focus:py-2",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "focus:shadow-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </a>
  );
}
