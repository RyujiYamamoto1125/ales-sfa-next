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

  const role = session.user.role;
  if (role === "sales") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const rowNum = i + 2;

    const customerName = (r["会社名"] ?? r["顧客名"])?.trim();
    if (!customerName) {
      results.push({ row: rowNum, status: "error", message: "会社名が空です" });
      errorCount++;
      continue;
    }

    try {
      if (role === "appointer") {
        // アポインターは固定フィールドのみ登録（status = 未実行）
        await db`
          INSERT INTO cases (
            lead_source, document_request_date,
            customer_name, position, furigana,
            email_address, phone, notes,
            appointer, next_meeting,
            status
          ) VALUES (
            ${r["流入経路"]?.trim() || null},
            ${parseDate(r["資料請求日"])},
            ${customerName},
            ${r["役職"]?.trim() || null},
            ${r["ふりがな"]?.trim() || null},
            ${r["メールアドレス"]?.trim() || null},
            ${r["電話番号"]?.trim() || null},
            ${r["会話メモ"]?.trim() || null},
            ${r["アポ取得者"]?.trim() || null},
            ${parseDate(r["初回商談日時"])},
            '未実行'
          )
        `;
      } else {
        // 管理者は全フィールド
        const rawStatus = r["ステータス"]?.trim();
        const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "未実行";
        const isContract = status === "契約";
        const contractedAt = isContract
          ? (parseDate(r["契約日"]) ?? parseDate(r["初回商談日時"]) ?? new Date())
          : parseDate(r["契約日"]);

        await db`
          INSERT INTO cases (
            lead_source, document_request_date,
            customer_name, position, furigana, contact_person,
            email_address, phone, notes,
            appointer, next_meeting,
            status, sales_person,
            initial_fee, monthly_fee, contract_return_date, first_deduction_date,
            contracted_at, amount
          ) VALUES (
            ${r["流入経路"]?.trim() || null},
            ${parseDate(r["資料請求日"])},
            ${customerName},
            ${r["役職"]?.trim() || null},
            ${r["ふりがな"]?.trim() || null},
            ${r["担当者名"]?.trim() || null},
            ${r["メールアドレス"]?.trim() || null},
            ${r["電話番号"]?.trim() || null},
            ${r["会話メモ"]?.trim() || null},
            ${r["アポ取得者"]?.trim() || null},
            ${parseDate(r["初回商談日時"])},
            ${status},
            ${r["営業担当者名"]?.trim() || null},
            ${parseNum(r["初期費用"])},
            ${parseNum(r["月額費用"])},
            ${parseDate(r["契約書返送日"])},
            ${parseDate(r["初回引落日"])},
            ${contractedAt},
            ${parseNum(r["売上金額"])}
          )
        `;
      }

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
