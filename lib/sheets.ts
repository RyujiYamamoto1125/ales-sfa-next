/**
 * lib/sheets.ts
 * Google Apps Script Web App 経由でスプレッドシートデータを取得。
 * GASスクリプトがスプレッドシートオーナーの権限で動くため、
 * 社内共有設定のままでも問題なく動作する。
 *
 * 必要な環境変数:
 *   GOOGLE_SHEETS_GAS_URL   - GAS Web App の URL
 *   GOOGLE_SHEETS_GAS_TOKEN - 不正アクセス防止用の秘密トークン
 */

import { google } from "googleapis";

const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

const LEADS_GID = "201502389"; // リード管理シート

// 営業担当者3名（スプレッドシートの列M）
export const SALESPEOPLE = ["山本", "隅田", "片野"] as const;
export type Salesperson = (typeof SALESPEOPLE)[number];

// ── GAS Web App からデータ取得 ───────────────────────────
interface GasResponse {
  salesSheet: string[][];
  leadsSheet: string[][];
}

let _gasCache: { data: GasResponse; at: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1分キャッシュ

async function fetchFromGas(): Promise<GasResponse> {
  // キャッシュが有効なら使い回す
  if (_gasCache && Date.now() - _gasCache.at < CACHE_TTL_MS) {
    return _gasCache.data;
  }

  const gasUrl   = process.env.GOOGLE_SHEETS_GAS_URL;
  const gasToken = process.env.GOOGLE_SHEETS_GAS_TOKEN;

  if (!gasUrl || !gasToken) {
    throw new Error(
      "GOOGLE_SHEETS_GAS_URL / GOOGLE_SHEETS_GAS_TOKEN が未設定です。\n" +
      "Vercel の環境変数に GAS Web App の URL とトークンを設定してください。"
    );
  }

  const url = `${gasUrl}?token=${encodeURIComponent(gasToken)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`GAS Web App の取得に失敗しました (HTTP ${res.status})`);
  }

  const data = (await res.json()) as GasResponse;
  _gasCache = { data, at: Date.now() };
  return data;
}

// ── 日付文字列パーサー ─────────────────────────────────────
// Sheets API から返る典型フォーマット: "2025/5/20", "2025-05-20", "5/20" など
function parseDateStr(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // "YYYY/MM/DD" or "YYYY-MM-DD" or "YYYY/M/D"
  const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m1) return new Date(parseInt(m1[1]), parseInt(m1[2]) - 1, parseInt(m1[3]));

  // "MM/DD" or "M/D" — 年なし: 今日より30日超先なら昨年扱い
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m2) {
    const year = new Date().getFullYear();
    const candidate = new Date(year, parseInt(m2[1]) - 1, parseInt(m2[2]));
    const thirtyAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (candidate > thirtyAhead) return new Date(year - 1, parseInt(m2[1]) - 1, parseInt(m2[2]));
    return candidate;
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 公開インターフェース（旧 gviz 版と同一シグネチャ）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SheetCase {
  leadSource: string;
  apoDate: Date | null;
  companyName: string;
  appointer: string;
  salesPerson: string;
  result: string;
  contractDate: Date | null;
}

// ── 商談管理シート（先頭シート）────────────────────────────
export async function fetchSheetCases(): Promise<SheetCase[]> {
  const { salesSheet: rows } = await fetchFromGas();

  const spSet = new Set<string>(SALESPEOPLE);
  const cases: SheetCase[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const salesPerson = (row[12] ?? "").trim(); // M列
    if (!spSet.has(salesPerson)) continue;

    cases.push({
      leadSource:   (row[0]  ?? "").trim(),  // A列
      apoDate:      parseDateStr(row[2]),     // C列
      companyName:  (row[3]  ?? "").trim(),  // D列
      appointer:    (row[10] ?? "").trim(),  // K列
      salesPerson,
      result:       (row[13] ?? "").trim(),  // N列
      contractDate: parseDateStr(row[15]),   // P列
    });
  }

  return cases;
}

// ── リード管理シート ──────────────────────────────────────
export interface LeadsCount {
  date: string;     // "YYYY-MM-DD"
  campaign: string;
  count: number;
}

export async function fetchLeadsCount(): Promise<LeadsCount[]> {
  const { leadsSheet: rows } = await fetchFromGas();

  const countMap = new Map<string, number>();
  const metaMap  = new Map<string, { date: string; campaign: string }>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const campaign = (row[0] ?? "").trim();
    if (!campaign) continue;

    const rawDate = row[1] ?? "";
    const m = rawDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!m) continue;
    const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

    const key = `${date}|${campaign}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
    if (!metaMap.has(key)) metaMap.set(key, { date, campaign });
  }

  return Array.from(countMap.entries())
    .map(([key, count]) => ({ ...metaMap.get(key)!, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── 月次サマリ: リード管理シート ──────────────────────────
export interface MonthlyLeadApo {
  month: string; // "YYYY/MM"
  leads: number;
  apo: number;
}

export async function fetchMonthlyLeadApo(): Promise<MonthlyLeadApo[]> {
  const { leadsSheet: rows } = await fetchFromGas();

  const leadsByMonth: Record<string, number> = {};
  const apoByMonth:   Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const bRaw = row[1] ?? "";
    const bm   = bRaw.match(/^(\d{4})[\/\-](\d{1,2})/);
    if (bm) {
      const mk = `${bm[1]}/${bm[2].padStart(2, "0")}`;
      leadsByMonth[mk] = (leadsByMonth[mk] ?? 0) + 1;

      const status      = (row[14] ?? "").trim();
      const apoMonthRaw = (row[15] ?? "").trim();
      if (status.includes("アポ") && apoMonthRaw) {
        const monthNum = parseInt(apoMonthRaw);
        if (monthNum >= 1 && monthNum <= 12) {
          const year = parseInt(bm[1]);
          const mk2  = `${year}/${String(monthNum).padStart(2, "0")}`;
          apoByMonth[mk2] = (apoByMonth[mk2] ?? 0) + 1;
        }
      }
    }
  }

  const allMonths = new Set([...Object.keys(leadsByMonth), ...Object.keys(apoByMonth)]);
  return [...allMonths].sort().map((month) => ({
    month,
    leads: leadsByMonth[month] ?? 0,
    apo:   apoByMonth[month]   ?? 0,
  }));
}

// ── 数値管理シート: 月次 実CV（= 月別リード数）────────────
// 別スプレッドシート「数値管理」シートの各月「実CV」列を月次リード数として取得。
// A列 "YYYY年M月" / B列 管理画面CV / C列 実CV。行は月ごとに増える（6月=2行目, 7月=3行目…）。
// 環境変数で上書き可（未設定時は本番シートを既定値として使用）。
const NUMBERS_SHEET_ID  =
  process.env.GOOGLE_NUMBERS_SHEET_ID  ?? "1QX-mpa2pGICFSQiAHCXGgn98DUD7-jpWOK5Pnam52wA";
const NUMBERS_SHEET_GID =
  process.env.GOOGLE_NUMBERS_SHEET_GID ?? "753781064";

export interface MonthlyActualCv {
  month: string;    // "YYYY/MM"
  actualCv: number; // 実CV = リード数
}

let _actualCvCache: { data: MonthlyActualCv[]; at: number } | null = null;

// gviz CSV は各セルを二重引用符で囲む。埋め込みカンマ・改行・エスケープ("")に対応した最小パーサー。
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip CR */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export async function fetchMonthlyActualCv(): Promise<MonthlyActualCv[]> {
  if (_actualCvCache && Date.now() - _actualCvCache.at < CACHE_TTL_MS) {
    return _actualCvCache.data;
  }

  const url = `https://docs.google.com/spreadsheets/d/${NUMBERS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${NUMBERS_SHEET_GID}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`数値管理シートの取得に失敗しました (HTTP ${res.status})`);
  }

  const rows = parseCsv(await res.text());
  const result: MonthlyActualCv[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = (row[0] ?? "").trim();           // "2026年6月"
    const lm = label.match(/(\d{4})年\s*(\d{1,2})月/);
    if (!lm) continue;

    // C列（実CV）を数値化。空欄は 0 扱い。
    const cvRaw = (row[2] ?? "").replace(/[^\d\-]/g, "");
    const actualCv = cvRaw === "" ? 0 : parseInt(cvRaw, 10);
    if (!Number.isFinite(actualCv)) continue;

    result.push({ month: `${lm[1]}/${lm[2].padStart(2, "0")}`, actualCv });
  }

  _actualCvCache = { data: result, at: Date.now() };
  return result;
}

// ── 広告レポート（企画別月次サマリ）────────────────────────
export interface AdCampaignReport {
  campaignName: string;
  adSpend: number;
  actualCv: number;
}

let _adReportCache: { data: AdCampaignReport[]; at: number } | null = null;

export async function fetchAdReport(): Promise<AdCampaignReport[]> {
  if (_adReportCache && Date.now() - _adReportCache.at < CACHE_TTL_MS) {
    return _adReportCache.data;
  }

  const gasUrl   = process.env.GOOGLE_AD_REPORT_GAS_URL;
  const gasToken = process.env.GOOGLE_AD_REPORT_GAS_TOKEN;

  if (!gasUrl || !gasToken) {
    throw new Error(
      "GOOGLE_AD_REPORT_GAS_URL / GOOGLE_AD_REPORT_GAS_TOKEN が未設定です。\n" +
      "広告レポート用の GAS Web App を作成し、Vercel 環境変数に設定してください。"
    );
  }

  const url = `${gasUrl}?token=${encodeURIComponent(gasToken)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`広告レポート GAS Web App の取得に失敗しました (HTTP ${res.status})`);
  }

  const data = (await res.json()) as AdCampaignReport[];
  _adReportCache = { data, at: Date.now() };
  return data;
}

// ── 月次サマリ: 営業管理シート ────────────────────────────
export interface MonthlySalesStats {
  month: string;
  meetings: number;
  contracts: number;
}

export async function fetchMonthlySalesStats(): Promise<MonthlySalesStats[]> {
  const { salesSheet: rows } = await fetchFromGas();

  const meetingsByMonth:  Record<string, number> = {};
  const contractsByMonth: Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const lRaw = row[11] ?? "";
    const lm   = lRaw.match(/^(\d{4})[\/\-](\d{1,2})/);
    if (lm) {
      const mk = `${lm[1]}/${lm[2].padStart(2, "0")}`;
      meetingsByMonth[mk] = (meetingsByMonth[mk] ?? 0) + 1;
    }

    const result = (row[13] ?? "").trim();
    if (result === "契約") {
      const dt = parseDateStr(row[15]);
      if (dt) {
        const mk = `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
        contractsByMonth[mk] = (contractsByMonth[mk] ?? 0) + 1;
      }
    }
  }

  const allMonths = new Set([...Object.keys(meetingsByMonth), ...Object.keys(contractsByMonth)]);
  return [...allMonths].sort().map((month) => ({
    month,
    meetings:  meetingsByMonth[month]  ?? 0,
    contracts: contractsByMonth[month] ?? 0,
  }));
}
