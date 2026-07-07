/**
 * Learning Journey content. Modules are AUTHORED in the Admin Console and
 * persisted by the API; the bot fetches them and caches in memory so the quiz
 * flow stays synchronous. Falls back to the shared demo modules when the API
 * has none (or is unreachable), so the bot always has content.
 */
import { demoModuleContent, type ModuleContent } from "@cpn-engage/shared";
import { config } from "./config.ts";

let MODULES: ModuleContent[] = demoModuleContent;

/** Refresh the module cache from the API (called on startup + periodically). */
export async function refreshModules(): Promise<void> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/learning/modules`);
    if (!res.ok) return;
    const data = (await res.json()) as ModuleContent[];
    if (Array.isArray(data) && data.length > 0) {
      MODULES = data.filter((m) => m.isLive !== false);
      console.log(`[content] loaded ${MODULES.length} modules from API`);
    }
  } catch {
    /* keep the current cache (demo fallback) */
  }
}

export function allModules(): ModuleContent[] {
  return MODULES;
}

export function getModule(id: string): ModuleContent | undefined {
  return MODULES.find((m) => m.id === id);
}

export function firstAssignedModule(): ModuleContent {
  return MODULES[0]!;
}

export function nextModuleAfter(id: string): ModuleContent | null {
  const i = MODULES.findIndex((m) => m.id === id);
  return i >= 0 && i + 1 < MODULES.length ? MODULES[i + 1]! : null;
}
