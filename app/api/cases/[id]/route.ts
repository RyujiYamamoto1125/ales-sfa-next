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
  const role = session.user.role;

  const existing = await db`SELECT * FROM cases WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cur = existing[0];

  // ── アポインター：顧客情報・アポ情報のみ更新 ──
  if (role === "appointer") {
    const rows = await db`
      UPDATE cases SET
        lead_source            = ${body.leadSource    ?? cur.lead_source},
        document_request_date  = ${body.documentRequestDate ? new Date(body.documentRequestDate) : cur.document_request_date},
        customer_name          = ${body.customerName  ?? cur.customer_name},
        position               = ${body.position      ?? cur.position},
        furigana               = ${body.furigana      ?? cur.furigana},
        email_address          = ${body.emailAddress  ?? cur.email_address},
        phone                  = ${body.phone         ?? cur.phone},
        notes                  = ${body.notes         ?? cur.notes},
        appointer              = ${body.appointer     ?? cur.appointer},
        next_meeting           = ${body.nextMeeting ? new Date(body.nextMeeting) : cur.next_meeting},
        updated_at             = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  }

  // ── 営業：アポ結果 ＋ 契約詳細 ──
  if (role === "sales") {
    const isContract = body.status === "契約";
    const contractedAt = isContract && !cur.contracted_at ? new Date() : cur.contracted_at;
    const contractReturnDate = body.contractReturnDate ? new Date(body.contractReturnDate) : cur.contract_return_date;
    const firstDeductionDate = body.firstDeductionDate ? new Date(body.firstDeductionDate) : cur.first_deduction_date;

    const rows = await db`
      UPDATE cases SET
        status               = ${body.status ?? cur.status},
        sales_person         = ${body.salesPerson ?? cur.sales_person},
        contracted_at        = ${contractedAt},
        initial_fee          = ${isContract ? Number(body.initialFee ?? 0) : cur.initial_fee},
        monthly_fee          = ${isContract ? Number(body.monthlyFee ?? 0) : cur.monthly_fee},
        contract_return_date = ${isContract ? contractReturnDate : cur.contract_return_date},
        first_deduction_date = ${isContract ? firstDeductionDate : cur.first_deduction_date},
        updated_at           = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  }

  // ── 管理者：全フィールド更新 ──
  const nextMeeting    = body.nextMeeting ? new Date(body.nextMeeting) : null;
  const contractedAt   = body.status === "契約" && !cur.contracted_at ? new Date() : cur.contracted_at;
  const contractReturn = body.contractReturnDate ? new Date(body.contractReturnDate) : cur.contract_return_date;
  const firstDeduction = body.firstDeductionDate ? new Date(body.firstDeductionDate) : cur.first_deduction_date;

  const rows = await db`
    UPDATE cases SET
      lead_source            = ${body.leadSource           ?? cur.lead_source},
      document_request_date  = ${body.documentRequestDate ? new Date(body.documentRequestDate) : cur.document_request_date},
      customer_name          = ${body.customerName         ?? cur.customer_name},
      position               = ${body.position             ?? cur.position},
      furigana               = ${body.furigana             ?? cur.furigana},
      contact_person         = ${body.contactPerson        ?? cur.contact_person},
      email_address          = ${body.emailAddress         ?? cur.email_address},
      phone                  = ${body.phone                ?? cur.phone},
      notes                  = ${body.notes                ?? null},
      appointer              = ${body.appointer            ?? cur.appointer},
      status                 = ${body.status               ?? cur.status},
      next_meeting           = ${nextMeeting},
      sales_person           = ${body.salesPerson          ?? null},
      contracted_at        = ${contractedAt},
      initial_fee          = ${Number(body.initialFee ?? cur.initial_fee ?? 0)},
      monthly_fee          = ${Number(body.monthlyFee ?? cur.monthly_fee ?? 0)},
      contract_return_date = ${contractReturn},
      first_deduction_date = ${firstDeduction},
      amount               = ${Number(body.amount ?? cur.amount ?? 0)},
      updated_at           = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = sql();
  await db`DELETE FROM cases WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
