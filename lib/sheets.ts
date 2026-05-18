const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const LEADS_GID = "201502389"; // リード管理シート

// 営業担当者3名（スプレッドシートの列M）
export const SALESPEOPLE = ["山本", "隅田", "片野"] as const;
export type Salesperson = typeof SALESPEOPLE[number];

export interface SheetCase {
  leadSource:  string;
  apoDate:     Date | null;
  companyName: string;
  appointer:   string;
  salesPerson: string;
  result:      string;
  contractDate: Date | null;
}

interface GvizCell { v: unknown; f?: string }
interface GvizRow  { c: (GvizCell | null)[] }

function str(cell: GvizCell | null | undefined): string {
  return String(cell?.v ?? "").trim();
}

function parseGvizDate(cell: GvizCell | null | undefined): Date | null {
  if (!cell?.v) return null;
  const m = String(cell.v).match(/^Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  const gvizYear = parseInt(m[1]);
  const month0   = parseInt(m[2]);
  const day      = parseInt(m[3]);
  const fmt      = cell.f ?? "";
  // 書式に4桁年がある場合はその年を信頼
  if (/^\d{4}/.test(fmt)) return new Date(gvizYear, month0, day);
  // 年なし書式("11/26"等): gvizが割り当てた年が今日より30日超先であれば
  // スプレッドシートの年省略入力による誤解釈と判断して1年引く
  const candidate = new Date(gvizYear, month0, day);
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (candidate > thirtyDaysAhead) return new Date(gvizYear - 1, month0, day);
  return candidate;
}

// ── リード管理シート用 ────────────────────────────────────
export interface LeadsCount {
  date: string;     // "YYYY-MM-DD"
  campaign: string; // 流入経路（企画名）
  count: number;
}

function parseLeadDate(cell: GvizCell | null | undefined): string | null {
  if (!cell) return null;
  // GVIZ datetime: Date(year,month0,day,h,m,s)
  const m = String(cell.v ?? "").match(/^Date\((\d+),(\d+),(\d+)/);
  if (m) {
    const y = parseInt(m[1]);
    const mo = parseInt(m[2]) + 1;
    const d = parseInt(m[3]);
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // フォーマット文字列 or テキスト: "YYYY/MM/DD ..."
  const raw = (cell.f ?? String(cell.v ?? "")).trim();
  const m2 = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m2) {
    return `${m2[1]}-${String(m2[2]).padStart(2, "0")}-${String(m2[3]).padStart(2, "0")}`;
  }
  return null;
}

export async function fetchLeadsCount(): Promise<LeadsCount[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${LEADS_GID}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`リード管理シートの取得に失敗しました (HTTP ${res.status})`);

  const text = await res.text();
  const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);\s*$/, "");

  let json: { table: { rows: GvizRow[] } };
  try {
    json = JSON.parse(jsonText);
  } catch {
    throw new Error("リード管理シートの解析に失敗しました。公開共有設定を確認してください。");
  }

  // 日付×企画のカウントのみ（個人情報は一切保持しない）
  const countMap = new Map<string, number>();
  const metaMap = new Map<string, { date: string; campaign: string }>();

  for (const row of json.table.rows) {
    if (!row?.c) continue;
    const campaign = str(row.c[0]);
    if (!campaign) continue;
    const date = parseLeadDate(row.c[1]);
    if (!date) continue;

    const key = `${date}|${campaign}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
    if (!metaMap.has(key)) metaMap.set(key, { date, campaign });
  }

  return Array.from(countMap.entries())
    .map(([key, count]) => ({ ...metaMap.get(key)!, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── 月次サマリ: リード管理シート (B=資料請求日時, O=ステータス, P=アポ取得月) ──

export interface MonthlyLeadApo {
  month: string;  // "YYYY/MM"
  leads: number;
  apo: number;
}

export async function fetchMonthlyLeadApo(): Promise<MonthlyLeadApo[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${LEADS_GID}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`リード管理シートの取得に失敗しました (HTTP ${res.status})`);

  const text = await res.text();
  const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);\s*$/, "");
  const json: { table: { rows: GvizRow[] } } = JSON.parse(jsonText);

  const leadsByMonth: Record<string, number> = {};
  const apoByMonth:   Record<string, number> = {};

  for (const row of json.table.rows) {
    if (!row?.c) continue;

    // B列 (index 1): 資料請求日時 datetime → group by YYYY/MM
    const bCell = row.c[1];
    if (bCell?.v) {
      const m = String(bCell.v).match(/^Date\((\d+),(\d+)/);
      if (m) {
        const year  = parseInt(m[1]);
        const month = parseInt(m[2]) + 1;  // gviz は 0-based
        const mk = `${year}/${String(month).padStart(2, "0")}`;
        leadsByMonth[mk] = (leadsByMonth[mk] ?? 0) + 1;
      }
    }

    // O列 (index 14): ステータス = "アポ獲得済", P列 (index 15): アポ取得月 (数値)
    const oCell = row.c[14];
    const pCell = row.c[15];
    if (oCell?.v && String(oCell.v).includes("アポ") && pCell?.v != null) {
      const monthNum = Math.round(Number(pCell.v));
      if (monthNum >= 1 && monthNum <= 12) {
        // B列の年を参照（なければ当年）
        let year = new Date().getFullYear();
        if (bCell?.v) {
          const bm = String(bCell.v).match(/^Date\((\d+),/);
          if (bm) year = parseInt(bm[1]);
        }
        const mk = `${year}/${String(monthNum).padStart(2, "0")}`;
        apoByMonth[mk] = (apoByMonth[mk] ?? 0) + 1;
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

// ── 月次サマリ: 営業管理シート (N=商談結果, P=契約日, L=初回商談日時) ──

export interface MonthlySalesStats {
  month: string;
  meetings: number;  // 初回商談日時 (L列) が当月のもの
  contracts: number; // 商談結果=契約 (N列) かつ 契約日 (P列) が当月のもの
}

export async function fetchMonthlySalesStats(): Promise<MonthlySalesStats[]> {
  const res = await fetch(GVIZ_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`営業管理シートの取得に失敗しました (HTTP ${res.status})`);

  const text = await res.text();
  const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);\s*$/, "");
  const json: { table: { rows: GvizRow[] } } = JSON.parse(jsonText);

  const meetingsByMonth:   Record<string, number> = {};
  const contractsByMonth:  Record<string, number> = {};

  for (const row of json.table.rows) {
    if (!row?.c) continue;

    // L列 (index 11): 初回商談日時 → 商談実行数
    const lCell = row.c[11];
    if (lCell?.v) {
      const m = String(lCell.v).match(/^Date\((\d+),(\d+)/);
      if (m) {
        const year  = parseInt(m[1]);
        const month = parseInt(m[2]) + 1;
        const mk = `${year}/${String(month).padStart(2, "0")}`;
        meetingsByMonth[mk] = (meetingsByMonth[mk] ?? 0) + 1;
      }
    }

    // N列 (index 13): 商談結果 = "契約", P列 (index 15): 契約日
    const nCell = row.c[13];
    if (nCell?.v === "契約") {
      const pCell = row.c[15];
      const dt = parseGvizDate(pCell);
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

// ── 既存: 商談管理シート ─────────────────────────────────
export async function fetchSheetCases(): Promise<SheetCase[]> {
  const res = await fetch(GVIZ_URL, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`スプレッドシートの取得に失敗しました (HTTP ${res.status})`);

  const text = await res.text();
  const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);\s*$/, "");

  let json: { table: { rows: GvizRow[] } };
  try {
    json = JSON.parse(jsonText);
  } catch {
    throw new Error("スプレッドシートの解析に失敗しました。シートが公開共有されているか確認してください。");
  }

  const spSet = new Set<string>(SALESPEOPLE);
  const cases: SheetCase[] = [];

  for (const row of json.table.rows) {
    if (!row?.c) continue;
    // 商談担当者（列M=index12）が3名のうちの誰かである行のみ取得
    const salesPerson = str(row.c[12]);
    if (!spSet.has(salesPerson)) continue;

    cases.push({
      leadSource:   str(row.c[0]),
      apoDate:      parseGvizDate(row.c[2]),
      companyName:  str(row.c[3]),
      appointer:    str(row.c[10]),
      salesPerson,
      result:       str(row.c[13]),
      contractDate: parseGvizDate(row.c[15]),
    });
  }

  return cases;
}
