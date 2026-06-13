"use client";

import * as React from "react";

interface FocusTrapProps {
  /** Whether the focus trap is active */
  active: boolean;
  /** The content to trap focus within */
  children: React.ReactNode;
}

/** Selector for focusable elements */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * FocusTrap — Traps focus within a container for modal dialogs.
 * Tab and Shift+Tab cycle within the container.
 * Restores focus to the previously focused element on unmount/deactivation.
 * Meets WCAG 2.1 AA requirement (A11Y-002).
 */
export function FocusTrap({ active, children }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Save the previously focused element when trap becomes active
  React.useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [active]);

  // Restore focus when trap is deactivated or component unmounts
  React.useEffect(() => {
    if (!active && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [active]);

  // Restore focus on unmount
  React.useEffect(() => {
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Auto-focus the first focusable element when trap activates
  React.useEffect(() => {
    if (active && containerRef.current) {
      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (focusableElements.length > 0) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          focusableElements[0].focus();
        });
      }
    }
  }, [active]);

  // Handle Tab and Shift+Tab key events
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!active || event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [active]
  );

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={active ? undefined : undefined}
    >
      {children}
    </div>
  );
}
