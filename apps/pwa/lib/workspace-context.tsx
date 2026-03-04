"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Workspace } from "@repo/core/types";

interface WorkspaceCtx {
  workspace: Workspace;
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ workspace, children }: { workspace: Workspace; children: ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ workspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
