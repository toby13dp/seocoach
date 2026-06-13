"use client";

import * as React from "react";

interface ReducedMotionContextValue {
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
}

const ReducedMotionContext = React.createContext<ReducedMotionContextValue>({
  prefersReducedMotion: false,
});

/**
 * useReducedMotion — Hook to access reduced motion preference.
 * Returns `{ prefersReducedMotion: boolean }`.
 */
export function useReducedMotion(): ReducedMotionContextValue {
  return React.useContext(ReducedMotionContext);
}

interface ReducedMotionProviderProps {
  children: React.ReactNode;
}

/**
 * ReducedMotionProvider — Detects `prefers-reduced-motion: reduce` media query.
 * Adds `reduced-motion` CSS class to document.body when preference is set.
 * Meets WCAG 2.1 AA requirement (A11Y-002).
 */
export function ReducedMotionProvider({
  children,
}: ReducedMotionProviderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      if (event.matches) {
        document.body.classList.add("reduced-motion");
      } else {
        document.body.classList.remove("reduced-motion");
      }
    };

    // Set initial class
    if (mediaQuery.matches) {
      document.body.classList.add("reduced-motion");
    }

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const value = React.useMemo(
    () => ({ prefersReducedMotion }),
    [prefersReducedMotion]
  );

  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

/**
 * ReducedMotionScript — Inline script to prevent flash of motion.
 * Should be placed in the document <head> to apply before React hydration.
 * Detects prefers-reduced-motion and adds the `reduced-motion` class immediately.
 */
export function ReducedMotionScript() {
  const scriptContent = `
    (function() {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          document.body.classList.add('reduced-motion');
        }
      } catch(e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: scriptContent }} />;
}
