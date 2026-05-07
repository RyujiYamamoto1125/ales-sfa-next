import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = sql();
  const body = await req.json();
  const nextMeeting = body.nextMeeting ? new Date(body.nextMeeting) : null;

  const existing = await db`SELECT contracted_at FROM cases WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contractedAt = body.status === "契約" && !existing[0].contracted_at ? new Date() : existing[0].contracted_at;

  const rows = await db`
    UPDATE cases SET
      customer_name = ${body.customerName},
      status = ${body.status},
      next_meeting = ${nextMeeting},
      sales_person = ${body.salesPerson ?? null},
      appointer = ${body.appointer ?? null},
      notes = ${body.notes ?? null},
      contracted_at = ${contractedAt},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = sql();
  await db`DELETE FROM cases WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
