"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function MobileBottomNav() {
  const params = useParams<{ shortId: string }>();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom-nav md:hidden">
      <div className="flex h-14 items-center justify-around">
        {bottomNavItems.map((item) => {
          const fullHref = `/${params.shortId}${item.href}`;
          const isActive =
            pathname === fullHref || pathname.startsWith(fullHref + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
