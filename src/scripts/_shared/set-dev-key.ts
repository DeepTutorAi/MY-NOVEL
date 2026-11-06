// Sets the developer shortcut's password: pnpm dev-key:set
// Reads the password from stdin, never from the command line, and writes only a new salt and
// check value to dev-key.ts. Anyone who saved the old token has to enter the new password.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEV_KEY_ITERATIONS, deriveDevToken, devTokenCheck } from "./dev-key";

const FILE = join(process.cwd(), "src/scripts/_shared/dev-key.ts");

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.stdin.isTTY) console.error("Type the new password, then press Enter and Ctrl+Z (Ctrl+D on macOS or Linux).");
  const password = (await readStdin()).trim();
  if (!password) throw new Error("No password given; dev-key.ts was not changed.");

  const salt = randomBytes(16).toString("hex");
  const check = await devTokenCheck(await deriveDevToken(password, salt, DEV_KEY_ITERATIONS));
  const source = readFileSync(FILE, "utf8")
    .replace(/DEV_KEY_SALT = "[^"]*"/, `DEV_KEY_SALT = "${salt}"`)
    .replace(/DEV_KEY_CHECK = "[^"]*"/, `DEV_KEY_CHECK = "${check}"`);
  writeFileSync(FILE, source);
  console.log("dev-key.ts updated with a new salt and check value.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
