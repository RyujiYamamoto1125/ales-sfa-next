import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

const USERS = [
  { email: "admin@ales-sfa.local",    password: "admin1234",    name: "管理者",   role: "admin" },
  { email: "sumida@ales-sfa.local",   password: "sumida1234",   name: "隅田",     role: "sales" },
  { email: "katano@ales-sfa.local",   password: "katano1234",   name: "片野",     role: "sales" },
  { email: "araki@ales-sfa.local",    password: "araki1234",    name: "荒木",     role: "appointer" },
];

export async function GET() {
  try {
    await initSchema();
    const db = sql();
    const results: { email: string; status: string }[] = [];

    for (const u of USERS) {
      const existing = await db`SELECT id FROM users WHERE email = ${u.email} LIMIT 1`;
      if (existing.length > 0) {
        results.push({ email: u.email, status: "already exists" });
        continue;
      }
      const hashed = await bcrypt.hash(u.password, 12);
      await db`INSERT INTO users (email, password, name, role) VALUES (${u.email}, ${hashed}, ${u.name}, ${u.role})`;
      results.push({ email: u.email, status: "created" });
    }

    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
