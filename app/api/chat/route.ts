import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY が設定されていません。https://aistudio.google.com/apikey で無料取得後、.env.local と Vercel 環境変数に GEMINI_API_KEY=xxx を追加してください。",
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

  // 今月集計
  const thisMonthContracted = cases.filter((c) => {
    if (c.status !== "契約" || !c.contracted_at) return false;
    const d = new Date(c.contracted_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const thisMonthApo = cases.filter((c) => {
    const d = new Date(c.created_at as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const totalContracted = cases.filter((c) => c.status === "契約");

  const thisMonthLeads = leads.filter((l) => {
    const d = new Date(l.date as string);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const totalLeadsThisMonth = thisMonthLeads.reduce((s, l) => s + Number(l.lead_count), 0);
  const thisMonthInitialFee = thisMonthContracted.reduce((s, c) => s + Number(c.initial_fee ?? 0), 0);
  const thisMonthMonthlyFee = thisMonthContracted.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);
  const totalInitialFee = totalContracted.reduce((s, c) => s + Number(c.initial_fee ?? 0), 0);
  const totalMonthlyFee = totalContracted.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);

  // 営業マン別集計（今月）
  const spMap: Record<string, { apo: number; contracts: number; initialFee: number; monthlyFee: number }> = {};
  thisMonthApo.forEach((c) => {
    const sp = (c.sales_person as string)?.trim();
    if (!sp) return;
    if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    spMap[sp].apo++;
  });
  thisMonthContracted.forEach((c) => {
    const sp = (c.sales_person as string)?.trim();
    if (!sp) return;
    if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, initialFee: 0, monthlyFee: 0 };
    spMap[sp].contracts++;
    spMap[sp].initialFee += Number(c.initial_fee ?? 0);
    spMap[sp].monthlyFee += Number(c.monthly_fee ?? 0);
  });

  const spStats = Object.entries(spMap)
    .map(([name, v]) => ({
      name,
      ...v,
      contractRate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
    }))
    .sort((a, b) => b.contracts - a.contracts);

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

  const context = `
# 営業SFA データサマリー（${year}年${month}月現在）

## 今月の主要KPI
- アポ件数: ${thisMonthApo.length}件
- 契約件数: ${thisMonthContracted.length}件（目標: ${currentTarget?.target_count ?? "未設定"}件）
- 成約率: ${thisMonthApo.length > 0 ? Math.round((thisMonthContracted.length / thisMonthApo.length) * 100) : 0}%
- リード数: ${totalLeadsThisMonth}件
- アポ率: ${totalLeadsThisMonth > 0 ? Math.round((thisMonthApo.length / totalLeadsThisMonth) * 100) : 0}%
- 今月初期費用合計: ¥${thisMonthInitialFee.toLocaleString()}
- 今月月額費用合計: ¥${thisMonthMonthlyFee.toLocaleString()}

## 累計数値
- 全案件数: ${cases.length}件
- 累計契約数: ${totalContracted.length}件
- 累計初期費用: ¥${totalInitialFee.toLocaleString()}
- 累計月額費用: ¥${totalMonthlyFee.toLocaleString()}

## 今月の営業マン別実績
${spStats.map((s) => `- ${s.name}: アポ${s.apo}件 / 契約${s.contracts}件 / 成約率${s.contractRate}% / 初期¥${s.initialFee.toLocaleString()} / 月額¥${s.monthlyFee.toLocaleString()}`).join("\n") || "データなし"}

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

  const systemPrompt = `あなたは営業SFAシステムのアシスタントです。以下の最新データを元に、営業数値・案件状況・目標達成状況などの質問に日本語で回答してください。数値は具体的に、簡潔にまとめてください。

${context}`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  // 会話履歴をGemini形式に変換
  const chatHistory = (history ?? []).map((h: { role: string; content: string }) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(message);
  const reply = result.response.text();

  return NextResponse.json({ reply });
}
