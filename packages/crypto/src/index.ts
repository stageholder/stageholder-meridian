export {
  generateSalt,
  deriveMasterKey,
  deriveRecoveryMasterKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  toBase64,
  fromBase64,
  saltToBase64,
  saltFromBase64,
  type PortableKey,
} from "./keys";

export {
  encryptField,
  decryptField,
  encryptJournal,
  decryptJournal,
  type JournalPlaintext,
  type JournalEncrypted,
} from "./cipher";

export { generateRecoveryCodes, hashRecoveryCodes } from "./recovery";
