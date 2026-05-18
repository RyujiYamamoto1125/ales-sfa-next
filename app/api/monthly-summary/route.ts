import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();

  const [leadsRows, apoRows, meetingRows, contractRows, adRows] = await Promise.all([
    db`
      SELECT TO_CHAR(date, 'YYYY/MM') as month, SUM(lead_count)::int as leads
      FROM leads
      GROUP BY month ORDER BY month
    `,
    db`
      SELECT TO_CHAR(next_meeting, 'YYYY/MM') as month, COUNT(*)::int as apo
      FROM cases
      WHERE next_meeting IS NOT NULL
      GROUP BY month ORDER BY month
    `,
    db`
      SELECT TO_CHAR(next_meeting, 'YYYY/MM') as month, COUNT(*)::int as meetings
      FROM cases
      WHERE next_meeting IS NOT NULL AND status != '不参加'
      GROUP BY month ORDER BY month
    `,
    db`
      SELECT TO_CHAR(contracted_at, 'YYYY/MM') as month, COUNT(*)::int as contracts
      FROM cases
      WHERE contracted_at IS NOT NULL
      GROUP BY month ORDER BY month
    `,
    db`
      SELECT TO_CHAR(date, 'YYYY/MM') as month, SUM(ad_spend)::bigint as ad_spend
      FROM ad_metrics
      GROUP BY month ORDER BY month
    `,
  ]);

  const allMonths = new Set([
    ...leadsRows.map((r) => r.month as string),
    ...apoRows.map((r) => r.month as string),
    ...meetingRows.map((r) => r.month as string),
    ...contractRows.map((r) => r.month as string),
    ...adRows.map((r) => r.month as string),
  ]);

  const result = [...allMonths].sort().reverse().map((month) => ({
    month,
    leads:     Number(leadsRows.find((r) => r.month === month)?.leads ?? 0),
    apo:       Number(apoRows.find((r) => r.month === month)?.apo ?? 0),
    meetings:  Number(meetingRows.find((r) => r.month === month)?.meetings ?? 0),
    contracts: Number(contractRows.find((r) => r.month === month)?.contracts ?? 0),
    adSpend:   Number(adRows.find((r) => r.month === month)?.ad_spend ?? 0),
  }));

  return NextResponse.json(result);
}
