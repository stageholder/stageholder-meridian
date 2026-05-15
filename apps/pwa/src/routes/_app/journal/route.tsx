import {
  Outlet,
  createFileRoute,
  useLocation,
  useParams,
} from "@tanstack/react-router";
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { EncryptionGate } from "@/components/encryption/encryption-gate";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export const Route = createFileRoute("/_app/journal")({
  component: JournalLayout,
});

function JournalLayout() {
  const { pathname } = useLocation();
  // Read `id` non-strictly — only the $id child route provides it.
  const params = useParams({ strict: false }) as { id?: string };
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isChildRoute = pathname !== "/journal" && pathname !== "/journal/";

  const activeId = params.id;

  return (
    <EncryptionGate>
      <div className="flex h-full">
        {/* Left column: sidebar */}
        {(isDesktop || !isChildRoute) && (
          <div className="w-full shrink-0 border-r border-border md:w-80 lg:w-96">
            <JournalSidebar activeId={activeId} />
          </div>
        )}

        {/* Right column: children */}
        {(isDesktop || isChildRoute) && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        )}
      </div>
    </EncryptionGate>
  );
}
