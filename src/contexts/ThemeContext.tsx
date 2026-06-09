import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  switchable?: boolean;
}

export function ThemeProvider({ children, defaultTheme = "light" }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme={defaultTheme} enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme };
