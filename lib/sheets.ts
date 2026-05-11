const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

// Google Visualization Query API（APIキー不要・公開シートで動作）
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

const KNOWN_LEAD_SOURCES = new Set([
  "過去リード", "エモロジー(広告代理店)", "自社広告（LP）",
  "自社広告（インスタントフォーム）", "代理店", "ウェビナー",
  "アウトバウンドコール",
]);

export interface SheetCase {
  leadSource: string;
  apoDate: Date | null;
  companyName: string;
  appointer: string;
  salesPerson: string;
  result: string;
  contractDate: Date | null;
}

interface GvizCell { v: unknown; f?: string }
interface GvizRow  { c: (GvizCell | null)[] }

function str(cell: GvizCell | null | undefined): string {
  return String(cell?.v ?? "").trim();
}

// gviz は M/D 形式の日付を誤った年で返すので補正する
function parseGvizDate(cell: GvizCell | null | undefined): Date | null {
  if (!cell?.v) return null;
  const m = String(cell.v).match(/^Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  const month0 = parseInt(m[2]); // 0-indexed
  const day    = parseInt(m[3]);
  const fmt    = cell.f ?? "";
  // 書式に4桁年が含まれている（"2025/11/11"）→ gviz の年を信頼
  if (/^\d{4}/.test(fmt)) {
    return new Date(parseInt(m[1]), month0, day);
  }
  // "11/26" のような M/D 形式 → 月で年を推定
  const y = month0 >= 6 ? 2025 : 2026; // 0-indexed: 6=July
  return new Date(y, month0, day);
}

export async function fetchSheetCases(): Promise<SheetCase[]> {
  const res = await fetch(GVIZ_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`gviz fetch failed: ${res.status}`);

  const text = await res.text();

  // "/*O_o*/\ngoogle.visualization.Query.setResponse({...});" を JSON に変換
  const jsonText = text
    .replace(/^[^(]+\(/, "")
    .replace(/\);\s*$/, "");

  let json: { table: { rows: GvizRow[] } };
  try {
    json = JSON.parse(jsonText);
  } catch {
    throw new Error("スプレッドシートの解析に失敗しました。シートが公開されているか確認してください。");
  }

  const cases: SheetCase[] = [];
  for (const row of json.table.rows) {
    if (!row?.c) continue;
    const leadSource = str(row.c[0]);
    if (!KNOWN_LEAD_SOURCES.has(leadSource)) continue;

    cases.push({
      leadSource,
      apoDate:      parseGvizDate(row.c[2]),
      companyName:  str(row.c[3]),
      appointer:    str(row.c[10]),
      salesPerson:  str(row.c[12]),
      result:       str(row.c[13]),
      contractDate: parseGvizDate(row.c[15]),
    });
  }

  return cases;
}
