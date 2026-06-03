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
        <Sheet.Frame>
          <Sheet.ScrollView>
            {/* Padding/gap live on the inner stack so the scrollbar hugs the
                sheet edge and the teleported title + form stay spaced (the
                Dialog.Content gap doesn't come along with the children). */}
            <YStack p="$4" gap="$4">
              <Adapt.Contents />
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </Adapt>
  );
}
