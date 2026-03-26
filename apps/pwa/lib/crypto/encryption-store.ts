import { create } from "zustand";
import {
  generateSalt,
  deriveMasterKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  saltToBase64,
  saltFromBase64,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from "@repo/crypto";
import apiClient from "@/lib/api-client";

export interface EncryptionState {
  dek: CryptoKey | null;
  isUnlocked: boolean;
  isSetup: boolean;
  isLoading: boolean;
  wrappedDek: string | null;
  salt: string | null;

  checkStatus: () => Promise<void>;
  setupPassphrase: (passphrase: string) => Promise<string[]>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  changePassphrase: (
    oldPassphrase: string,
    newPassphrase: string,
  ) => Promise<void>;
}

export const useEncryptionStore = create<EncryptionState>()((set, get) => ({
  dek: null,
  isUnlocked: false,
  isSetup: false,
  isLoading: false,
  wrappedDek: null,
  salt: null,

  checkStatus: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/encryption-keys");
      const { wrappedDek, salt, encryptionEnabled } = res.data;
      set({
        isSetup: encryptionEnabled,
        wrappedDek: wrappedDek ?? null,
        salt: salt ?? null,
      });
    } catch {
      // If endpoint fails, assume not set up
      set({ isSetup: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setupPassphrase: async (passphrase: string) => {
    const salt = generateSalt();
    const masterKey = await deriveMasterKey(passphrase, salt);
    const dek = await generateDEK();
    const wrappedDekStr = await wrapDEK(dek, masterKey);
    const saltStr = saltToBase64(salt);
    const recoveryCodes = generateRecoveryCodes();
    const recoveryHash = await hashRecoveryCodes(recoveryCodes);

    await apiClient.post("/encryption-keys/setup", {
      wrappedDek: wrappedDekStr,
      salt: saltStr,
      recoveryCodesHash: recoveryHash,
    });

    set({
      dek,
      isUnlocked: true,
      isSetup: true,
      wrappedDek: wrappedDekStr,
      salt: saltStr,
    });

    return recoveryCodes;
  },

  unlock: async (passphrase: string) => {
    const { wrappedDek, salt } = get();
    if (!wrappedDek || !salt) {
      throw new Error("Encryption keys not loaded. Call checkStatus first.");
    }

    const saltBytes = saltFromBase64(salt);
    const masterKey = await deriveMasterKey(passphrase, saltBytes);
    const dek = await unwrapDEK(wrappedDek, masterKey);

    set({ dek, isUnlocked: true });
  },

  lock: () => {
    set({ dek: null, isUnlocked: false });
  },

  changePassphrase: async (oldPassphrase: string, newPassphrase: string) => {
    const { wrappedDek, salt } = get();
    if (!wrappedDek || !salt) {
      throw new Error("Encryption keys not loaded.");
    }

    // Unwrap with old passphrase
    const oldSaltBytes = saltFromBase64(salt);
    const oldMasterKey = await deriveMasterKey(oldPassphrase, oldSaltBytes);
    const dek = await unwrapDEK(wrappedDek, oldMasterKey);

    // Re-wrap with new passphrase
    const newSalt = generateSalt();
    const newMasterKey = await deriveMasterKey(newPassphrase, newSalt);
    const newWrappedDek = await wrapDEK(dek, newMasterKey);
    const newSaltStr = saltToBase64(newSalt);

    await apiClient.post("/encryption-keys/change-passphrase", {
      wrappedDek: newWrappedDek,
      salt: newSaltStr,
    });

    set({
      dek,
      wrappedDek: newWrappedDek,
      salt: newSaltStr,
    });
  },
}));
