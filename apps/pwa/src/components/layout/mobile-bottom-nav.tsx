import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
} from "lucide-react";
import { XStack, YStack, Text } from "@stageholder/ui";

const bottomNavItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <XStack
      tag="nav"
      // Tamagui's position type omits web values; cast as the kit's Header does.
      position={"fixed" as never}
      b={0}
      l={0}
      r={0}
      z={40}
      height={56}
      items="center"
      justify="space-around"
      borderTopWidth={1}
      borderColor="$borderColor"
      bg="$background"
      // allowlist: env safe-area inset + frosted-glass effect (no token equivalent)
      className="safe-area-bottom-nav backdrop-blur-sm"
      // responsive: hide at md+ (Tailwind md 768 = Tamagui $md)
      $md={{ display: "none" }}
    >
      {bottomNavItems.map((item) => {
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            style={{ textDecoration: "none" }}
          >
            <YStack
              items="center"
              justify="center"
              gap="$0.5"
              px="$3"
              py="$1.5"
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <Text
                fontSize={10}
                fontWeight="500"
                color={isActive ? "$primary" : "$mutedForeground"}
                transition="quick"
              >
                {item.label}
              </Text>
            </YStack>
          </Link>
        );
      })}
    </XStack>
  );
}
