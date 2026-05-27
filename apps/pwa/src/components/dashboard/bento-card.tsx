import { Link } from "@tanstack/react-router";
import { Card, Text } from "@stageholder/ui";

interface BentoCardProps {
  children: React.ReactNode;
  title?: string;
  href?: string;
  action?: React.ReactNode;
  index?: number;
  className?: string;
}

export function BentoCard({
  children,
  title,
  href,
  action,
  index = 0,
  className,
}: BentoCardProps) {
  return (
    <Card
      // Tamagui v2 native staggered mount fade (was the `bento-enter` keyframe:
      // opacity 0 + translateY(12px) → 1/0), delayed per grid index.
      enterStyle={{ opacity: 0, y: 12 }}
      transition={["medium", { delay: index * 75 }]}
      // allowlist: CSS grid-placement classes (col-span-*) forwarded from the
      // dashboard route — pure CSS-grid placement, no kit token equivalent.
      className={className}
    >
      {title || action ? (
        <Card.Header>
          {/* Ternary (not `title && …`) so an empty-string title can't render
              a stray "" text node inside the header. */}
          {title ? (
            <Card.Title fontSize="$3">
              {href ? (
                <Link to={href} style={{ textDecoration: "none" }}>
                  <Text
                    fontSize="$3"
                    fontWeight="600"
                    color="$cardForeground"
                    hoverStyle={{ textDecorationLine: "underline" }}
                  >
                    {title}
                  </Text>
                </Link>
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
