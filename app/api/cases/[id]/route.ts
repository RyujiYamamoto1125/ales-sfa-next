import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { connectDB } from "@/lib/mongodb";
import Case from "@/models/Case";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();

  const existing = await Case.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {
    customerName: body.customerName,
    status: body.status,
    salesPerson: body.salesPerson,
    appointer: body.appointer,
    notes: body.notes,
  };

  if (body.nextMeeting) update.nextMeeting = new Date(body.nextMeeting);
  if (body.status === "契約" && !existing.contractedAt) {
    update.contractedAt = new Date();
  }

  const updated = await Case.findByIdAndUpdate(id, update, { new: true });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  await Case.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
