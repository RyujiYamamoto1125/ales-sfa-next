import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  const [cases, salesTargets, leads, globalTarget] = await Promise.all([
    db`SELECT * FROM cases ORDER BY created_at DESC`,
    db`SELECT * FROM sales_targets WHERE year = ${year} AND month = ${month}`,
    db`SELECT * FROM leads WHERE EXTRACT(YEAR FROM date) = ${year} AND EXTRACT(MONTH FROM date) = ${month} ORDER BY date`,
    db`SELECT target_count FROM targets WHERE year = ${year} AND month = ${month} LIMIT 1`,
  ]);

  const now = new Date();

  // ── 今月の案件絞り込み ──
  const thisMonthCases = cases.filter((c) => {
    const d = new Date(c.created_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const contracted = cases.filter((c) => c.status === "契約");
  const thisMonthContracted = contracted.filter((c) => {
    if (!c.contracted_at) return false;
    const d = new Date(c.contracted_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ── KPI ──
  const totalLeads = leads.reduce((s, l) => s + Number(l.lead_count), 0);
  const thisMonthInitialFee  = thisMonthContracted.reduce((s, c) => s + Number(c.initial_fee  ?? 0), 0);
  const thisMonthMonthlyFee  = thisMonthContracted.reduce((s, c) => s + Number(c.monthly_fee  ?? 0), 0);
  const totalInitialFee      = contracted.reduce((s, c) => s + Number(c.initial_fee  ?? 0), 0);
  const totalMonthlyFee      = contracted.reduce((s, c) => s + Number(c.monthly_fee  ?? 0), 0);

  const kpis = {
    totalCases: cases.length,
    thisMonthApo: thisMonthCases.length,
    thisMonthContracts: thisMonthContracted.length,
    totalContracts: contracted.length,
    thisMonthInitialFee,
    thisMonthMonthlyFee,
    totalInitialFee,
    totalMonthlyFee,
    contractRate: thisMonthCases.length > 0
      ? Math.round((thisMonthContracted.length / thisMonthCases.length) * 100)
      : 0,
    apoRate: totalLeads > 0
      ? Math.round((thisMonthCases.length / totalLeads) * 100)
      : null,
    globalTarget: globalTarget[0]?.target_count ?? 0,
    totalLeads,
  };

  // ── ステータス別件数 ──
  const statusCounts = cases.reduce<Record<string, number>>((acc, c) => {
    const s = c.status as string;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  // ── 月別トレンド（過去12ヶ月） ──
  const monthlyMap: Record<string, { contracts: number; amount: number; apo: number }> = {};
  cases.forEach((c) => {
    const d = new Date(c.created_at as string);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) monthlyMap[key] = { contracts: 0, amount: 0, apo: 0 };
    monthlyMap[key].apo++;
    if (c.status === "契約") {
      const cd = c.contracted_at ? new Date(c.contracted_at as string) : null;
      if (cd) {
        const ck = `${cd.getFullYear()}/${String(cd.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[ck]) monthlyMap[ck] = { contracts: 0, amount: 0, apo: 0 };
        monthlyMap[ck].contracts++;
        monthlyMap[ck].amount += Number(c.amount ?? 0);
      }
    }
  });
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => ({ month, ...v }));

  // ── 営業マン別集計 ──
  const spMap: Record<string, {
    apo: number; contracts: number; amount: number;
    targetContracts: number; targetAmount: number;
  }> = {};

  cases.forEach((c) => {
    const sp = (c.sales_person as string)?.trim();
    if (!sp) return;
    if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, amount: 0, targetContracts: 0, targetAmount: 0 };
    const d = new Date(c.created_at as string);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) spMap[sp].apo++;
    if (c.status === "契約" && c.contracted_at) {
      const cd = new Date(c.contracted_at as string);
      if (cd.getFullYear() === year && cd.getMonth() + 1 === month) {
        spMap[sp].contracts++;
        spMap[sp].amount += Number(c.amount ?? 0);
      }
    }
  });

  salesTargets.forEach((t) => {
    const sp = t.sales_person as string;
    if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, amount: 0, targetContracts: 0, targetAmount: 0 };
    spMap[sp].targetContracts = Number(t.target_contracts);
    spMap[sp].targetAmount = Number(t.target_amount);
  });

  const salesPersonStats = Object.entries(spMap).map(([name, v]) => ({
    name,
    ...v,
    contractRate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
    contractAchievement: v.targetContracts > 0 ? Math.round((v.contracts / v.targetContracts) * 100) : null,
    amountAchievement: v.targetAmount > 0 ? Math.round((v.amount / v.targetAmount) * 100) : null,
  })).sort((a, b) => b.contracts - a.contracts);

  // ── ファネル（ステージ別件数 + 平均滞留日数） ──
  const STATUS_ORDER = ["未実行", "見込み（高）", "見込み（中）", "見込み（低）", "申し込みフォーム返送待ち", "NG", "契約"];
  const funnelMap: Record<string, { count: number; totalDays: number }> = {};
  STATUS_ORDER.forEach((s) => { funnelMap[s] = { count: 0, totalDays: 0 }; });

  cases.forEach((c) => {
    const s = c.status as string;
    if (!funnelMap[s]) funnelMap[s] = { count: 0, totalDays: 0 };
    funnelMap[s].count++;
    const updated = new Date(c.updated_at as string);
    const days = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
    funnelMap[s].totalDays += days;
  });

  const funnelData = STATUS_ORDER.map((s) => ({
    status: s,
    count: funnelMap[s].count,
    avgDays: funnelMap[s].count > 0 ? Math.round(funnelMap[s].totalDays / funnelMap[s].count) : 0,
  }));

  // ── 広告：媒体別集計 ──
  const mediumMap: Record<string, number> = {};
  leads.forEach((l) => {
    const m = l.medium as string;
    mediumMap[m] = (mediumMap[m] ?? 0) + Number(l.lead_count);
  });
  const leadsByMedium = Object.entries(mediumMap).map(([medium, count]) => ({ medium, count }));

  // アポ率（媒体別）
  const apoByMedium = leadsByMedium.map((l) => ({
    medium: l.medium,
    leads: l.count,
    apo: thisMonthCases.length,
    apoRate: l.count > 0 ? Math.round((thisMonthCases.length / l.count) * 100) : 0,
  }));

  return NextResponse.json({
    kpis,
    statusCounts,
    monthlyTrend,
    salesPersonStats,
    funnelData,
    leadsByMedium,
    apoByMedium,
    leadsRaw: leads,
  });
}
