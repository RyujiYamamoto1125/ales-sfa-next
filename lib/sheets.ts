const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

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

export interface SheetMetric {
  label: string;
  emology: string;
  form: string;
  ownLpEarly: string;
  ownLpLate: string;
  total: string;
}

export interface SheetsData {
  cases: SheetCase[];
  metrics: SheetMetric[];
}

function parseSheetDate(v: string): Date | null {
  const s = (v ?? "").trim().split(" ")[0];
  if (!s) return null;
  // "2025/11/11" or "2025-11-11"
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)) {
    return new Date(s.replace(/\//g, "-"));
  }
  // "11/26" or "1/9" — infer year: month >= 7 → 2025, else 2026
  const md = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const m = parseInt(md[1]);
    const d = parseInt(md[2]);
    const y = m >= 7 ? 2025 : 2026;
    return new Date(y, m - 1, d);
  }
  return null;
}

export async function fetchSheetsData(): Promise<SheetsData> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:T600?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const rows: string[][] = json.values ?? [];

  const cases: SheetCase[] = [];
  const metrics: SheetMetric[] = [];
  let inMetrics = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col0 = (row[0] ?? "").trim();
    const col1 = (row[1] ?? "").trim();

    // Summary metrics header: empty A, "エモロジー" in B
    if (!inMetrics && col0 === "" && col1 === "エモロジー") {
      inMetrics = true;
      continue;
    }

    if (inMetrics) {
      if (col0) {
        metrics.push({
          label: col0,
          emology: (row[1] ?? "").trim(),
          form: (row[2] ?? "").trim(),
          ownLpEarly: (row[3] ?? "").trim(),
          ownLpLate: (row[4] ?? "").trim(),
          total: (row[5] ?? "").trim(),
        });
      }
      continue;
    }

    if (KNOWN_LEAD_SOURCES.has(col0)) {
      cases.push({
        leadSource: col0,
        apoDate: parseSheetDate(row[2] ?? ""),
        companyName: (row[3] ?? "").trim(),
        appointer: (row[10] ?? "").trim(),
        salesPerson: (row[12] ?? "").trim(),
        result: (row[13] ?? "").trim(),
        contractDate: parseSheetDate(row[15] ?? ""),
      });
    }
  }

  return { cases, metrics };
}
