"use client";

import { UpcomingContent } from "@/components/todos/upcoming-content";

export default function UpcomingPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <UpcomingContent />
    </div>
  );
}
