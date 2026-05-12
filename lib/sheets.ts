const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

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
