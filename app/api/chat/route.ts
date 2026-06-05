import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が設定されていません。https://console.anthropic.com/settings/keys でAPIキーを取得後、.env.local と Vercel 環境変数に ANTHROPIC_API_KEY=xxx を追加してください。",
      },
      { status: 503 }
    );
  }

  const db = sql();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [cases, targets, salesTargets, leads, adMetrics] = await Promise.all([
    db`SELECT customer_name, status, sales_person, appointer, lead_source, initial_fee, monthly_fee, contracted_at, created_at FROM cases ORDER BY created_at DESC`,
    db`SELECT year, month, target_count FROM targets ORDER BY year DESC, month DESC LIMIT 12`,
    db`SELECT sales_person, year, month, target_contracts, target_amount FROM sales_targets ORDER BY year DESC, month DESC`,
    db`SELECT date, medium, lead_count FROM leads ORDER BY date DESC LIMIT 200`,
    db`SELECT date, medium, ad_spend, dashboard_cv, actual_cv, clicks, impressions FROM ad_metrics ORDER BY date DESC LIMIT 100`,
  ]);

  const totalContracted = cases.filter((c) => c.status === "契約");

  // 今月集計
  const thisMonthCases = cases.filter((c) => {
    const d = new Date(c.created_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const thisMonthContracted = cases.filter((c) => {
    if (c.status !== "契約" || !c.contracted_at) return false;
    const d = new Date(c.contracted_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const thisMonthLeads = leads.filter((l) => {
    const d = new Date(l.date as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const totalLeadsThisMonth = thisMonthLeads.reduce((s, l) => s + Number(l.lead_count), 0);
  const thisMonthInitialFee = thisMonthContracted.reduce((s, c) => s + Number(c.initial_fee ?? 0), 0);
  const thisMonthMonthlyFee = thisMonthContracted.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);
  const totalInitialFee = totalContracted.reduce((s, c) => s + Number(c.initial_fee ?? 0), 0);
  const totalMonthlyFee = totalContracted.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);

  // 今月の目標
  const currentTarget = targets.find(
    (t) => Number(t.year) === year && Number(t.month) === month
  );

  // 広告費集計（今月）
  const thisMonthAd = adMetrics.filter((a) => {
    const d = new Date(a.date as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const totalAdSpend = thisMonthAd.reduce((s, a) => s + Number(a.ad_spend ?? 0), 0);
  const totalActualCv = thisMonthAd.reduce((s, a) => s + Number(a.actual_cv ?? 0), 0);
  const cpaCost = totalActualCv > 0 ? Math.round(totalAdSpend / totalActualCv) : null;

  // ステータス別
  const statusMap: Record<string, number> = {};
  cases.forEach((c) => {
    const s = c.status as string;
    statusMap[s] = (statusMap[s] ?? 0) + 1;
  });

  // 流入経路別
  const sourceMap: Record<string, { total: number; contracted: number }> = {};
  cases.forEach((c) => {
    const src = (c.lead_source as string) || "不明";
    if (!sourceMap[src]) sourceMap[src] = { total: 0, contracted: 0 };
    sourceMap[src].total++;
    if (c.status === "契約") sourceMap[src].contracted++;
  });

  // 営業マン×月別集計（created_at基準で商談数、contracted_at基準で契約数）
  type MonthlySpStat = { cases: number; contracts: number; initialFee: number; monthlyFee: number };
  const spMonthlyMap: Record<string, Record<string, MonthlySpStat>> = {};

  cases.forEach((c) => {
    const sp = (c.sales_person as string)?.trim();
    if (!sp) return;
    const d = new Date(c.created_at as string);
    const ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!spMonthlyMap[sp]) spMonthlyMap[sp] = {};
    if (!spMonthlyMap[sp][ym]) spMonthlyMap[sp][ym] = { cases: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    spMonthlyMap[sp][ym].cases++;
  });

  cases.forEach((c) => {
    if (c.status !== "契約" || !c.contracted_at) return;
    const sp = (c.sales_person as string)?.trim();
    if (!sp) return;
    const d = new Date(c.contracted_at as string);
    const ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!spMonthlyMap[sp]) spMonthlyMap[sp] = {};
    if (!spMonthlyMap[sp][ym]) spMonthlyMap[sp][ym] = { cases: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    spMonthlyMap[sp][ym].contracts++;
    spMonthlyMap[sp][ym].initialFee += Number(c.initial_fee ?? 0);
    spMonthlyMap[sp][ym].monthlyFee += Number(c.monthly_fee ?? 0);
  });

  const spMonthlyText = Object.entries(spMonthlyMap).map(([sp, months]) => {
    const rows = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => {
        const rate = v.cases > 0 ? Math.round((v.contracts / v.cases) * 100) : 0;
        return `  ${ym}: 商談${v.cases}件 / 契約${v.contracts}件 / 契約率${rate}% / 初期¥${v.initialFee.toLocaleString()} / 月額¥${v.monthlyFee.toLocaleString()}`;
      })
      .join("\n");
    const totalCases = Object.values(months).reduce((s, v) => s + v.cases, 0);
    const totalContracts = Object.values(months).reduce((s, v) => s + v.contracts, 0);
    const totalRate = totalCases > 0 ? Math.round((totalContracts / totalCases) * 100) : 0;
    return `【${sp}】累計: 商談${totalCases}件 / 契約${totalContracts}件 / 契約率${totalRate}%\n${rows}`;
  }).join("\n\n");

  // 月別全体集計
  const monthlyTotalMap: Record<string, { cases: number; contracts: number; initialFee: number; monthlyFee: number }> = {};
  cases.forEach((c) => {
    const d = new Date(c.created_at as string);
    const ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!monthlyTotalMap[ym]) monthlyTotalMap[ym] = { cases: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    monthlyTotalMap[ym].cases++;
  });
  cases.forEach((c) => {
    if (c.status !== "契約" || !c.contracted_at) return;
    const d = new Date(c.contracted_at as string);
    const ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!monthlyTotalMap[ym]) monthlyTotalMap[ym] = { cases: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    monthlyTotalMap[ym].contracts++;
    monthlyTotalMap[ym].initialFee += Number(c.initial_fee ?? 0);
    monthlyTotalMap[ym].monthlyFee += Number(c.monthly_fee ?? 0);
  });

  const monthlyTotalText = Object.entries(monthlyTotalMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => {
      const rate = v.cases > 0 ? Math.round((v.contracts / v.cases) * 100) : 0;
      return `- ${ym}: 商談${v.cases}件 / 契約${v.contracts}件 / 契約率${rate}% / 初期¥${v.initialFee.toLocaleString()} / 月額¥${v.monthlyFee.toLocaleString()}`;
    })
    .join("\n");

  const context = `
# 営業SFA 全データサマリー（${year}年${month}月現在）

## 今月の主要KPI
- 商談数: ${thisMonthCases.length}件
- 契約件数: ${thisMonthContracted.length}件（目標: ${currentTarget?.target_count ?? "未設定"}件）
- 契約率: ${thisMonthCases.length > 0 ? Math.round((thisMonthContracted.length / thisMonthCases.length) * 100) : 0}%
- リード数: ${totalLeadsThisMonth}件
- アポ率: ${totalLeadsThisMonth > 0 ? Math.round((thisMonthCases.length / totalLeadsThisMonth) * 100) : 0}%
- 今月初期費用合計: ¥${thisMonthInitialFee.toLocaleString()}
- 今月月額費用合計: ¥${thisMonthMonthlyFee.toLocaleString()}

## 累計数値
- 全案件数: ${cases.length}件
- 累計契約数: ${totalContracted.length}件
- 累計初期費用: ¥${totalInitialFee.toLocaleString()}
- 累計月額費用: ¥${totalMonthlyFee.toLocaleString()}

## 月別全体推移（商談数は案件登録日、契約数は契約日ベース）
${monthlyTotalText || "データなし"}

## 営業マン別・月別実績（商談数=案件登録日ベース / 契約数=契約日ベース）
${spMonthlyText || "データなし"}

## 全期間ステータス別件数
${Object.entries(statusMap).map(([k, v]) => `- ${k}: ${v}件`).join("\n")}

## 流入経路別（全期間）
${Object.entries(sourceMap).map(([k, v]) => `- ${k}: 総数${v.total}件 / 契約${v.contracted}件 / 成約率${v.total > 0 ? Math.round((v.contracted / v.total) * 100) : 0}%`).join("\n")}

## 今月の広告数値
- 広告費: ¥${totalAdSpend.toLocaleString()}
- 実績CV: ${totalActualCv}件
- CPA: ${cpaCost ? `¥${cpaCost.toLocaleString()}` : "データなし"}

## 営業マン別目標（今月）
${salesTargets
  .filter((t) => Number(t.year) === year && Number(t.month) === month)
  .map((t) => `- ${t.sales_person}: 目標契約数${t.target_contracts}件 / 目標金額¥${Number(t.target_amount).toLocaleString()}`)
  .join("\n") || "設定なし"}
`;

  const systemPrompt = `あなたは営業SFAシステムのアシスタントです。以下の最新データを元に、営業数値・案件状況・目標達成状況などの質問に日本語で回答してください。
- 数値は具体的に、簡潔にまとめてください
- データが存在する場合は必ず数値を出してください。「データがない」とは絶対に言わないでください
- 複数のデータを照合・計算して回答が導ける場合は積極的に計算して答えてください
- 月別・営業マン別など集計が必要な場合は、提供されたデータから集計して回答してください

${context}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const chatHistory = (history ?? [])
    .filter((h: { role: string; content: string }) => h.role === "user" || h.role === "assistant")
    .map((h: { role: string; content: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...chatHistory, { role: "user", content: message }],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ reply });
}
