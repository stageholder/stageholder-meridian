import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";

interface BentoCardProps {
  children: React.ReactNode;
  title?: string;
  href?: string;
  action?: React.ReactNode;
  index?: number;
  className?: string;
}

export function BentoCard({ children, title, href, action, index = 0, className }: BentoCardProps) {
  return (
    <Card
      className={cn(
        "animate-[bento-enter_0.4s_ease-out_both]",
        className,
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {(title || action) && (
        <CardHeader>
          {title && (
            <CardTitle className="text-sm">
              {href ? (
                <Link href={href} className="hover:underline">{title}</Link>
              ) : (
                title
              )}
            </CardTitle>
          )}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
