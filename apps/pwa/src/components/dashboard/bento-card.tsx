import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card } from "@stageholder/ui";

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
      className={cn("animate-[bento-enter_0.4s_ease-out_both]", className)}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {(title || action) && (
        <Card.Header>
          {title && (
            <Card.Title className="text-sm">
              {href ? (
                <Link to={href} className="hover:underline">
                  {title}
                </Link>
              ) : (
                title
              )}
            </Card.Title>
          )}
          {action && <Card.Action>{action}</Card.Action>}
        </Card.Header>
      )}
      <Card.Body>{children}</Card.Body>
    </Card>
  );
}
