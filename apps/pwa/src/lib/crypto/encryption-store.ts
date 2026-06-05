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
import apiClient from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

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
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/journal-security/keys");
      const { wrappedDek, salt, encryptionEnabled } = res.data;
      set({
        isSetup: encryptionEnabled,
        wrappedDek: wrappedDek ?? null,
        salt: salt ?? null,
      });
      // (Previously the wrapped blob was also cached to Dexie so the
      // unlock flow worked offline on the next load. Offline storage is
      // gone — keys come from the server on every load now.)
    } catch {
      // The /journal-security/keys call failed (offline or 5xx). Without
      // the old Dexie fallback we can't know the encryption state, so
      // treat it as not-set-up; the next successful checkStatus corrects it.
      //
      // Reset dek/isUnlocked too — not just isSetup. set() is a shallow merge,
      // so a transient failure AFTER the user unlocked would otherwise leave a
      // null-but-stale combination: isSetup=false makes isLocked compute false
      // in the journal hooks (so queries fire), but if a stale dek lingered the
      // queryFn's `if (dek)` branch could still mishandle the boundary. Forcing
      // the fully-locked state keeps every consumer on the safe path until the
      // next successful checkStatus.
      set({ isSetup: false, dek: null, isUnlocked: false });
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
    // Drop the DECRYPTED journal data from the query cache. Without the DEK
    // we can no longer read it, and leaving plaintext journals cached for a
    // now-locked session would defeat at-rest locking. Previously the offline
    // layer wiped Dexie journal rows on lock; the react-query cache is the
    // equivalent surface now. `removeQueries` (not invalidate) so the data is
    // gone immediately rather than refetched-and-re-cached while still locked.
    // `queryClient` is the live module-level singleton the app's
    // `<QueryClientProvider>` renders, so this eviction hits the same cache the
    // UI reads (the old `getQueryClient()` indirection always returned null
    // because its provider was never mounted, making this a silent no-op).
    queryClient.removeQueries({ queryKey: ["journals"] });
    queryClient.removeQueries({ queryKey: ["journal"] });
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

    await apiClient.put("/journal-security/passphrase", {
      passphraseWrappedDek: newWrappedDek,
      passphraseSalt: newSaltStr,
    });

    set({
      dek,
      wrappedDek: newWrappedDek,
      salt: newSaltStr,
    });
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

    return newCodes;
  },
}));
