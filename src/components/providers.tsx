"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AnnouncerProvider } from "@/components/accessibility/announcer";
import { KeyboardNavigationProvider } from "@/components/accessibility/keyboard-navigation";
import { ReducedMotionProvider } from "@/components/accessibility/reduced-motion";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <KeyboardNavigationProvider>
            <ReducedMotionProvider>
              <AnnouncerProvider>
                {children}
              </AnnouncerProvider>
            </ReducedMotionProvider>
          </KeyboardNavigationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
