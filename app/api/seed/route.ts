import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initSchema();

  const db = sql();
  const existing = await db`SELECT id FROM users WHERE email = 'admin@demo.local' LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ message: "Already seeded" });
  }

  const hashed = await bcrypt.hash("demo1234", 12);
  await db`
    INSERT INTO users (email, password, name, role)
    VALUES ('admin@demo.local', ${hashed}, '管理者', 'admin')
  `;

  return NextResponse.json({ message: "Seeded successfully" });
}
