import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
  Settings,
} from "@tamagui/lucide-icons-2";

/**
 * Icons come from `@tamagui/lucide-icons-2` — the kit's documented icon source
 * (see the kit's `Icon.tsx`). These are `themed()` Tamagui components, so they
 * resolve Tamagui token colors (`$primary`, `$mutedForeground`). Plain
 * `lucide-react` icons set `stroke={color}` directly, so the kit's BottomNav —
 * which auto-tints items by passing a TOKEN to `color` — rendered them with an
 * invalid stroke (invisible). v2 is required for kit components that auto-color.
 */
type NavIcon = typeof Home;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Single-key suffix for the "G → X" sidebar chord (desktop only). */
  shortcutKey: string;
};

/**
 * Single source of truth for primary navigation destinations.
 *
 * Consumed by BOTH the desktop Sidebar rail (`app-shell`) and the mobile
 * floating BottomNav (`mobile-bottom-nav`). Keeping ONE list is what prevents
 * the label/href drift that previously left the bottom nav pointing "Home" at a
 * non-existent `/app` route while the sidebar correctly used `/`.
 */
export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, shortcutKey: "D" },
  { href: "/calendar", label: "Today", icon: CalendarDays, shortcutKey: "C" },
  { href: "/todos", label: "Todos", icon: CheckSquare, shortcutKey: "T" },
  { href: "/habits", label: "Habits", icon: Target, shortcutKey: "H" },
  { href: "/journal", label: "Journal", icon: BookOpen, shortcutKey: "J" },
  { href: "/settings", label: "Settings", icon: Settings, shortcutKey: "S" },
];

/**
 * Destinations surfaced in the mobile floating BottomNav — the four primary
 * day-to-day surfaces, derived from `navItems` (preserving its order) so labels
 * and icons can never diverge. The Dashboard (`/`) is reached via the header
 * logo and Settings via the avatar menu, keeping the capsule within the kit's
 * 3–5 item sweet spot (the `floating` variant's fixed-width items would
 * overflow a phone beyond five).
 */
const BOTTOM_NAV_HREFS = new Set([
  "/calendar",
  "/todos",
  "/habits",
  "/journal",
]);

export const bottomNavItems: NavItem[] = navItems.filter((item) =>
  BOTTOM_NAV_HREFS.has(item.href),
);

/**
 * Longest-prefix active match so nested routes (e.g. `/journal/$id`) keep their
 * parent destination highlighted. The dashboard `/` matches exactly so it
 * doesn't light up on every route.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
