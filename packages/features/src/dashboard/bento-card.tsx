import type { ReactNode } from "react";
import { Card, Text } from "@stageholder/ui";

export interface BentoCardProps {
  children: ReactNode;
  /** Header title text. Optional — header isn't rendered without title/action. */
  title?: string;
  /**
   * Optional press handler for the title. When provided, the title becomes
   * a pressable text (cross-platform: `onPress` + hover underline on web,
   * `Pressable` on RN). When omitted, the title is plain text.
   */
  onTitlePress?: () => void;
  /**
   * Optional right-aligned slot inside the header (e.g. a "View all" link
   * or a status badge). Opaque ReactNode — the consumer (or shared view)
   * is responsible for constructing a cross-platform pressable.
   */
  action?: ReactNode;
  /**
   * Position in the bento grid — used for staggered mount animation delay
   * (each card fades in 75ms after the previous).
   */
  index?: number;
}

/**
 * The Meridian dashboard bento card — frames any cell of the dashboard
 * with the kit `Card` chrome, an optional header (title + action), and a
 * body containing the cell's content. Mount fade is a Tamagui v2 native
 * `enterStyle` + `transition` (no Tailwind/CSS keyframe), so it works the
 * same on web and RN.
 *
 * Pure presentational: navigation lives in the consumer's `onTitlePress`
 * callback / the `action` ReactNode it constructs.
 */
export function BentoCard({
  children,
  title,
  onTitlePress,
  action,
  index = 0,
}: BentoCardProps) {
  return (
    <Card
      // Tamagui v2 native staggered mount fade (was the `bento-enter` keyframe:
      // opacity 0 + translateY(12px) → 1/0), delayed per grid index.
      enterStyle={{ opacity: 0, y: 12 }}
      transition={["medium", { delay: index * 75 }]}
    >
      {title || action ? (
        <Card.Header>
          {title ? (
            <Card.Title fontSize="$3">
              {onTitlePress ? (
                <Text
                  fontSize="$3"
                  fontWeight="600"
                  color="$cardForeground"
                  cursor="pointer"
                  hoverStyle={{ textDecorationLine: "underline" }}
                  onPress={onTitlePress}
                >
                  {title}
                </Text>
              ) : (
                <Text fontSize="$3" fontWeight="600" color="$cardForeground">
                  {title}
                </Text>
              )}
            </Card.Title>
          ) : null}
          {action ? <Card.Action>{action}</Card.Action> : null}
        </Card.Header>
      ) : null}
      <Card.Body>{children}</Card.Body>
    </Card>
  );
}
