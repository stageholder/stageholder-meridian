"use client";

import { BookOpen } from "lucide-react";

export default function JournalPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <BookOpen className="mx-auto size-12 text-muted-foreground/30" />
        <p className="mt-4 text-sm text-muted-foreground">
          Select a journal entry to read, or create a new one.
        </p>
      </div>
    </div>
  );
}
