"use client";

import { useParams, usePathname } from "next/navigation";
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { EncryptionGate } from "@/components/encryption/encryption-gate";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isChildRoute =
    pathname !== "/app/journal" && pathname !== "/app/journal/";

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
          <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        )}
      </div>
    </EncryptionGate>
  );
}
