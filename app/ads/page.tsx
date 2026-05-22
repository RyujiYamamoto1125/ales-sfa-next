"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import { Megaphone, TrendingUp, DollarSign, MousePointerClick, Download, Trash2, Upload } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

// ── 定数 ─────────────────────────────────────────────
const MEDIUMS = ["Google", "Meta", "TikTok", "LINE", "広告代理店", "その他"];

const MEDIUM_COLOR: Record<string, string> = {
  Google: "#4285F4", Meta: "#1877F2", TikTok: "#000000",
  LINE: "#06C755", 広告代理店: "#A855F7", その他: "#94A3B8",
};

// ── 型 ───────────────────────────────────────────────
interface AdMetric {
  id: number;
  date: string;
  medium: string;
  ad_spend: number;
  dashboard_cv: number;
  actual_cv: number;
  clicks: number;
  impressions: number;
}

interface Calc {
  cpa: number | null;
  ctr: number | null;
  cvr: number | null;
}

// ── 計算 ─────────────────────────────────────────────
function calc(row: Pick<AdMetric, "ad_spend" | "actual_cv" | "clicks" | "impressions">): Calc {
  return {
    cpa: row.actual_cv    > 0 ? Math.round(row.ad_spend / row.actual_cv) : null,
    ctr: row.impressions  > 0 ? row.clicks / row.impressions * 100        : null,
    cvr: row.clicks       > 0 ? row.actual_cv / row.clicks * 100          : null,
  };
}

function fmt(v: number | null, suffix = "", digits = 1) {
  if (v === null) return "—";
  return v.toFixed(digits) + suffix;
}

