import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { BottomNav } from "./BottomNav";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Phase 1 shell — cream-50 background, safe-area aware, always renders BottomNav.
 * The desktop sidebar will be integrated in Phase 2 when we replace App.tsx's shell.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-cream-50", className)}>
      {/* Main scrollable content */}
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 w-full max-w-[1200px] mx-auto min-w-0 overflow-x-hidden">
          {children}
        </main>

        {/* Spacer so content isn't hidden behind mobile nav */}
        <div className="mobile-tab-spacer lg:hidden" />
      </div>

      {/* Always-visible bottom nav */}
      <BottomNav />
    </div>
  );
}
