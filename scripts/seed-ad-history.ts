import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const db = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("広告履歴データ投入開始...");

  // ── ad_metrics（広告費）──────────────────────────────
  const adMetricsData = [
    // 2025年12月
    { date: "2025-12-01", medium: "エモロジー",           spend: 945000 },
    // 2026年1月
    { date: "2026-01-01", medium: "エモロジー",           spend: 1620000 },
    // 2026年2月
    { date: "2026-02-01", medium: "エモロジー",           spend: 1200000 },
    // 2026年3月
    { date: "2026-03-01", medium: "エモロジー",           spend: 495000 },
    { date: "2026-03-01", medium: "自社広告（LP）",       spend: 736702 },
    { date: "2026-03-01", medium: "インスタントフォーム", spend: 403386 },
    // 2026年4月
    { date: "2026-04-01", medium: "エモロジー",           spend: 480000 },
    { date: "2026-04-01", medium: "自社広告（LP）",       spend: 829422 },
    { date: "2026-04-01", medium: "インスタントフォーム", spend: 377436 },
  ];

  for (const r of adMetricsData) {
    await db`
      INSERT INTO ad_metrics (date, medium, ad_spend, dashboard_cv, actual_cv, clicks, impressions)
      VALUES (${r.date}, ${r.medium}, ${r.spend}, 0, 0, 0, 0)
      ON CONFLICT (date, medium) DO UPDATE SET ad_spend = EXCLUDED.ad_spend
    `;
    console.log(`  ad_metrics: ${r.date} ${r.medium} ¥${r.spend.toLocaleString()}`);
  }

  // ── leads（代理店リード数）──────────────────────────────
  const leadsData = [
    { date: "2025-12-01", medium: "エモロジー", count: 63 },
    { date: "2026-01-01", medium: "エモロジー", count: 108 },
    { date: "2026-02-01", medium: "エモロジー", count: 80 },
    { date: "2026-03-01", medium: "エモロジー", count: 33 },
    { date: "2026-04-01", medium: "エモロジー", count: 32 },
  ];

  for (const r of leadsData) {
    await db`
      INSERT INTO leads (date, medium, lead_count)
      VALUES (${r.date}, ${r.medium}, ${r.count})
      ON CONFLICT (date, medium) DO UPDATE SET lead_count = EXCLUDED.lead_count
    `;
    console.log(`  leads: ${r.date} ${r.medium} ${r.count}件`);
  }

  // ── ad_creatives（LP・インスタントフォームのリード数・広告費）──
  // 既存の月次集計レコードがあれば削除して再挿入
  await db`DELETE FROM ad_creatives WHERE ad_name LIKE '月次集計%'`;

  const adCreativesData = [
    // 2026年3月
    { name: "月次集計 2026年3月", medium: "lp",           spend: 736702,  cv: 34,  start: "2026-03-01", end: "2026-03-31" },
    { name: "月次集計 2026年3月", medium: "instant_form", spend: 403386,  cv: 179, start: "2026-03-01", end: "2026-03-31" },
    // 2026年4月
    { name: "月次集計 2026年4月", medium: "lp",           spend: 829422,  cv: 94,  start: "2026-04-01", end: "2026-04-30" },
    { name: "月次集計 2026年4月", medium: "instant_form", spend: 377436,  cv: 110, start: "2026-04-01", end: "2026-04-30" },
  ];

  for (const r of adCreativesData) {
    const cpa = r.cv > 0 ? Math.round(r.spend / r.cv) : 0;
    await db`
      INSERT INTO ad_creatives (ad_name, medium, spend, cv_count, cpa, report_start, report_end)
      VALUES (${r.name}, ${r.medium}, ${r.spend}, ${r.cv}, ${cpa}, ${r.start}, ${r.end})
    `;
    console.log(`  ad_creatives: ${r.name} ${r.medium} ¥${r.spend.toLocaleString()} CV${r.cv}件`);
  }

  console.log("\n完了！");
}

main().catch(console.error);
