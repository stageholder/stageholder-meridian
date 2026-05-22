import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@stageholder/ui";

export function GoBackButton() {
  const router = useRouter();

  return (
    <Button
      intent="outline"
      icon={<ArrowLeft size={15} />}
      onPress={() => router.history.back()}
    >
      Go back
    </Button>
  );
}
