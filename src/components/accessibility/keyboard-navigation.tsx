"use client";

import * as React from "react";

interface KeyboardNavigationContextValue {
  /** Whether the user is currently navigating with a keyboard */
  isUsingKeyboard: boolean;
}

const KeyboardNavigationContext = React.createContext<KeyboardNavigationContextValue>({
  isUsingKeyboard: false,
});

/**
 * useKeyboardNavigation — Hook to access keyboard navigation state.
 * Returns `{ isUsingKeyboard: boolean }`.
 */
export function useKeyboardNavigation(): KeyboardNavigationContextValue {
  return React.useContext(KeyboardNavigationContext);
}

interface KeyboardNavigationProviderProps {
  children: React.ReactNode;
}

/**
 * KeyboardNavigationProvider — Detects keyboard vs mouse usage.
 * Adds `data-using-keyboard` or `data-using-mouse` to document.body.
 * Shows focus rings only during keyboard navigation via CSS class `using-keyboard` / `using-mouse`.
 * Meets WCAG 2.1 AA requirement (A11Y-001).
 */
export function KeyboardNavigationProvider({
  children,
}: KeyboardNavigationProviderProps) {
  const [isUsingKeyboard, setIsUsingKeyboard] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only track Tab and navigation keys, not all key presses
      if (event.key === "Tab" || event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        setIsUsingKeyboard(true);
        document.body.setAttribute("data-using-keyboard", "");
        document.body.removeAttribute("data-using-mouse");
        document.body.classList.add("using-keyboard");
        document.body.classList.remove("using-mouse");
      }
    };

    const handleMouseDown = () => {
      setIsUsingKeyboard(false);
      document.body.setAttribute("data-using-mouse", "");
      document.body.removeAttribute("data-using-keyboard");
      document.body.classList.add("using-mouse");
      document.body.classList.remove("using-keyboard");
    };

    // Initialize with mouse mode
    document.body.setAttribute("data-using-mouse", "");
    document.body.classList.add("using-mouse");

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
      document.body.removeAttribute("data-using-keyboard");
      document.body.removeAttribute("data-using-mouse");
      document.body.classList.remove("using-keyboard");
      document.body.classList.remove("using-mouse");
    };
  }, []);

  const value = React.useMemo(() => ({ isUsingKeyboard }), [isUsingKeyboard]);

  return (
    <KeyboardNavigationContext.Provider value={value}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
}
