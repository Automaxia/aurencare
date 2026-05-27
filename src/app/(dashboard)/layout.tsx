import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session.user.name, email: session.user.email }} />
      <main className="flex-1 px-10 py-9 overflow-y-auto">{children}</main>
    </div>
  );
}
