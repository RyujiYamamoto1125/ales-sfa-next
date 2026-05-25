/**
 * lib/sheets.ts
 * Google Sheets API v4（サービスアカウント認証）でデータ取得。
 * GOOGLE_SERVICE_ACCOUNT_KEY 環境変数が設定されていれば API 経由でアクセスし、
 * スプレッドシートの共有設定に関わらず読み取れる。
 */

import { google } from "googleapis";

const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

const LEADS_GID = "201502389"; // リード管理シート

// 営業担当者3名（スプレッドシートの列M）
export const SALESPEOPLE = ["山本", "隅田", "片野"] as const;
export type Salesperson = (typeof SALESPEOPLE)[number];

// ── OAuth2 認証（ai-asset-sales@extra-company.jp）────────
function getAuthClient() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth2 の環境変数が未設定です。\n" +
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN を Vercel に設定してください。"
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

// ── シートGIDからシート名に変換 ────────────────────────────
// Sheets API はシート名 or A1 範囲で指定するため、GID → sheetName の変換が必要
async function getSheetNameByGid(
  sheets: ReturnType<typeof google.sheets>,
  gid: string
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = meta.data.sheets?.find((s) => String(s.properties?.sheetId) === gid);
  if (!sheet?.properties?.title) throw new Error(`GID ${gid} のシートが見つかりません。`);
  return sheet.properties.title;
}

// ── シートデータ取得（全列・フォーマット済み値）──────────────
async function fetchSheetValues(range: string): Promise<string[][]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    valueRenderOption: "FORMATTED_VALUE", // 日付は "2025/05/20" のような文字列で返る
  });

  return (res.data.values ?? []) as string[][];
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
  // 先頭シート（GID 0 = 最初のシート）を取得
  // range は "シート名!A:P" の形式。先頭シートはシート名省略可能
  const rows = await fetchSheetValues("A:P");

  const spSet = new Set<string>(SALESPEOPLE);
  const cases: SheetCase[] = [];

  for (let i = 1; i < rows.length; i++) {
    // 1行目はヘッダーとしてスキップ
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const salesPerson = (row[12] ?? "").trim(); // M列(index12)
    if (!spSet.has(salesPerson)) continue;

    cases.push({
      leadSource: (row[0] ?? "").trim(),   // A列
      apoDate: parseDateStr(row[2]),         // C列
      companyName: (row[3] ?? "").trim(),   // D列
      appointer: (row[10] ?? "").trim(),    // K列
      salesPerson,
      result: (row[13] ?? "").trim(),       // N列
      contractDate: parseDateStr(row[15]),  // P列
    });
  }

  return cases;
}

// ── リード管理シート ──────────────────────────────────────
export interface LeadsCount {
  date: string;     // "YYYY-MM-DD"
  campaign: string; // 流入経路（企画名）
  count: number;
}

export async function fetchLeadsCount(): Promise<LeadsCount[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = await getSheetNameByGid(sheets, LEADS_GID);

  const rows = await fetchSheetValues(`${sheetName}!A:B`);

  const countMap = new Map<string, number>();
  const metaMap = new Map<string, { date: string; campaign: string }>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const campaign = (row[0] ?? "").trim();
    if (!campaign) continue;

    const rawDate = row[1] ?? "";
    // "YYYY/MM/DD HH:MM:SS" or "YYYY/MM/DD" 形式
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
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = await getSheetNameByGid(sheets, LEADS_GID);

  const rows = await fetchSheetValues(`${sheetName}!A:P`);

  const leadsByMonth: Record<string, number> = {};
  const apoByMonth: Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // B列(index1): 資料請求日時
    const bRaw = row[1] ?? "";
    const bm = bRaw.match(/^(\d{4})[\/\-](\d{1,2})/);
    if (bm) {
      const mk = `${bm[1]}/${bm[2].padStart(2, "0")}`;
      leadsByMonth[mk] = (leadsByMonth[mk] ?? 0) + 1;

      // O列(index14): ステータス、P列(index15): アポ取得月
      const status = (row[14] ?? "").trim();
      const apoMonthRaw = (row[15] ?? "").trim();
      if (status.includes("アポ") && apoMonthRaw) {
        const monthNum = parseInt(apoMonthRaw);
        if (monthNum >= 1 && monthNum <= 12) {
          const year = parseInt(bm[1]);
          const mk2 = `${year}/${String(monthNum).padStart(2, "0")}`;
          apoByMonth[mk2] = (apoByMonth[mk2] ?? 0) + 1;
        }
      }
    }
  }

  const allMonths = new Set([...Object.keys(leadsByMonth), ...Object.keys(apoByMonth)]);
  return [...allMonths].sort().map((month) => ({
    month,
    leads: leadsByMonth[month] ?? 0,
    apo: apoByMonth[month] ?? 0,
  }));
}

// ── 月次サマリ: 営業管理シート ────────────────────────────
export interface MonthlySalesStats {
  month: string;
  meetings: number;
  contracts: number;
}

export async function fetchMonthlySalesStats(): Promise<MonthlySalesStats[]> {
  const rows = await fetchSheetValues("A:P");

  const meetingsByMonth: Record<string, number> = {};
  const contractsByMonth: Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // L列(index11): 初回商談日時
    const lRaw = row[11] ?? "";
    const lm = lRaw.match(/^(\d{4})[\/\-](\d{1,2})/);
    if (lm) {
      const mk = `${lm[1]}/${lm[2].padStart(2, "0")}`;
      meetingsByMonth[mk] = (meetingsByMonth[mk] ?? 0) + 1;
    }

    // N列(index13): 商談結果 = "契約", P列(index15): 契約日
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
    meetings: meetingsByMonth[month] ?? 0,
    contracts: contractsByMonth[month] ?? 0,
  }));
}
