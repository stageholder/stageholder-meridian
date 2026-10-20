// Recovery-codes display panel — the "save these codes" step shared by the
// SETUP wizard (first codes) and the RECOVERY flow (fresh codes after a
// reset). Grid of codes, copy-to-clipboard, an explicit "I saved them"
// gate, then Done. Extracted from PassphraseSetupForm so both flows render
// the identical, word-for-word step.

import { useState } from "react";
import { writeToClipboard } from "@repo/core/platform/clipboard";
import { Button, Checkbox, Grid, Text, XStack } from "@stageholder/ui";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Copy } from "@tamagui/lucide-icons-2/icons/Copy";

export interface RecoveryCodesPanelProps {
  codes: string[];
  /** Fired when the user confirms they saved the codes and taps Done. */
  onDone: () => void;
  /** Done button label. Default "Done". */
  doneLabel?: string;
}

export function RecoveryCodesPanel({
  codes,
  onDone,
  doneLabel = "Done",
}: RecoveryCodesPanelProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await writeToClipboard(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Grid
        columns={2}
        gap="$2"
        rounded="$lg"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$muted"
        p="$4"
      >
        {codes.map((code, i) => (
          <Text
            key={i}
            fontFamily="$mono"
            fontSize="$3"
            color="$color"
            text="center"
          >
            {code}
          </Text>
        ))}
      </Grid>
      <Button
        intent="outline"
        width="100%"
        icon={copied ? <Check size={16} /> : <Copy size={16} />}
        onPress={() => void handleCopy()}
      >
        {copied ? "Copied!" : "Copy to Clipboard"}
      </Button>
      {/* A plain row, NOT the kit `Label`: on native Tamagui's Label is a
          Text, so a Checkbox nested in it rendered inline (misaligned) and
          never received the tap (2026-10-20). The caption toggles the box
          itself, which keeps the label-click affordance on every platform. */}
      <XStack items="center" gap="$2">
        <Checkbox
          checked={saved}
          onCheckedChange={(v) => setSaved(v === true)}
          aria-label="I have saved these recovery codes"
        >
          <Checkbox.Indicator>
            <Check size={12} />
          </Checkbox.Indicator>
        </Checkbox>
        <Text
          fontSize="$3"
          fontWeight="500"
          color="$color"
          flex={1}
          onPress={() => setSaved((v) => !v)}
        >
          I have saved these recovery codes
        </Text>
      </XStack>
      <Button onPress={onDone} disabled={!saved} width="100%">
        {doneLabel}
      </Button>
    </>
  );
}
