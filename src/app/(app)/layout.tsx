import { Layers, LogOut } from "lucide-react";
import Nav from "@/components/Nav";
import { logout } from "@/lib/actions";
import { addDays, fmtDate, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: { user } }, events, tasks] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("events").select("id", { count: "exact", head: true }).gte("starts_at", today).lt("starts_at", addDays(today, 1)),
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "hecha").lte("due_date", today),
  ]);
  const email = user?.email ?? "";
  const initials = (email.split("@")[0].match(/[a-z0-9]/gi) ?? ["?"]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col justify-between border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4 lg:py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-emerald-400 shadow-lg shadow-indigo-500/20">
                <Layers className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div>
                <p className="text-base font-bold leading-none tracking-tight text-white">Mi Agenda</p>
                <span className="font-mono text-[11px] text-slate-400">Personal Hub</span>
              </div>
            </div>
            <span className="rounded-lg border border-slate-700/60 bg-slate-800/80 px-2.5 py-1 font-mono text-xs capitalize text-slate-400 lg:hidden">
              {fmtDate(today, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <Nav counts={{ events: events.count ?? 0, tasks: tasks.count ?? 0 }} />
        </div>

        <div className="hidden border-t border-slate-800/70 p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-850/90 p-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-indigo-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{email}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Conectado
              </p>
            </div>
            <form action={logout}>
              <button className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-rose-400" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
        <form action={logout} className="mt-10 text-center lg:hidden">
          <button className="text-xs text-slate-500 underline">Cerrar sesión</button>
        </form>
      </main>
    </div>
  );
}
