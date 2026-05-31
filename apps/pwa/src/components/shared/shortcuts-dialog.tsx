import { useEffect, useState } from "react";
import { Dialog, Kbd, Text, XStack, YStack } from "@stageholder/ui";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  return mac;
}

interface ShortcutEntry {
  description: string;
  keys: string[];
  macKeys?: string[];
}

const shortcutGroups: { heading: string; items: ShortcutEntry[] }[] = [
  {
    heading: "General",
    items: [
      {
        description: "Open command palette",
        keys: ["Ctrl", "K"],
        macKeys: ["\u2318", "K"],
      },
      { description: "Show keyboard shortcuts", keys: ["?"] },
    ],
  },
  {
    heading: "Navigation",
    items: [
      { description: "Go to Dashboard", keys: ["G", "D"] },
      { description: "Go to Calendar", keys: ["G", "C"] },
      { description: "Go to Todos", keys: ["G", "T"] },
      { description: "Go to Habits", keys: ["G", "H"] },
      { description: "Go to Journal", keys: ["G", "J"] },
      { description: "Go to Settings", keys: ["G", "S"] },
    ],
  },
  {
    heading: "Actions",
    items: [
      { description: "Quick add todo", keys: ["N"] },
      { description: "Create todo (detail)", keys: ["\u21e7", "N"] },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const isMac = useIsMac();

  return (
    // disableRemoveScroll: the kit's modal scroll-lock sets overflow:hidden +
    // scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock only reserves a phantom gutter
    // and shifts the background when the dialog opens. The full-screen scrim
    // already blocks background interaction, so the lock is redundant.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content maxW={448}>
          <YStack gap="$1">
            <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
            <Dialog.Description>
              Navigate and take actions quickly with these shortcuts.
            </Dialog.Description>
          </YStack>
          <YStack mt="$2" gap="$4">
            {shortcutGroups.map((group) => (
              <YStack key={group.heading}>
                <Text
                  mb="$2"
                  fontSize="$1"
                  fontWeight="500"
                  color="$mutedForeground"
                  textTransform="uppercase"
                  letterSpacing={0.8}
                >
                  {group.heading}
                </Text>
                <YStack gap="$1">
                  {group.items.map((item) => {
                    const keys =
                      isMac && item.macKeys ? item.macKeys : item.keys;
                    return (
                      <XStack
                        key={item.description}
                        items="center"
                        justify="space-between"
                        rounded="$md"
                        px="$2"
                        py="$1.5"
                      >
                        <Text fontSize="$3" color="$color">
                          {item.description}
                        </Text>
                        <XStack items="center" gap="$1">
                          {keys.map((key, i) => (
                            <XStack key={i} items="center" gap="$1">
                              <Kbd
                                minW={20}
                                rounded="$1"
                                borderWidth={1}
                                borderColor="$borderColor"
                                bg="$muted"
                                px="$1.5"
                                py="$0.5"
                                fontFamily="$mono"
                                fontSize={11}
                                fontWeight="500"
                                color="$mutedForeground"
                                text="center"
                              >
                                {key}
                              </Kbd>
                              {i < keys.length - 1 && keys.length > 1 && (
                                <Text
                                  fontSize={9}
                                  color="$mutedForeground"
                                  opacity={0.5}
                                >
                                  {group.heading === "Navigation" ? "→" : "+"}
                                </Text>
                              )}
                            </XStack>
                          ))}
                        </XStack>
                      </XStack>
                    );
                  })}
                </YStack>
              </YStack>
            ))}
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
