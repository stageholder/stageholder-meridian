// Web / non-Android: no hardware back button — nothing to intercept. The
// `.native.ts` sibling (Metro) wires React Native's BackHandler.
export function useAndroidBackClose(
  _open: boolean,
  _onClose: () => void,
): void {}
