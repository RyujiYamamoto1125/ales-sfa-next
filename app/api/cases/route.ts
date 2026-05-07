import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { connectDB } from "@/lib/mongodb";
import Case from "@/models/Case";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const cases = await Case.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();

  const data: Record<string, unknown> = {
    customerName: body.customerName,
    status: body.status ?? "未実行",
    salesPerson: body.salesPerson,
    appointer: body.appointer,
    notes: body.notes,
  };

  if (body.nextMeeting) data.nextMeeting = new Date(body.nextMeeting);
  if (body.status === "契約") data.contractedAt = new Date();

  const created = await Case.create(data);
  return NextResponse.json(created, { status: 201 });
}
