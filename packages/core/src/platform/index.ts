export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PlatformConfig {
  apiBaseUrl: string;
  authStrategy: "cookie" | "bearer";
  storage: StorageAdapter;
  navigate?: (path: string) => void;
  onLogout?: () => void;
}

export function detectPlatform(): "web" | "desktop" {
  if (typeof window !== "undefined" && "__TAURI__" in window) {
    return "desktop";
  }
  return "web";
}

export function isDesktop(): boolean {
  return detectPlatform() === "desktop";
}

export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  }
}
