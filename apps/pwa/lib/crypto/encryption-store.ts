import { create } from "zustand";
import {
  generateSalt,
  deriveMasterKey,
  deriveRecoveryMasterKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  saltToBase64,
  saltFromBase64,
  generateRecoveryCodes,
} from "@repo/crypto";
import { db } from "@repo/offline/db";
import apiClient from "@/lib/api-client";

export interface EncryptionState {
  dek: CryptoKey | null;
  isUnlocked: boolean;
  isSetup: boolean;
  isLoading: boolean;
  wrappedDek: string | null;
  salt: string | null;
  userSub: string | null;

  init: (userSub: string) => void;
  checkStatus: () => Promise<void>;
  setupPassphrase: (passphrase: string) => Promise<string[]>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  changePassphrase: (
    oldPassphrase: string,
    newPassphrase: string,
  ) => Promise<void>;
  recoverWithCodes: (
    codes: string[],
    newPassphrase: string,
  ) => Promise<string[]>;
}

export const useEncryptionStore = create<EncryptionState>()((set, get) => ({
  dek: null,
  isUnlocked: false,
  isSetup: false,
  isLoading: false,
  wrappedDek: null,
  salt: null,
  userSub: null,

  init: (userSub: string) => {
    set({ userSub });
  },

  checkStatus: async () => {
    const { userSub } = get();
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/journal-security/keys");
      const { wrappedDek, salt, encryptionEnabled } = res.data;
      set({
        isSetup: encryptionEnabled,
        wrappedDek: wrappedDek ?? null,
        salt: salt ?? null,
      });
      // Cache the wrapped blob so the unlock flow works offline on the
      // next load. We only cache when the server confirms encryption is
      // set up and we have both halves of the material.
      if (encryptionEnabled && wrappedDek && salt && userSub) {
        await db.journalSecurityCache.put({
          userSub,
          passphraseWrappedDek: wrappedDek,
          passphraseSalt: salt,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // Offline fallback — use the cache if present
      if (userSub) {
        const cached = await db.journalSecurityCache.get(userSub);
        if (cached) {
          set({
            isSetup: true,
            wrappedDek: cached.passphraseWrappedDek,
            salt: cached.passphraseSalt,
          });
          return;
        }
      }
      set({ isSetup: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setupPassphrase: async (passphrase: string) => {
    const { userSub } = get();
    if (!userSub) throw new Error("Not authenticated");

    const salt = generateSalt();
    const masterKey = await deriveMasterKey(passphrase, salt);
    const dek = await generateDEK();
    const passphraseWrappedDek = await wrapDEK(dek, masterKey);
    const passphraseSalt = saltToBase64(salt);

    const recoveryCodes = generateRecoveryCodes();
    const recoveryKey = await deriveRecoveryMasterKey(recoveryCodes, userSub);
    const recoveryWrappedDek = await wrapDEK(dek, recoveryKey);

    await apiClient.post("/journal-security/setup", {
      passphraseWrappedDek,
      passphraseSalt,
      recoveryWrappedDek,
      recoveryCodes,
    });

    set({
      dek,
      isUnlocked: true,
      isSetup: true,
      wrappedDek: passphraseWrappedDek,
      salt: passphraseSalt,
    });

    await db.journalSecurityCache.put({
      userSub,
      passphraseWrappedDek,
      passphraseSalt,
      updatedAt: Date.now(),
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
    const { wrappedDek, salt, userSub } = get();
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

    await apiClient.put("/journal-security/passphrase", {
      passphraseWrappedDek: newWrappedDek,
      passphraseSalt: newSaltStr,
    });

    set({
      dek,
      wrappedDek: newWrappedDek,
      salt: newSaltStr,
    });

    if (userSub) {
      await db.journalSecurityCache.put({
        userSub,
        passphraseWrappedDek: newWrappedDek,
        passphraseSalt: newSaltStr,
        updatedAt: Date.now(),
      });
    }
  },

  recoverWithCodes: async (
    codes: string[],
    newPassphrase: string,
  ): Promise<string[]> => {
    const { userSub } = get();
    if (!userSub) throw new Error("Not authenticated");

    const res = await apiClient.post("/journal-security/recover", { codes });
    const { recoveryWrappedDek } = res.data as { recoveryWrappedDek: string };

    const recoveryKey = await deriveRecoveryMasterKey(codes, userSub);
    const dek = await unwrapDEK(recoveryWrappedDek, recoveryKey);

    const newSalt = generateSalt();
    const newMasterKey = await deriveMasterKey(newPassphrase, newSalt);
    const newPassphraseWrappedDek = await wrapDEK(dek, newMasterKey);

    const newCodes = generateRecoveryCodes();
    const newRecoveryKey = await deriveRecoveryMasterKey(newCodes, userSub);
    const newRecoveryWrappedDek = await wrapDEK(dek, newRecoveryKey);

    await apiClient.post("/journal-security/recover/finalize", {
      passphraseWrappedDek: newPassphraseWrappedDek,
      passphraseSalt: saltToBase64(newSalt),
      recoveryWrappedDek: newRecoveryWrappedDek,
      recoveryCodes: newCodes,
    });

    set({
      dek,
      isUnlocked: true,
      isSetup: true,
      wrappedDek: newPassphraseWrappedDek,
      salt: saltToBase64(newSalt),
    });

    await db.journalSecurityCache.put({
      userSub,
      passphraseWrappedDek: newPassphraseWrappedDek,
      passphraseSalt: saltToBase64(newSalt),
      updatedAt: Date.now(),
    });

    return newCodes;
  },
}));
