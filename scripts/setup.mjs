// Creates Lemon's two reader accounts. Run once: npm run setup
// Reads Supabase keys from .env.local (or the environment).
// Non-interactive: READER1="Name|email|password" READER2="Name|email|password" npm run setup
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const admin = createClient(url, secret, { auth: { persistSession: false } });

const COLORS = ["#F5CB2E", "#F28DAA"]; // lemon yellow, rose pink

const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;
async function ask(label, envVal) {
  if (envVal) return envVal;
  if (!rl) throw new Error(`Missing ${label}`);
  return (await rl.question(label)).trim();
}

async function reader(n, preset) {
  const [pName, pEmail, pPass] = (preset ?? "").split("|");
  console.log(`\nReader ${n}`);
  const name = await ask("  Name: ", pName);
  const email = await ask("  Email (used to log in): ", pEmail);
  const password = await ask("  Password (6+ characters): ", pPass);
  return { name, email, password, color: COLORS[n - 1] };
}

const { count } = await admin.from("readers").select("*", { count: "exact", head: true });
if (count >= 2) {
  console.log("Lemon already has its two readers. Nothing to do.");
  process.exit(0);
}

const people = [await reader(1, process.env.READER1), await reader(2, process.env.READER2)];
rl?.close();

for (const p of people) {
  let { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: p.password,
    email_confirm: true,
  });
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers();
    const user = list.users.find((u) => u.email === p.email.toLowerCase());
    if (!user) throw error;
    await admin.auth.admin.updateUserById(user.id, { password: p.password });
    data = { user };
    error = null;
  }
  if (error) throw error;
  const { error: e2 } = await admin
    .from("readers")
    .upsert({ id: data.user.id, name: p.name, color: p.color });
  if (e2) throw e2;
  console.log(`✓ ${p.name} (${p.email})`);
}
console.log("\nAll set 🍋  Both of you can now log in to Lemon.");
