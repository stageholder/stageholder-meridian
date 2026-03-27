"use client";

import { CompletedContent } from "@/components/todos/completed-content";

export default function CompletedPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <CompletedContent />
    </div>
  );
}
