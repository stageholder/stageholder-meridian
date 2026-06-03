import { Adapt, Sheet, YStack } from "@stageholder/ui";

/**
 * Drop inside a kit `<Dialog>` to make it open as a bottom **Sheet** on mobile
 * (`max-md`) instead of a centered dialog — Tamagui's native Dialog → Adapt →
 * Sheet (the same mechanism the kit `DropdownMenu` uses for its action sheet).
 *
 * On `max-md` the `<Dialog.Content>`'s children teleport into `Sheet.Frame` via
 * `<Adapt.Contents />`; at md+ the normal `<Dialog.Portal>/<Dialog.Content>`
 * renders unchanged. Place it as a child of the Dialog root, alongside the
 * Portal:
 *
 *   <Dialog open={open} onOpenChange={set}>
 *     <DialogSheetAdapt />
 *     <Dialog.Portal>
 *       <Dialog.Overlay />
 *       <Dialog.Content>…title + form…</Dialog.Content>
 *     </Dialog.Portal>
 *   </Dialog>
 *
 * Sheet settings mirror the kit DropdownMenu's adapted sheet: `snapPointsMode
 * "fit"` sizes to content (the ScrollView scrolls a tall form), `transition
 * "medium"` for the slide, and `disableRemoveScroll` because this PWA scrolls in
 * an inner container so the body-scroll-lock would just shift the background.
 * `Sheet.Frame` supplies the iOS grabber handle.
 */
export function DialogSheetAdapt() {
  return (
    <Adapt when="max-md">
      <Sheet
        modal
        dismissOnSnapToBottom
        snapPointsMode="fit"
        transition="medium"
        disableRemoveScroll
      >
        <Sheet.Overlay />
        {/* Override the kit Sheet.Frame's default p="$5"/gap="$4": NO horizontal
            frame padding, a small top inset (the grabber already supplies top
            space), and only a slim gap below the handle. */}
        <Sheet.Frame px={0} pt="$2" pb="$5" gap="$2">
          <Sheet.ScrollView>
            {/* Horizontal padding lives INSIDE the ScrollView (on this stack),
                NOT on the Frame — otherwise the inputs sit flush with the
                ScrollView's clip edge and their focus ring / borders get cut off
                at the left/right. This stack also owns the gap between the
                teleported title + form (so the Frame padding isn't doubled). */}
            <YStack px="$5" gap="$4">
              <Adapt.Contents />
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </Adapt>
  );
}
