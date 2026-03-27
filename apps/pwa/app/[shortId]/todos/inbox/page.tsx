"use client";

import { InboxContent } from "@/components/todos/inbox-content";

export default function InboxPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <InboxContent />
    </div>
  );
}
