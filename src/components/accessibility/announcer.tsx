"use client";

import * as React from "react";

interface AnnouncerContextValue {
  /** Announce a message to screen readers via ARIA live region */
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = React.createContext<AnnouncerContextValue | null>(null);

/**
 * useAnnouncer — Hook to access the announce function from AnnouncerProvider.
 * Returns `{ announce: (message: string, priority?: 'polite' | 'assertive') => void }`.
 * Must be used within an AnnouncerProvider.
 */
export function useAnnouncer(): AnnouncerContextValue {
  const context = React.useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useAnnouncer moet binnen een AnnouncerProvider gebruikt worden");
  }
  return context;
}

interface AnnouncerProviderProps {
  children: React.ReactNode;
}

/** Timeout for clearing announcements (5 seconds) */
const CLEAR_TIMEOUT_MS = 5000;

/**
 * AnnouncerProvider — Wraps the app and provides a live region for screen reader announcements.
 * Renders both polite and assertive aria-live regions.
 * Clears announcements after 5 seconds to avoid stale messages.
 * Meets WCAG 2.1 AA requirement (A11Y-001).
 */
export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = React.useState("");
  const [assertiveMessage, setAssertiveMessage] = React.useState("");
  const politeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = React.useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (priority === "assertive") {
        setAssertiveMessage(message);
        if (assertiveTimerRef.current) {
          clearTimeout(assertiveTimerRef.current);
        }
        assertiveTimerRef.current = setTimeout(() => {
          setAssertiveMessage("");
        }, CLEAR_TIMEOUT_MS);
      } else {
        setPoliteMessage(message);
        if (politeTimerRef.current) {
          clearTimeout(politeTimerRef.current);
        }
        politeTimerRef.current = setTimeout(() => {
          setPoliteMessage("");
        }, CLEAR_TIMEOUT_MS);
      }
    },
    []
  );

  const value = React.useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      {/* Polite live region — announces when idle */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {politeMessage}
      </div>
      {/* Assertive live region — announces immediately */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}
