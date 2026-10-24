import type { ReactNode } from "react";

/** Wraps a portal screen in the Bonisa brief colours and a consistent page width. */
export function PortalShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="portal-theme flex-1 flex flex-col">
      <div className={`container ${narrow ? "max-w-3xl" : "max-w-6xl"} px-4 py-8 sm:py-12 space-y-8`}>{children}</div>
    </div>
  );
}
