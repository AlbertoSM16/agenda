// Plan B: inicia sesión en Garmin desde TU ordenador (si Garmin bloquea el login desde Vercel)
// y muestra los tokens para pegarlos en la agenda (Entrenos → Plan B: pegar tokens).
// Uso: npm run garmin:login   (Node 22.18+ ejecuta TypeScript directamente)
import { createInterface } from "node:readline/promises";
import { login, resumeMfa } from "../src/lib/garmin/sso.ts";

async function ask(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const email = await ask("Email de Garmin: ");
const password = await askHidden("Contraseña de Garmin (no se muestra): ");

try {
  let result = await login(email, password);
  const tokens = result.status === "mfa" ? await resumeMfa(result.state, await ask("Código de verificación (MFA): ")) : result.tokens;
  const blob = Buffer.from(JSON.stringify(tokens)).toString("base64");
  console.log("\n✅ Sesión iniciada. Copia este bloque y pégalo en la agenda (Entrenos → Plan B: pegar tokens):\n");
  console.log(blob);
  console.log("\n⚠️  Este bloque da acceso a tu cuenta de Garmin: no lo compartas ni lo guardes en ningún sitio.\n");
} catch (err) {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exit(1);
}
