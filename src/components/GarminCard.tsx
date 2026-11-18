import {
  garminCancelMfa, garminDisconnect, garminLogin, garminPasteTokens, garminSyncNow, garminVerifyMfa,
} from "@/lib/actions-entrenos";
import SubmitButton from "./SubmitButton";
import AutoSync from "./AutoSync";

export type GarminStatus = {
  configured: boolean;
  connected: boolean;
  pendingMfa: boolean;
  displayName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

const STALE_MS = 60 * 60 * 1000;

export default function GarminCard({ status }: { status: GarminStatus }) {
  if (!status.configured) {
    return (
      <div className="card text-sm text-slate-300">
        ⌚ <b>Garmin:</b> falta la variable <code>GARMIN_TOKEN_KEY</code> en el servidor (ver README → “Conectar Garmin”).
      </div>
    );
  }

  if (status.connected) {
    const stale = !status.lastSyncAt || Date.now() - new Date(status.lastSyncAt).getTime() > STALE_MS;
    return (
      <div className="card flex flex-wrap items-center gap-3 py-3">
        <div className="text-sm">
          ⌚ <b>Garmin conectado</b>{status.displayName ? ` · ${status.displayName}` : ""}
          <p className="text-xs text-slate-400">
            {status.lastSyncAt
              ? `Última sincronización: ${new Date(status.lastSyncAt).toLocaleString("es-ES", { timeZone: process.env.NEXT_PUBLIC_TZ || "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}`
              : "Aún no se ha sincronizado"}
            {status.lastError && <span className="text-rose-400"> · Último error: {status.lastError}</span>}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {stale && <AutoSync />}
          <form action={garminSyncNow}>
            <SubmitButton className="btn btn-sm">🔄 Sincronizar ahora</SubmitButton>
          </form>
          <form action={garminDisconnect}>
            <SubmitButton className="btn btn-sm text-rose-400" confirmText="¿Desconectar Garmin? Los entrenos ya importados se mantienen.">
              Desconectar
            </SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  if (status.pendingMfa) {
    return (
      <form action={garminVerifyMfa} className="card flex flex-col gap-3">
        <h2 className="h2">⌚ Código de verificación de Garmin</h2>
        <p className="text-sm text-slate-300">Garmin te ha enviado un código (email o app). Introdúcelo para terminar de conectar.</p>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-40" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus placeholder="123456" />
          <SubmitButton>Verificar</SubmitButton>
          <button formAction={garminCancelMfa} formNoValidate className="btn">Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <div className="card space-y-3">
      <h2 className="h2">⌚ Conectar con Garmin Connect</h2>
      <p className="text-xs text-slate-400">
        Se usa la API no oficial de Garmin. Tu contraseña solo se usa una vez para obtener un acceso (token) que se guarda
        cifrado; la contraseña no se guarda.
      </p>
      <form action={garminLogin} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" type="email" name="email" required placeholder="Email de Garmin" autoComplete="username" />
        <input className="input" type="password" name="password" required placeholder="Contraseña de Garmin" autoComplete="current-password" />
        <SubmitButton>Conectar</SubmitButton>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-indigo-400">¿Garmin bloquea el login desde el servidor? Plan B: pegar tokens</summary>
        <p className="mt-2 text-xs text-slate-300">
          En tu ordenador, dentro de la carpeta del proyecto, ejecuta <code>npm run garmin:login</code>, inicia sesión y pega aquí el
          bloque de texto que te muestre.
        </p>
        <form action={garminPasteTokens} className="mt-2 flex flex-col gap-2">
          <textarea className="input font-mono text-xs" name="tokens" rows={3} required placeholder="eyJvYXV0aDEiOnsi…" />
          <SubmitButton className="btn btn-sm">Guardar tokens</SubmitButton>
        </form>
      </details>
    </div>
  );
}
