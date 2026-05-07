import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "未実行","見込み（高）","見込み（中）","見込み（低）",
  "申し込みフォーム返送待ち","NG","不参加","契約",
]);

function parseDate(v: string | undefined): Date | null {
  if (!v?.trim()) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

interface RowResult { row: number; status: "ok" | "error"; message?: string; customerName?: string; }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: 管理者のみインポート可能です" }, { status: 403 });
  }

  await initSchema();
  const db = sql();

  let rows: Record<string, string>[];
  try {
    rows = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: RowResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // CSVは2行目からデータ

    const customerName = r["顧客名"]?.trim();
    if (!customerName) {
      results.push({ row: rowNum, status: "error", message: "顧客名が空です" });
      errorCount++;
      continue;
    }

    const rawStatus = r["ステータス"]?.trim();
    const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "未実行";

    const isContract = status === "契約";
    const contractedAt = isContract
      ? (parseDate(r["契約日"]) ?? parseDate(r["商談日時"]) ?? new Date())
      : parseDate(r["契約日"]);

    try {
      await db`
        INSERT INTO cases (
          customer_name, contact_person, email_address, phone,
          status, next_meeting, sales_person, appointer, notes,
          initial_fee, monthly_fee, contract_return_date, first_deduction_date,
          contracted_at, amount
        ) VALUES (
          ${customerName},
          ${r["担当者名"]?.trim() || null},
          ${r["メールアドレス"]?.trim() || null},
          ${r["電話番号"]?.trim() || null},
          ${status},
          ${parseDate(r["商談日時"])},
          ${r["営業担当者名"]?.trim() || null},
          ${r["アポインター名"]?.trim() || null},
          ${r["会話メモ"]?.trim() || null},
          ${parseNum(r["初期費用"])},
          ${parseNum(r["月額費用"])},
          ${parseDate(r["契約書返送日"])},
          ${parseDate(r["初回引落日"])},
          ${contractedAt},
          ${parseNum(r["売上金額"])}
        )
      `;
      results.push({ row: rowNum, status: "ok", customerName });
      successCount++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ row: rowNum, status: "error", message: msg, customerName });
      errorCount++;
    }
  }

  return NextResponse.json({ successCount, errorCount, results });
}
