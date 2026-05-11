import Papa from "papaparse";

const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ?? "1x4xRvuHZVocq0cyUovNSLA_mvhmtBRkouvMSM_0X1eA";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const KNOWN_LEAD_SOURCES = new Set([
  "過去リード",
  "エモロジー(広告代理店)",
  "自社広告（LP）",
  "自社広告（インスタントフォーム）",
  "代理店",
  "ウェビナー",
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
  // "11/26" or "1/9" — month >= 7 → 2025, else 2026
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
  const res = await fetch(CSV_URL, {
    next: { revalidate: 300 },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(
      `スプレッドシートの取得に失敗しました (HTTP ${res.status})。シートが「リンクを知っている全員」に共有されているか確認してください。`
    );
  }

  const csv = await res.text();

  // auth リダイレクト検出
  if (csv.includes("accounts.google.com") || csv.toLowerCase().includes("<html")) {
    throw new Error(
      "スプレッドシートが非公開です。Google スプレッドシートの共有設定を「リンクを知っている全員が閲覧可」に変更してください。"
    );
  }

  const { data: rows } = Papa.parse<string[]>(csv, {
    skipEmptyLines: false,
    header: false,
  });

  const cases: SheetCase[] = [];
  const metrics: SheetMetric[] = [];
  let inMetrics = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col0 = (row[0] ?? "").trim();
    const col1 = (row[1] ?? "").trim();

    // サマリヘッダ検出: A列空、B列 = "エモロジー"
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
