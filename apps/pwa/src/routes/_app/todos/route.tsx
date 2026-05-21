import { useState } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { Drawer } from "@stageholder/ui";

export const Route = createFileRoute("/_app/todos")({
  component: TodosLayout,
});

function TodosLayout() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      {isDesktop && (
        <div className="h-full w-64 shrink-0 border-r border-border">
          <TodoListSidebar />
        </div>
      )}

      {/* Mobile sheet sidebar */}
      {!isDesktop && (
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <Drawer.Portal>
            <Drawer.Overlay />
            <Drawer.Content side="left" className="w-64 p-0">
              <Drawer.Title className="sr-only">Todo Lists</Drawer.Title>
              <TodoListSidebar onNavigate={() => setSheetOpen(false)} />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* Mobile sidebar trigger */}
        {!isDesktop && (
          <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ListFilter className="size-4" />
              <span>Lists</span>
            </button>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
