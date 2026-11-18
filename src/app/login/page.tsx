import { login } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold text-indigo-700">📒 Mi Agenda</h1>
        {error && <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-700">Email o contraseña incorrectos</p>}
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" name="email" required autoComplete="email" />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input className="input" type="password" name="password" required autoComplete="current-password" />
        </label>
        <SubmitButton className="btn-primary w-full">Entrar</SubmitButton>
      </form>
    </main>
  );
}
