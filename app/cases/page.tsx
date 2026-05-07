"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import Papa from "papaparse";
import {
  Plus, Filter, Download, ChevronDown, ChevronUp,
  Mail, Phone, User, Calendar, FileCheck, TrendingUp,
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";

// ── 定数 ─────────────────────────────────────────────
const ALL_STATUSES = [
  "未実行","見込み（高）","見込み（中）","見込み（低）","NG","不参加","申し込みフォーム返送待ち","契約",
];

/** 営業マンが選べる商談結果 */
const RESULT_OPTIONS = [
  { value: "契約",      label: "契約",       color: "bg-cyan-100 text-cyan-700"    },
  { value: "見込み（高）", label: "見込み（高）", color: "bg-indigo-100 text-indigo-700" },
  { value: "見込み（中）", label: "見込み（中）", color: "bg-emerald-100 text-emerald-700" },
  { value: "見込み（低）", label: "見込み（低）", color: "bg-amber-100 text-amber-700" },
  { value: "NG",        label: "NG",         color: "bg-red-100 text-red-600"      },
  { value: "不参加",    label: "不参加",     color: "bg-gray-100 text-gray-500"    },
];

const STATUS_STYLE: Record<string, string> = {
  "未実行":                    "bg-slate-100 text-slate-500",
  "見込み（高）":              "bg-indigo-100 text-indigo-700",
  "見込み（中）":              "bg-emerald-100 text-emerald-700",
  "見込み（低）":              "bg-amber-100 text-amber-700",
  "申し込みフォーム返送待ち":  "bg-purple-100 text-purple-700",
  "NG":                        "bg-red-100 text-red-600",
  "不参加":                    "bg-gray-100 text-gray-500",
  "契約":                      "bg-cyan-100 text-cyan-700",
};

const APPOINTER_OPTIONS = ["荒木", "直申し込み", "メルマガ", "ウェビナー"];

const LEAD_SOURCE_OPTIONS = [
  "過去リード",
  "エモロジー（代理店）",
  "自社広告（LP）",
  "自社広告（インスタントフォーム）",
  "代理店",
  "ウェビナー",
];

// ── 型 ─────────────────────────────────────────────
interface CaseData {
  id: string;
  lead_source?: string;
  document_request_date?: string;
  customer_name: string;
  position?: string;
  furigana?: string;
  contact_person?: string;
  email_address?: string;
  phone?: string;
  notes?: string;
  appointer?: string;
  next_meeting?: string;
  status: string;
  sales_person?: string;
  initial_fee?: number;
  monthly_fee?: number;
  contract_return_date?: string;
  first_deduction_date?: string;
  contracted_at?: string;
  created_at: string;
}

// ── フォーム初期値 ─────────────────────────────────
const EMPTY_ADD = {
  leadSource: "", documentRequestDate: "",
  customerName: "", position: "", furigana: "",
  emailAddress: "", phone: "", notes: "",
  appointer: "荒木", nextMeeting: "",
};

// ── スタイル ───────────────────────────────────────
const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── メイン ─────────────────────────────────────────
export default function CasesPage() {
  const { data: session } = useSession();
  const role        = session?.user?.role ?? "sales";
  const isAdmin     = role === "admin";
  const isSales     = role === "sales";
  const isAppointer = role === "appointer";

  const [cases, setCases]   = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"list" | "add" | "import">("list");
  const [filterStatus, setFilterStatus]       = useState("すべて");
  const [filterAppointer, setFilterAppointer] = useState("");
  const [filterSales, setFilterSales]         = useState("");
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [saving, setSaving]                   = useState(false);

  // アポインター編集フォーム
  const [apoEdit, setApoEdit] = useState<Record<string, string | number>>({});
  // 営業マン結果入力フォーム（案件IDごと）
  const [salesForms, setSalesForm] = useState<Record<string, SalesForm>>({});
  // 管理者全フィールド編集フォーム
  const [adminEdit, setAdminEdit] = useState<AdminForm | null>(null);

  function fetchCases() {
    return fetch("/api/cases").then((r) => r.json()).then((d) => {
      setCases(d);
      setLoading(false);
    });
  }
  useEffect(() => { fetchCases(); }, []);

  const filtered = cases.filter((c) => {
    if (filterStatus !== "すべて" && c.status !== filterStatus) return false;
    if (filterAppointer && !c.appointer?.includes(filterAppointer)) return false;
    if (filterSales && !c.sales_person?.includes(filterSales)) return false;
    return true;
  });

  function toggleExpand(c: CaseData) {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);

    if (isAppointer) {
      setApoEdit({
        leadSource:           c.lead_source    ?? "",
        documentRequestDate:  c.document_request_date ? c.document_request_date.slice(0, 10) : "",
        customerName:         c.customer_name,
        position:             c.position       ?? "",
        furigana:             c.furigana       ?? "",
        emailAddress:         c.email_address  ?? "",
        phone:                c.phone          ?? "",
        notes:                c.notes          ?? "",
        appointer:            c.appointer      ?? APPOINTER_OPTIONS[0],
        nextMeeting:          c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
      });
    }
    if (isSales) {
      const existing = salesForms[c.id];
      if (!existing) {
        setSalesForm((prev) => ({
          ...prev,
          [c.id]: {
            status:             c.status === "未実行" || c.status === "不参加" ? "" : c.status,
            salesPerson:        c.sales_person ?? session?.user?.name ?? "",
            initialFee:         c.initial_fee ?? 0,
            monthlyFee:         c.monthly_fee ?? 0,
            contractReturnDate: c.contract_return_date ? c.contract_return_date.slice(0, 10) : "",
            firstDeductionDate: c.first_deduction_date ? c.first_deduction_date.slice(0, 10) : "",
          },
        }));
      }
    }
    if (isAdmin) {
      setAdminEdit({
        leadSource:          c.lead_source    ?? "",
        documentRequestDate: c.document_request_date ? c.document_request_date.slice(0, 10) : "",
        customerName:        c.customer_name,
        position:            c.position       ?? "",
        furigana:            c.furigana       ?? "",
        contactPerson:       c.contact_person ?? "",
        emailAddress:        c.email_address  ?? "",
        phone:               c.phone          ?? "",
        notes:               c.notes          ?? "",
        appointer:           c.appointer      ?? "",
        nextMeeting:         c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
        status:              c.status,
        salesPerson:         c.sales_person   ?? "",
        initialFee:          c.initial_fee    ?? 0,
        monthlyFee:          c.monthly_fee    ?? 0,
        contractReturnDate:  c.contract_return_date ? c.contract_return_date.slice(0, 10) : "",
        firstDeductionDate:  c.first_deduction_date ? c.first_deduction_date.slice(0, 10) : "",
      });
    }
  }

  // ── 保存（アポインター） ──
  async function saveApo(id: string) {
    setSaving(true);
    await fetch(`/api/cases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apoEdit) });
    setExpandedId(null);
    await fetchCases();
    setSaving(false);
  }

  // ── 保存（営業マン） ──
  async function saveSales(id: string) {
    setSaving(true);
    await fetch(`/api/cases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(salesForms[id]) });
    setExpandedId(null);
    await fetchCases();
    setSaving(false);
  }

  // ── 保存（管理者） ──
  async function saveAdmin(id: string) {
    setSaving(true);
    await fetch(`/api/cases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminEdit) });
    setExpandedId(null);
    await fetchCases();
    setSaving(false);
  }

  // ── 削除 ──
  async function handleDelete(id: string) {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    fetchCases();
  }

  // ── 新規登録（アポインター） ──
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addForm) });
    setAddForm(EMPTY_ADD);
    await fetchCases();
    setSaving(false);
    setTab("list");
  }

  // ── CSV ──
  function downloadCSV() {
    const header = ["顧客名","担当者名","メール","電話","ステータス","商談日時","営業担当","アポインター","会話メモ","初期費用","月額","契約書返送日","初回引落日","登録日"];
    const rows = filtered.map((c) => [
      c.customer_name, c.contact_person ?? "", c.email_address ?? "", c.phone ?? "",
      c.status, c.next_meeting ? new Date(c.next_meeting).toLocaleString("ja-JP") : "",
      c.sales_person ?? "", c.appointer ?? "", c.notes ?? "",
      c.initial_fee ?? 0, c.monthly_fee ?? 0,
      c.contract_return_date ?? "", c.first_deduction_date ?? "",
      new Date(c.created_at).toLocaleDateString("ja-JP"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sfa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      {isAppointer && (
        <button onClick={() => setTab("add")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
          <Plus size={15} /> 新規登録
        </button>
      )}
      {isAdmin && (
        <button onClick={() => setTab("import")}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
          <Upload size={15} /> CSVインポート
        </button>
      )}
    </div>
  );

  return (
    <AppLayout title="案件管理" actions={headerActions}>
      {/* タブ */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 w-fit mb-6 shadow-sm border border-gray-100">
        <button onClick={() => setTab("list")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === "list" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
          案件一覧
        </button>
          {isAppointer && (
          <button onClick={() => setTab("add")}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === "add" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            新規登録
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setTab("import")}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === "import" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            CSVインポート
          </button>
        )}
      </div>

      {/* ══════ 案件一覧 ══════ */}
      {tab === "list" && (
        <>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3 items-center">
            <Filter size={15} className="text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="すべて">すべてのステータス</option>
              {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="アポインターで絞り込み" value={filterAppointer}
              onChange={(e) => setFilterAppointer(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            {!isAppointer && (
              <input placeholder="営業担当者で絞り込み" value={filterSales}
                onChange={(e) => setFilterSales(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            )}
            <div className="flex-1" />
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">{filtered.length} 件</span>
            {(isAdmin || isSales) && (
              <button onClick={downloadCSV}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-600 transition-colors border border-gray-200">
                <Download size={14} /> CSV
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
              <p className="text-gray-400">該当する案件がありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* カードヘッダー */}
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(c)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <span className="text-indigo-700 font-bold text-sm">{c.customer_name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                          {c.contact_person && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <User size={11} />{c.contact_person}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {c.next_meeting && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(c.next_meeting).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                            </span>
                          )}
                          {c.appointer && <span className="text-xs text-gray-400">アポ: {c.appointer}</span>}
                          {c.lead_source && <span className="text-xs bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-md">{c.lead_source}</span>}
                          {c.sales_person && <span className="text-xs text-gray-400">営業: {c.sales_person}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {c.status}
                      </span>
                      {expandedId === c.id
                        ? <ChevronUp size={15} className="text-gray-400" />
                        : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </div>

                  {/* ── 展開パネル：アポインター ── */}
                  {expandedId === c.id && isAppointer && (
                    <ApoPanel
                      form={apoEdit as Record<string, string>}
                      onChange={(k, v) => setApoEdit((p) => ({ ...p, [k]: v }))}
                      onSave={() => saveApo(c.id)}
                      onCancel={() => setExpandedId(null)}
                      saving={saving}
                    />
                  )}

                  {/* ── 展開パネル：営業マン ── */}
                  {expandedId === c.id && isSales && (
                    <SalesPanel
                      caseData={c}
                      form={salesForms[c.id] ?? initSalesForm(c, session?.user?.name ?? "")}
                      onChange={(k, v) => setSalesForm((p) => ({ ...p, [c.id]: { ...p[c.id], [k]: v } }))}
                      onSave={() => saveSales(c.id)}
                      onCancel={() => setExpandedId(null)}
                      saving={saving}
                    />
                  )}

                  {/* ── 展開パネル：管理者 ── */}
                  {expandedId === c.id && isAdmin && adminEdit && (
                    <AdminPanel
                      form={adminEdit}
                      onChange={(k, v) => setAdminEdit((p) => p ? { ...p, [k]: v } : p)}
                      onSave={() => saveAdmin(c.id)}
                      onDelete={() => handleDelete(c.id)}
                      onCancel={() => setExpandedId(null)}
                      saving={saving}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════ 新規登録（アポインターのみ） ══════ */}
      {tab === "add" && isAppointer && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-2xl">
          <h3 className="text-base font-semibold text-gray-700 mb-5">新規案件登録</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 1. 流入経路（必須） */}
            <Field label={<>流入経路 <span className="text-red-400">*</span></>}>
              <select required value={addForm.leadSource}
                onChange={(e) => setAddForm({ ...addForm, leadSource: e.target.value })}
                className={inputCls}>
                <option value="">選択してください</option>
                {LEAD_SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            {/* 2. 資料請求日（任意） */}
            <Field label="資料請求日">
              <input type="date" value={addForm.documentRequestDate}
                onChange={(e) => setAddForm({ ...addForm, documentRequestDate: e.target.value })}
                className={inputCls} />
            </Field>

            {/* 3. 会社名（必須） */}
            <Field label={<>会社名 <span className="text-red-400">*</span></>}>
              <input required value={addForm.customerName}
                onChange={(e) => setAddForm({ ...addForm, customerName: e.target.value })}
                placeholder="株式会社〇〇" className={inputCls} />
            </Field>

            {/* 4. 役職（任意） */}
            <Field label="役職">
              <input value={addForm.position}
                onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
                placeholder="代表取締役、営業部長 など（任意）" className={inputCls} />
            </Field>

            {/* 5. ふりがな（任意） */}
            <Field label="ふりがな">
              <input value={addForm.furigana}
                onChange={(e) => setAddForm({ ...addForm, furigana: e.target.value })}
                placeholder="かぶしきがいしゃ〇〇（任意）" className={inputCls} />
            </Field>

            {/* 6. メールアドレス（必須） */}
            <Field label={<>メールアドレス <span className="text-red-400">*</span></>}>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required type="email" value={addForm.emailAddress}
                  onChange={(e) => setAddForm({ ...addForm, emailAddress: e.target.value })}
                  placeholder="example@company.com" className={`${inputCls} pl-8`} />
              </div>
            </Field>

            {/* 7. 電話番号（必須） */}
            <Field label={<>電話番号 <span className="text-red-400">*</span></>}>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required type="tel" value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="090-1234-5678" className={`${inputCls} pl-8`} />
              </div>
            </Field>

            {/* 8. 会話メモ（任意・全幅） */}
            <div className="md:col-span-2">
              <Field label="会話メモ">
                <textarea value={addForm.notes} rows={3}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="商談内容・顧客の状況・ポイントなど（任意）"
                  className={`${inputCls} resize-none`} />
              </Field>
            </div>

            {/* 9. アポ取得者（必須・常に値あり） */}
            <Field label={<>アポ取得者 <span className="text-red-400">*</span></>}>
              <select required value={addForm.appointer}
                onChange={(e) => setAddForm({ ...addForm, appointer: e.target.value })}
                className={inputCls}>
                {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>

            {/* 10. 初回商談日時（必須） */}
            <Field label={<>初回商談日時 <span className="text-red-400">*</span></>}>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required type="datetime-local" value={addForm.nextMeeting}
                  onChange={(e) => setAddForm({ ...addForm, nextMeeting: e.target.value })}
                  className={`${inputCls} pl-8`} />
              </div>
            </Field>

            <div className="md:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "登録中..." : "登録する"}
              </button>
              <button type="button" onClick={() => setTab("list")}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════ CSVインポート（管理者のみ） ══════ */}
      {tab === "import" && isAdmin && (
        <CsvImportPanel onImported={() => { fetchCases(); setTab("list"); }} />
      )}
    </AppLayout>
  );
}

// ── 型定義 ───────────────────────────────────────────
interface SalesForm {
  status: string; salesPerson: string;
  initialFee: number; monthlyFee: number;
  contractReturnDate: string; firstDeductionDate: string;
}
interface AdminForm {
  leadSource: string; documentRequestDate: string;
  customerName: string; position: string; furigana: string; contactPerson: string;
  emailAddress: string; phone: string; notes: string;
  appointer: string; nextMeeting: string;
  status: string; salesPerson: string;
  initialFee: number; monthlyFee: number; contractReturnDate: string; firstDeductionDate: string;
}

function initSalesForm(c: CaseData, name: string): SalesForm {
  return {
    status:             ["未実行","不参加"].includes(c.status) ? "" : c.status,
    salesPerson:        c.sales_person ?? name,
    initialFee:         c.initial_fee         ?? 0,
    monthlyFee:         c.monthly_fee         ?? 0,
    contractReturnDate: c.contract_return_date ? c.contract_return_date.slice(0, 10) : "",
    firstDeductionDate: c.first_deduction_date ? c.first_deduction_date.slice(0, 10) : "",
  };
}

// ── アポインター編集パネル ────────────────────────────
function ApoPanel({ form, onChange, onSave, onCancel, saving }: {
  form: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">アポ情報を編集</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Field label="流入経路">
          <select value={form.leadSource ?? ""} onChange={(e) => onChange("leadSource", e.target.value)} className={inputCls}>
            <option value="">選択してください</option>
            {LEAD_SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="資料請求日">
          <input type="date" value={form.documentRequestDate ?? ""} onChange={(e) => onChange("documentRequestDate", e.target.value)} className={inputCls} />
        </Field>
        <Field label="会社名">
          <input value={form.customerName ?? ""} onChange={(e) => onChange("customerName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="役職">
          <input value={form.position ?? ""} onChange={(e) => onChange("position", e.target.value)} placeholder="代表取締役 など" className={inputCls} />
        </Field>
        <Field label="ふりがな">
          <input value={form.furigana ?? ""} onChange={(e) => onChange("furigana", e.target.value)} placeholder="かぶしきがいしゃ〇〇" className={inputCls} />
        </Field>
        <Field label="メールアドレス">
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="email" value={form.emailAddress ?? ""} onChange={(e) => onChange("emailAddress", e.target.value)} className={`${inputCls} pl-8`} />
          </div>
        </Field>
        <Field label="電話番号">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="tel" value={form.phone ?? ""} onChange={(e) => onChange("phone", e.target.value)} className={`${inputCls} pl-8`} />
          </div>
        </Field>
        <div className="md:col-span-2 lg:col-span-3">
          <Field label="会話メモ">
            <textarea value={form.notes ?? ""} rows={3} onChange={(e) => onChange("notes", e.target.value)} className={`${inputCls} resize-none`} />
          </Field>
        </div>
        <Field label="アポ取得者">
          <select value={form.appointer ?? APPOINTER_OPTIONS[0]} onChange={(e) => onChange("appointer", e.target.value)} className={inputCls}>
            {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="初回商談日時">
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="datetime-local" value={form.nextMeeting ?? ""} onChange={(e) => onChange("nextMeeting", e.target.value)} className={`${inputCls} pl-8`} />
          </div>
        </Field>
      </div>
      <PanelActions onSave={onSave} onCancel={onCancel} saving={saving} />
    </div>
  );
}

// ── 営業マン結果入力パネル ────────────────────────────
function SalesPanel({ caseData, form, onChange, onSave, onCancel, saving }: {
  caseData: CaseData; form: SalesForm;
  onChange: (k: string, v: string | number) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const isContract = form.status === "契約";

  return (
    <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
      {/* 顧客情報（読み取り専用） */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">顧客情報（アポインター入力済み）</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <InfoItem label="流入経路"   value={caseData.lead_source} />
          <InfoItem label="資料請求日" value={caseData.document_request_date ? caseData.document_request_date.slice(0,10) : ""} />
          <InfoItem label="会社名"     value={caseData.customer_name} />
          <InfoItem label="役職"       value={caseData.position} />
          <InfoItem label="ふりがな"   value={caseData.furigana} />
          <InfoItem label="メール"     value={caseData.email_address} icon={<Mail size={12} className="text-gray-400" />} />
          <InfoItem label="電話"       value={caseData.phone} icon={<Phone size={12} className="text-gray-400" />} />
          <InfoItem label="アポ取得者" value={caseData.appointer} />
          <InfoItem label="初回商談日時" value={caseData.next_meeting ? new Date(caseData.next_meeting).toLocaleString("ja-JP") : ""} />
        </div>
        {caseData.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">会話メモ</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{caseData.notes}</p>
          </div>
        )}
      </div>

      {/* 結果入力 */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
        <TrendingUp size={13} /> 商談結果を入力
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Field label="担当営業名">
            <input value={form.salesPerson} onChange={(e) => onChange("salesPerson", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div>
          <Field label={<>商談結果 <span className="text-red-400">*</span></>}>
            <div className="flex flex-wrap gap-2">
              {RESULT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => onChange("status", opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    form.status === opt.value
                      ? `${opt.color} border-transparent ring-2 ring-indigo-400 ring-offset-1`
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* 契約詳細（契約選択時のみ） */}
      {isContract && (
        <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-cyan-700 flex items-center gap-1.5 mb-4">
            <FileCheck size={14} /> 契約詳細
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="初期費用（円）">
              <input type="number" min={0} value={form.initialFee}
                onChange={(e) => onChange("initialFee", Number(e.target.value))}
                placeholder="0" className={inputCls} />
            </Field>
            <Field label="月額費用（円）">
              <input type="number" min={0} value={form.monthlyFee}
                onChange={(e) => onChange("monthlyFee", Number(e.target.value))}
                placeholder="0" className={inputCls} />
            </Field>
            <Field label="契約書の返送日">
              <input type="date" value={form.contractReturnDate}
                onChange={(e) => onChange("contractReturnDate", e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="初回月額の引き落とし日">
              <input type="date" value={form.firstDeductionDate}
                onChange={(e) => onChange("firstDeductionDate", e.target.value)}
                className={inputCls} />
            </Field>
          </div>
        </div>
      )}

      <PanelActions onSave={onSave} onCancel={onCancel} saving={saving} saveDisabled={!form.status} />
    </div>
  );
}

// ── 管理者全編集パネル ────────────────────────────────
function AdminPanel({ form, onChange, onSave, onDelete, onCancel, saving }: {
  form: AdminForm;
  onChange: (k: string, v: string | number) => void;
  onSave: () => void; onDelete: () => void; onCancel: () => void; saving: boolean;
}) {
  const isContract = form.status === "契約";
  return (
    <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">全フィールド編集（管理者）</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Field label="流入経路">
          <select value={form.leadSource} onChange={(e) => onChange("leadSource", e.target.value)} className={inputCls}>
            <option value="">選択してください</option>
            {LEAD_SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="資料請求日">
          <input type="date" value={form.documentRequestDate} onChange={(e) => onChange("documentRequestDate", e.target.value)} className={inputCls} />
        </Field>
        <Field label="会社名">
          <input value={form.customerName} onChange={(e) => onChange("customerName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="役職">
          <input value={form.position} onChange={(e) => onChange("position", e.target.value)} className={inputCls} />
        </Field>
        <Field label="ふりがな">
          <input value={form.furigana} onChange={(e) => onChange("furigana", e.target.value)} className={inputCls} />
        </Field>
        <Field label="担当者名">
          <input value={form.contactPerson} onChange={(e) => onChange("contactPerson", e.target.value)} className={inputCls} />
        </Field>
        <Field label="メールアドレス">
          <input type="email" value={form.emailAddress} onChange={(e) => onChange("emailAddress", e.target.value)} className={inputCls} />
        </Field>
        <Field label="電話番号">
          <input type="tel" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} className={inputCls} />
        </Field>
        <div className="md:col-span-2 lg:col-span-3">
          <Field label="会話メモ">
            <textarea value={form.notes} rows={3} onChange={(e) => onChange("notes", e.target.value)} className={`${inputCls} resize-none`} />
          </Field>
        </div>
        <Field label="アポ取得者">
          <select value={form.appointer} onChange={(e) => onChange("appointer", e.target.value)} className={inputCls}>
            {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="初回商談日時">
          <input type="datetime-local" value={form.nextMeeting} onChange={(e) => onChange("nextMeeting", e.target.value)} className={inputCls} />
        </Field>
        <Field label="ステータス">
          <select value={form.status} onChange={(e) => onChange("status", e.target.value)} className={inputCls}>
            {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="営業担当者名">
          <input value={form.salesPerson} onChange={(e) => onChange("salesPerson", e.target.value)} className={inputCls} />
        </Field>
        {isContract && (
          <>
            <Field label="初期費用（円）">
              <input type="number" min={0} value={form.initialFee} onChange={(e) => onChange("initialFee", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="月額費用（円）">
              <input type="number" min={0} value={form.monthlyFee} onChange={(e) => onChange("monthlyFee", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="契約書の返送日">
              <input type="date" value={form.contractReturnDate} onChange={(e) => onChange("contractReturnDate", e.target.value)} className={inputCls} />
            </Field>
            <Field label="初回月額の引き落とし日">
              <input type="date" value={form.firstDeductionDate} onChange={(e) => onChange("firstDeductionDate", e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
      </div>
      <PanelActions onSave={onSave} onCancel={onCancel} saving={saving} onDelete={onDelete} />
    </div>
  );
}

// ── 共通パーツ ────────────────────────────────────────
function InfoItem({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {icon}{value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function PanelActions({ onSave, onCancel, saving, saveDisabled, onDelete }: {
  onSave: () => void; onCancel: () => void; saving: boolean;
  saveDisabled?: boolean; onDelete?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button onClick={onSave} disabled={saving || saveDisabled}
        className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        保存する
      </button>
      {onDelete && (
        <button onClick={onDelete}
          className="px-5 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
          削除する
        </button>
      )}
      <button onClick={onCancel}
        className="px-5 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
        キャンセル
      </button>
    </div>
  );
}

// ── CSVインポートパネル ──────────────────────────────
const CSV_HEADERS = [
  "流入経路","資料請求日","会社名","役職","ふりがな","担当者名",
  "メールアドレス","電話番号","会話メモ","アポインター名","初回商談日時",
  "ステータス","営業担当者名",
  "初期費用","月額費用","売上金額","契約書返送日","初回引落日","契約日",
];

const CSV_EXAMPLE = [
  "自社広告（LP）","2026/05/01","株式会社サンプル","代表取締役","かぶしきがいしゃさんぷる","山田 太郎",
  "yamada@sample.com","090-1234-5678","見込みあり。資料送付済み。","荒木","2026/05/07 14:00",
  "契約","隅田",
  "100000","30000","","2026/05/10","2026/06/01","2026/05/07",
];

interface ImportResult {
  row: number; status: "ok" | "error"; message?: string; customerName?: string;
}

function CsvImportPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview]   = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults]   = useState<{ successCount: number; errorCount: number; results: ImportResult[] } | null>(null);

  function downloadTemplate() {
    const csv = [CSV_HEADERS, CSV_EXAMPLE].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "案件インポートテンプレート.csv";
    a.click();
  }

  function parseFile(file: File) {
    if (!file.name.endsWith(".csv")) { alert("CSVファイルを選択してください"); return; }
    setFileName(file.name);
    setResults(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (res) => setPreview(res.data),
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  async function handleImport() {
    if (!preview.length) return;
    setImporting(true);
    const res = await fetch("/api/cases/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview),
    });
    const data = await res.json();
    setResults(data);
    setImporting(false);
    if (data.successCount > 0) onImported();
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* テンプレートDL */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-emerald-600" /> CSVテンプレート
            </h3>
            <p className="text-xs text-gray-400 mb-1">下記のカラム構成で作成してください。文字コードはUTF-8推奨。</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CSV_HEADERS.map((h) => (
                <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{h}</span>
              ))}
            </div>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shrink-0 ml-4">
            <Download size={14} /> テンプレートDL
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
          <span className="font-semibold text-gray-600">ステータスの選択肢：</span>
          {" 未実行 / 見込み（高）/ 見込み（中）/ 見込み（低）/ NG / 不参加 / 申し込みフォーム返送待ち / 契約"}
        </div>
      </div>

      {/* アップロードエリア */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`bg-white rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-12 shadow-sm ${
          dragging ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
        }`}>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
        <Upload size={32} className={dragging ? "text-emerald-500" : "text-gray-300"} />
        <p className="text-sm font-medium text-gray-500 mt-3">
          {fileName ? fileName : "CSVファイルをドラッグ＆ドロップ、またはクリックして選択"}
        </p>
        <p className="text-xs text-gray-400 mt-1">UTF-8 / Shift-JIS 対応</p>
      </div>

      {/* プレビュー */}
      {preview.length > 0 && !results && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">プレビュー</h3>
              <p className="text-xs text-gray-400 mt-0.5">合計 {preview.length}件 — 先頭5件を表示</p>
            </div>
            <button onClick={handleImport} disabled={importing}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              <Upload size={14} />
              {importing ? "インポート中..." : `${preview.length}件をインポート`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {CSV_HEADERS.slice(0, 8).map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-400">…</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    {CSV_HEADERS.slice(0, 8).map((h) => (
                      <td key={h} className="px-4 py-2.5 text-gray-600 whitespace-nowrap max-w-32 truncate">
                        {row[h] || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-gray-300">…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {results && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">インポート結果</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">成功 {results.successCount}件</span>
              </div>
              {results.errorCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl">
                  <XCircle size={16} />
                  <span className="text-sm font-semibold">エラー {results.errorCount}件</span>
                </div>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {results.results.filter(r => r.status === "error").map((r) => (
              <div key={r.row} className="px-6 py-3 flex items-start gap-3">
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="text-gray-500 text-xs">行 {r.row}</span>
                  {r.customerName && <span className="ml-2 font-medium text-gray-700">{r.customerName}</span>}
                  <p className="text-red-500 text-xs mt-0.5">{r.message}</p>
                </div>
              </div>
            ))}
            {results.successCount > 0 && results.errorCount === 0 && (
              <div className="px-6 py-4 text-sm text-gray-400 text-center">
                すべてのデータを正常にインポートしました
              </div>
            )}
          </div>
          {results.successCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-50">
              <button onClick={() => { setPreview([]); setFileName(""); setResults(null); }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                続けてインポートする
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
