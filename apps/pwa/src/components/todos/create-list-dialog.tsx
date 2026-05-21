import { useState } from "react";
import { useCreateTodoList } from "@/lib/api/todos";
import { toast } from "sonner";
import { Button, Input, Label } from "@stageholder/ui";

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListDialog({
  open,
  onOpenChange,
}: CreateListDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const createList = useCreateTodoList();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createList.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success("List created");
          setName("");
          setColor("#3b82f6");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create list");
        },
      },
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">New List</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="list-name">Name</Label>
            <Input
              id="list-name"
              className="mt-1"
              value={name}
              onChangeText={setName}
              placeholder="My List"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Color
            </label>
            <div className="mt-2 flex gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === opt.value
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: opt.value }}
                  aria-label={opt.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              intent="outline"
              type="button"
              onPress={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createList.isPending}
              loading={createList.isPending}
              loadingText="Creating…"
            >
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
