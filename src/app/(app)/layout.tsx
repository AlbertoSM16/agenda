import Nav from "@/components/Nav";
import { logout } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
      <aside className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 p-3 backdrop-blur md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 hidden px-3 text-lg font-bold text-indigo-700 md:block">📒 Mi Agenda</div>
        <Nav />
        <div className="mt-6 hidden px-3 md:block">
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <form action={logout}>
            <button className="mt-1 text-xs text-slate-600 underline hover:text-slate-900">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {children}
        <form action={logout} className="mt-10 text-center md:hidden">
          <button className="text-xs text-slate-500 underline">Cerrar sesión</button>
        </form>
      </main>
    </div>
  );
}
