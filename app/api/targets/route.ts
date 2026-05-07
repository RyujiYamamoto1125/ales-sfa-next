import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { connectDB } from "@/lib/mongodb";
import Target from "@/models/Target";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (year && month) {
    const target = await Target.findOne({ year: Number(year), month: Number(month) });
    return NextResponse.json({ targetCount: target?.targetCount ?? 0 });
  }

  const targets = await Target.find().sort({ year: 1, month: 1 }).lean();
  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { year, month, targetCount } = await req.json();

  const updated = await Target.findOneAndUpdate(
    { year, month },
    { targetCount },
    { upsert: true, new: true }
  );

  return NextResponse.json(updated);
}
