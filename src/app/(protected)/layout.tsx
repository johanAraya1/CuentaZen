import { AppNav } from "@/components/app-nav";
import { requirePageAccess } from "@/lib/auth";
import { ensureOpenMonth } from "@/lib/budget-service";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePageAccess();
  await ensureOpenMonth();

  return (
    <div className="app-shell">
      <AppNav />
      <main className="main-area">{children}</main>
    </div>
  );
}
