import { isDesktop } from "./index";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

type LogFn = (message: string) => void;

interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  /** Open the log directory in the system file manager (desktop only) */
  openLogDir: () => Promise<void>;
  /** Initialize global error handlers that forward to the logger */
  initGlobalErrorCapture: () => void;
}

let tauriLog: typeof import("@tauri-apps/plugin-log") | null = null;
let initialized = false;

async function ensureTauriLog() {
  if (!isDesktop()) return null;
  if (tauriLog) return tauriLog;
  try {
    tauriLog = await import("@tauri-apps/plugin-log");
    return tauriLog;
  } catch {
    return null;
  }
}

function createLogFn(level: LogLevel): LogFn {
  const consoleMethods: Record<LogLevel, (...args: unknown[]) => void> = {
    trace: console.debug,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  return (message: string) => {
    // Always log to console
    consoleMethods[level](`[${level.toUpperCase()}]`, message);

    // On desktop, also forward to Tauri log plugin (fire-and-forget)
    if (isDesktop()) {
      ensureTauriLog().then((mod) => {
        if (!mod) return;
        const fn = mod[level];
        fn(message).catch(() => {});
      });
    }
  };
}

function initGlobalErrorCapture() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("error", (event) => {
    const location = event.filename
      ? ` at ${event.filename}:${event.lineno}:${event.colno}`
      : "";
    logger.error(`[Uncaught] ${event.message}${location}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event.reason instanceof Error
        ? `${event.reason.message}\n${event.reason.stack}`
        : String(event.reason);
    logger.error(`[UnhandledRejection] ${reason}`);
  });

  logger.info("Global error capture initialized");
}

async function openLogDir() {
  if (!isDesktop()) return;
  try {
    const { appLogDir } = await import("@tauri-apps/api/path");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    const logDir = await appLogDir();
    await openPath(logDir);
  } catch {
    // Silently fail if plugins not available
  }
}

export const logger: Logger = {
  trace: createLogFn("trace"),
  debug: createLogFn("debug"),
  info: createLogFn("info"),
  warn: createLogFn("warn"),
  error: createLogFn("error"),
  openLogDir,
  initGlobalErrorCapture,
};
