import { Suspense } from "react";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { AuthFormWrapper } from "@/components/auth/auth-form-wrapper";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <AuthShowcase />
      <AuthFormWrapper>
        <Suspense>{children}</Suspense>
      </AuthFormWrapper>
    </div>
  );
}
