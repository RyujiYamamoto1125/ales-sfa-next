import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  await connectDB();

  const existing = await User.findOne({ email: "admin@demo.local" });
  if (existing) {
    return NextResponse.json({ message: "Already seeded" });
  }

  const hashed = await bcrypt.hash("demo1234", 12);
  await User.create({
    email: "admin@demo.local",
    password: hashed,
    name: "管理者",
    role: "admin",
  });

  return NextResponse.json({ message: "Seeded successfully" });
}