// ── 広告代理店 簡易入力フォーム ──────────────────────────
function AgencyForm({ onSaved }: { onSaved: () => void }) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month,   setMonth]   = useState(defaultMonth);
  const [spend,   setSpend]   = useState(0);
  const [cv,      setCv]      = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // 月の1日をDBの日付として登録（date, medium でユニーク制約）
    const date = `${month}-01`;
    await fetch("/api/ad-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, medium: "広告代理店",
        adSpend: spend, dashboardCv: cv, actualCv: cv,
        clicks: 0, impressions: 0,
      }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
          <span className="text-purple-600 font-bold text-sm">代</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700">広告代理店 簡易入力</h3>
          <p className="text-xs text-gray-400">総広告費とCV数のみ入力 — 媒体「広告代理店」で登録します</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">月</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">総広告費（円）</label>
            <input type="number" min={0} value={spend}
              onChange={(e) => setSpend(Number(e.target.value))}
              className="w-48 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">総CV数</label>
            <input type="number" min={0} value={cv}
              onChange={(e) => setCv(Number(e.target.value))}
              className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
          </div>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
            {saved ? "保存済み ✓" : saving ? "保存中..." : "保存する"}
          </button>
        </div>

        {(spend > 0 || cv > 0) && (
          <div className="mt-4 flex gap-6 px-4 py-3 bg-purple-50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-purple-400">CPA</p>
              <p className="text-lg font-bold text-purple-700">
                {cv > 0 ? `¥${Math.round(spend / cv).toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-purple-400">広告費</p>
              <p className="text-lg font-bold text-purple-700">¥{spend.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-purple-400">CV数</p>
              <p className="text-lg font-bold text-purple-700">{cv}件</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ── Meta CSV パーサー ────────────────────────────────
const META_DATE_KEYS  = ["日付", "レポートの開始日", "Reporting starts", "Date"];
const META_SPEND_KEYS = ["消化金額（JPY）", "金額（JPY）", "Amount spent (JPY)", "Amount spent", "消化金額 (JPY)", "金額 (JPY)", "消化金額(JPY)", "金額(JPY)"];
const META_IMPR_KEYS  = ["インプレッション数", "Impressions"];
const META_CLICK_KEYS = ["リンクのクリック数", "Link clicks", "クリック数（すべて）", "Clicks (all)"];
const META_CV_KEYS    = ["結果", "Results"];

function findHeader(headers: string[], candidates: string[]): string | null {
  for (const h of headers) {
    const ht = h.trim();
    if (candidates.some(c => ht === c || ht.startsWith(c))) return h;
  }
  return null;
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  text = text.replace(/^﻿/, "");
  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && !inQ)  { inQ = true; continue; }
      if (c === '"' && inQ)   { if (line[i + 1] === '"') { field += '"'; i++; } else inQ = false; continue; }
      if (c === ',' && !inQ)  { fields.push(field); field = ""; continue; }
      field += c;
    }
    fields.push(field);
    return fields;
  };
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
}

function toDateStr(raw: string): string | null {
  const s = raw.trim().replace(/\//g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseNum(raw: string): number {
  return Number((raw ?? "").replace(/[¥,\s円]/g, "")) || 0;
}

interface ParsedMetaRow {
  date: string; adSpend: number; dashboardCv: number;
  actualCv: number; clicks: number; impressions: number;
}

function MetaCsvImport({ onImported }: { onImported: () => void }) {
  const [preview,   setPreview]   = useState<ParsedMetaRow[]>([]);
  const [warnings,  setWarnings]  = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<string | null>(null);
  const [fileName,  setFileName]  = useState<string | null>(null);

  function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSVText(text);

      const dateKey  = findHeader(headers, META_DATE_KEYS);
      const spendKey = findHeader(headers, META_SPEND_KEYS);
      const imprKey  = findHeader(headers, META_IMPR_KEYS);
      const clickKey = findHeader(headers, META_CLICK_KEYS);
      const cvKey    = findHeader(headers, META_CV_KEYS);

      const warns: string[] = [];
      if (!dateKey)  warns.push("日付列が見つかりませんでした");
      if (!spendKey) warns.push("消化金額列が見つかりませんでした");
      if (!imprKey)  warns.push("インプレッション数列が見つかりませんでした");
      if (!clickKey) warns.push("クリック数列が見つかりませんでした");
      if (!cvKey)    warns.push("結果（CV）列が見つかりませんでした — 0でインポートします");
      setWarnings(warns);

      const idx = (key: string | null) => key ? headers.indexOf(key) : -1;
      const dateIdx  = idx(dateKey);
      const spendIdx = idx(spendKey);
      const imprIdx  = idx(imprKey);
      const clickIdx = idx(clickKey);
      const cvIdx    = idx(cvKey);

      const parsed: ParsedMetaRow[] = [];
      for (const row of rows) {
        const date = toDateStr(dateIdx >= 0 ? row[dateIdx] ?? "" : "");
        if (!date) continue;
        const cv = cvIdx >= 0 ? parseNum(row[cvIdx] ?? "0") : 0;
        parsed.push({
          date,
          adSpend:     spendIdx >= 0 ? parseNum(row[spendIdx] ?? "0") : 0,
          dashboardCv: cv,
          actualCv:    cv,
          clicks:      clickIdx >= 0 ? parseNum(row[clickIdx] ?? "0") : 0,
          impressions: imprIdx  >= 0 ? parseNum(row[imprIdx]  ?? "0") : 0,
        });
      }
      setPreview(parsed);
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    setImporting(true);
    const body = preview.map(r => ({ ...r, medium: "Meta" }));
    const res = await fetch("/api/ad-metrics/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setImporting(false);
    if (d.imported != null) {
      setResult(`✓ ${d.imported}件をMetaとしてインポートしました（同日データは上書き）`);
      setPreview([]);
      setFileName(null);
      onImported();
    } else {
      setResult("エラーが発生しました");
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Upload size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Meta広告 CSVインポート</h3>
          <p className="text-xs text-gray-400">広告マネージャの「日付」内訳CSVをそのまま読み込み、媒体=Metaで登録します</p>
        </div>
      </div>

      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-colors">
        <Upload size={20} className="text-gray-300 mb-2" />
        <span className="text-sm text-gray-400">{fileName ?? "CSVファイルを選択またはドロップ"}</span>
        <span className="text-xs text-gray-300 mt-1">.csv（UTF-8）</span>
        <input type="file" accept=".csv" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      </label>

      {warnings.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 rounded-xl space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700">⚠ {w}</p>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500">{preview.length}件のデータを検出</p>
            <button onClick={handleImport} disabled={importing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors">
              {importing ? "インポート中..." : "インポート実行"}
            </button>
          </div>
          <div className="overflow-x-auto max-h-56 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {["日付","消化広告費","管理画面CV","実CV","クリック","表示回数"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 60).map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-600">{r.date}</td>
                    <td className="px-3 py-2 font-medium text-gray-700">¥{r.adSpend.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600">{r.dashboardCv}</td>
                    <td className="px-3 py-2 text-gray-600">{r.actualCv}</td>
                    <td className="px-3 py-2 text-gray-600">{r.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600">{r.impressions.toLocaleString()}</td>
                  </tr>
                ))}
                {preview.length > 60 && (
                  <tr><td colSpan={6} className="px-3 py-2 text-gray-400 text-center">…他{preview.length - 60}件</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
          <p className="text-xs text-emerald-700 font-semibold">{result}</p>
        </div>
      )}
    </div>
  );
}

// ── リード管理シート 実CV連携パネル ──────────────────────
function SheetCvPanel({ year, month, onSynced }: { year: number; month: number; onSynced: () => void }) {
  const [data,    setData]    = useState<{ date: string; campaign: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/leads-count?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setData([]); }
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("データ取得に失敗しました"); setLoading(false); });
  }, [year, month]);

  async function handleSync() {
    if (!data.length) return;
    setSyncing(true);
    const res = await fetch("/api/leads-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d = await res.json();
    setSyncing(false);
    if (d.synced != null) {
      setResult(`✓ ${d.synced}件の実CVを同期しました（広告費・クリック数は既存値を保持）`);
      onSynced();
      setTimeout(() => setResult(null), 4000);
    } else {
      setResult("エラーが発生しました");
    }
  }

  const byCampaign: Record<string, number> = {};
  data.forEach(d => { byCampaign[d.campaign] = (byCampaign[d.campaign] ?? 0) + d.count; });
  const totalCv = Object.values(byCampaign).reduce((s, c) => s + c, 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <span className="text-emerald-600 font-bold text-sm">実</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">リード管理シート 実CV（自社LP）</h3>
            <p className="text-xs text-gray-400">スプレッドシートの「リード管理」シートから集計 — 個人情報はカウントのみ取得</p>
          </div>
        </div>
        {data.length > 0 && (
          <button onClick={handleSync} disabled={syncing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors">
            {syncing ? "同期中..." : "実CVを同期"}
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400 py-2">読み込み中...</p>}
      {error   && <p className="text-xs text-red-500 py-2">⚠ {error}</p>}

      {!loading && !error && data.length === 0 && (
        <p className="text-xs text-gray-400 py-2">{year}年{month}月のリードデータがありません</p>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* 企画別サマリー */}
          <div className="flex flex-wrap gap-6 mb-4 px-4 py-3 bg-emerald-50 rounded-xl">
            {Object.entries(byCampaign).map(([campaign, count]) => (
              <div key={campaign} className="text-center">
                <p className="text-xs text-emerald-500 font-medium">{campaign}</p>
                <p className="text-xl font-bold text-emerald-700">{count}件</p>
              </div>
            ))}
            {Object.keys(byCampaign).length > 1 && (
              <div className="text-center border-l border-emerald-200 pl-6">
                <p className="text-xs text-emerald-500 font-medium">合計</p>
                <p className="text-xl font-bold text-emerald-700">{totalCv}件</p>
              </div>
            )}
          </div>

          {/* 日別テーブル */}
          <div className="overflow-x-auto max-h-52 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {["日付", "企画（流入経路）", "CV数"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2 text-gray-700 font-medium">{r.campaign}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{r.count}件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {result && (
        <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
          <p className="text-xs text-emerald-700 font-semibold">{result}</p>
        </div>
      )}
    </div>
  );
}

// ── スタイル ─────────────────────────────────────────
const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── メイン ────────────────────────────────────────────
export default function AdsPage() {
  const { data: session } = useSession();
  const isAdmin     = session?.user?.role === "admin";
  const canEdit     = session?.user?.role !== "appointer";

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows,  setRows]  = useState<AdMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);

  const [form, setForm] = useState({
    date: now.toISOString().slice(0, 10),
    medium:      "Google",
    adSpend:     0,
    dashboardCv: 0,
    actualCv:    0,
    clicks:      0,
    impressions: 0,
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/ad-metrics?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setRows(d); setLoading(false); });
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/ad-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    await fetch("/api/ad-metrics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  // ── 集計 ─────────────────────────────────────────
  const totalSpend   = rows.reduce((s, r) => s + Number(r.ad_spend),   0);
  const totalActualCv = rows.reduce((s, r) => s + Number(r.actual_cv), 0);
  const totalClicks   = rows.reduce((s, r) => s + Number(r.clicks),    0);
  const totalImpressions = rows.reduce((s, r) => s + Number(r.impressions), 0);
  const avgCpa = totalActualCv > 0 ? Math.round(totalSpend / totalActualCv) : null;
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : null;
  const avgCvr = totalClicks > 0 ? totalActualCv / totalClicks * 100 : null;

  // 媒体別集計
  const mediumMap: Record<string, { spend: number; actual_cv: number; clicks: number; impressions: number; dashboard_cv: number }> = {};
  rows.forEach((r) => {
    if (!mediumMap[r.medium]) mediumMap[r.medium] = { spend: 0, actual_cv: 0, clicks: 0, impressions: 0, dashboard_cv: 0 };
    mediumMap[r.medium].spend       += Number(r.ad_spend);
    mediumMap[r.medium].actual_cv   += Number(r.actual_cv);
    mediumMap[r.medium].clicks      += Number(r.clicks);
    mediumMap[r.medium].impressions += Number(r.impressions);
    mediumMap[r.medium].dashboard_cv += Number(r.dashboard_cv);
  });

  const mediumSummary = Object.entries(mediumMap).map(([medium, d]) => ({
    medium,
    ...d,
    cpa: d.actual_cv > 0 ? Math.round(d.spend / d.actual_cv) : null,
    ctr: d.impressions > 0 ? +(d.clicks / d.impressions * 100).toFixed(2) : null,
    cvr: d.clicks > 0 ? +(d.actual_cv / d.clicks * 100).toFixed(2) : null,
  }));

  // 日別推移グラフ用
  const dailyMap: Record<string, { date: string; spend: number; cv: number }> = {};
  rows.forEach((r) => {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date.slice(0, 10), spend: 0, cv: 0 };
    dailyMap[r.date].spend += Number(r.ad_spend);
    dailyMap[r.date].cv    += Number(r.actual_cv);
  });
  const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // CSV
  function downloadCSV() {
    const header = ["日付","媒体","消化広告費","管理画面CV","実CV","クリック数","表示回数","CPA","CTR(%)","CVR(%)"];
    const csvRows = rows.map((r) => {
      const c = calc(r);
      return [
        r.date.slice(0, 10), r.medium,
        r.ad_spend, r.dashboard_cv, r.actual_cv, r.clicks, r.impressions,
        c.cpa ?? "", c.ctr != null ? c.ctr.toFixed(2) : "", c.cvr != null ? c.cvr.toFixed(2) : "",
      ];
    });
    const csv = [header, ...csvRows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ad_metrics_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
  }

  const periodActions = (
    <div className="flex items-center gap-2">
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
        {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y}>{y}</option>)}
      </select>
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
      </select>
      {rows.length > 0 && (
        <button onClick={downloadCSV}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 transition-colors">
          <Download size={14} /> CSV
        </button>
      )}
    </div>
  );

  return (
    <AppLayout title="広告数値管理" actions={periodActions}>

      {/* ── 広告代理店 簡易入力 ── */}
      {canEdit && <AgencyForm onSaved={fetchData} />}

      {/* ── Meta CSVインポート ── */}
      {canEdit && <MetaCsvImport onImported={fetchData} />}

      {/* ── リード管理シート 実CV連携 ── */}
      {canEdit && <SheetCvPanel year={year} month={month} onSynced={fetchData} />}

      {/* ── 入力フォーム ── */}
      {canEdit && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Megaphone size={16} className="text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              {year}年{month}月 広告数値入力
              <span className="text-xs font-normal text-gray-400 ml-2">※同日・同媒体のデータは上書き保存されます</span>
            </h3>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
            <Field label="日付">
              <input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputCls} />
            </Field>
            <Field label="媒体">
              <select value={form.medium}
                onChange={(e) => setForm({ ...form, medium: e.target.value })}
                className={inputCls}>
                {MEDIUMS.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="消化広告費（円）">
              <input type="number" min={0} value={form.adSpend}
                onChange={(e) => setForm({ ...form, adSpend: Number(e.target.value) })}
                className={inputCls} />
            </Field>
            <Field label="管理画面CV">
              <input type="number" min={0} value={form.dashboardCv}
                onChange={(e) => setForm({ ...form, dashboardCv: Number(e.target.value) })}
                className={inputCls} />
            </Field>
            <Field label="実CV">
              <input type="number" min={0} value={form.actualCv}
                onChange={(e) => setForm({ ...form, actualCv: Number(e.target.value) })}
                className={inputCls} />
            </Field>
            <Field label="クリック数">
              <input type="number" min={0} value={form.clicks}
                onChange={(e) => setForm({ ...form, clicks: Number(e.target.value) })}
                className={inputCls} />
            </Field>
            <Field label="表示回数">
              <input type="number" min={0} value={form.impressions}
                onChange={(e) => setForm({ ...form, impressions: Number(e.target.value) })}
                className={inputCls} />
            </Field>
          </div>

          {/* プレビュー計算結果 */}
          <div className="bg-indigo-50 rounded-xl px-5 py-4 flex flex-wrap gap-6 mb-5">
            <p className="text-xs font-semibold text-indigo-400 w-full">自動計算プレビュー</p>
            {[
              { label: "CPA", value: form.actualCv > 0 ? `¥${Math.round(form.adSpend / form.actualCv).toLocaleString()}` : "—" },
              { label: "CTR", value: form.impressions > 0 ? `${(form.clicks / form.impressions * 100).toFixed(2)}%` : "—" },
              { label: "CVR", value: form.clicks > 0 ? `${(form.actualCv / form.clicks * 100).toFixed(2)}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-indigo-400">{label}</p>
                <p className="text-lg font-bold text-indigo-700">{value}</p>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
            {saved ? "保存済み ✓" : saving ? "保存中..." : "保存する"}
          </button>
        </form>
      )}

      {/* ── KPIカード ── */}
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard label="消化広告費合計" value={`¥${totalSpend.toLocaleString()}`}
              sub={`${rows.length}件のデータ`}
              icon={DollarSign} iconBg="bg-amber-50" iconColor="text-amber-600" />
            <KPICard label="平均CPA" value={avgCpa ? `¥${avgCpa.toLocaleString()}` : "—"}
              sub={`実CV合計 ${totalActualCv}件`}
              icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
            <KPICard label="平均CTR" value={fmt(avgCtr, "%")}
              sub={`クリック ${totalClicks.toLocaleString()}回`}
              icon={MousePointerClick} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <KPICard label="平均CVR" value={fmt(avgCvr, "%")}
              sub={`表示回数 ${totalImpressions.toLocaleString()}回`}
              icon={Megaphone} iconBg="bg-purple-50" iconColor="text-purple-600" />
          </div>

          {/* ── グラフ ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">日別 消化広告費</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    formatter={(v) => `¥${Number(v).toLocaleString()}`} />
                  <Bar dataKey="spend" name="消化広告費" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">日別 実CV推移</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                  <Line type="monotone" dataKey="cv" name="実CV" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 媒体別サマリー ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">媒体別サマリー</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {["媒体","消化広告費","管理画面CV","実CV","クリック","表示回数","CPA","CTR","CVR"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mediumSummary.map((m) => (
                  <tr key={m.medium} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MEDIUM_COLOR[m.medium] ?? "#94A3B8" }} />
                        <span className="font-semibold text-gray-800">{m.medium}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-700">¥{m.spend.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-gray-600">{m.dashboard_cv}</td>
                    <td className="px-4 py-3.5 text-gray-600">{m.actual_cv}</td>
                    <td className="px-4 py-3.5 text-gray-600">{m.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-gray-600">{m.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${m.cpa != null ? "text-indigo-600" : "text-gray-300"}`}>
                        {m.cpa != null ? `¥${m.cpa.toLocaleString()}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${m.ctr != null ? "text-emerald-600" : "text-gray-300"}`}>
                        {m.ctr != null ? `${m.ctr}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${m.cvr != null ? "text-amber-600" : "text-gray-300"}`}>
                        {m.cvr != null ? `${m.cvr}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 日別詳細テーブル ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">日別詳細データ</h3>
              <span className="text-xs text-gray-400">{rows.length}件</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {["日付","媒体","消化広告費","管理画面CV","実CV","クリック","表示回数",
                      "CPA（自動）","CTR（自動）","CVR（自動）",""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = calc(r);
                    return (
                      <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{r.date.slice(0, 10)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MEDIUM_COLOR[r.medium] ?? "#94A3B8" }} />
                            {r.medium}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-gray-700">¥{Number(r.ad_spend).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-gray-600">{r.dashboard_cv}</td>
                        <td className="px-4 py-3.5 text-gray-600">{r.actual_cv}</td>
                        <td className="px-4 py-3.5 text-gray-600">{Number(r.clicks).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-gray-600">{Number(r.impressions).toLocaleString()}</td>
                        {/* 自動計算 */}
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-indigo-600">
                            {c.cpa != null ? `¥${c.cpa.toLocaleString()}` : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-emerald-600">
                            {c.ctr != null ? `${c.ctr.toFixed(2)}%` : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-amber-600">
                            {c.cvr != null ? `${c.cvr.toFixed(2)}%` : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {isAdmin && (
                            <button onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <Megaphone size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {year}年{month}月のデータがありません。<br />上のフォームから入力してください。
          </p>
        </div>
      )}
    </AppLayout>
  );
}
