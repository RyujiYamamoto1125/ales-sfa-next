"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import {
  Plus, Filter, Download, ChevronDown, ChevronUp,
  Mail, Phone, User, Calendar, FileCheck, TrendingUp,
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

const APPOINTER_OPTIONS = ["荒木", "直申し込み"];

// ── 型 ─────────────────────────────────────────────
interface CaseData {
  id: string;
  customer_name: string;
  contact_person?: string;
  email_address?: string;
  phone?: string;
  status: string;
  next_meeting?: string;
  sales_person?: string;
  appointer?: string;
  notes?: string;
  initial_fee?: number;
  monthly_fee?: number;
  contract_return_date?: string;
  first_deduction_date?: string;
  contracted_at?: string;
  created_at: string;
}

// ── フォーム初期値 ─────────────────────────────────
const EMPTY_ADD = {
  customerName: "", contactPerson: "", emailAddress: "",
  phone: "", appointer: "荒木", nextMeeting: "", notes: "",
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
  const [tab, setTab]         = useState<"list" | "add">("list");
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
        customerName:  c.customer_name,
        contactPerson: c.contact_person  ?? "",
        emailAddress:  c.email_address   ?? "",
        phone:         c.phone           ?? "",
        appointer:     c.appointer       ?? APPOINTER_OPTIONS[0],
        nextMeeting:   c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
        notes:         c.notes           ?? "",
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
        customerName:        c.customer_name,
        contactPerson:       c.contact_person  ?? "",
        emailAddress:        c.email_address   ?? "",
        phone:               c.phone           ?? "",
        status:              c.status,
        nextMeeting:         c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
        salesPerson:         c.sales_person   ?? "",
        appointer:           c.appointer      ?? "",
        notes:               c.notes          ?? "",
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

  const headerActions = isAppointer ? (
    <button onClick={() => setTab("add")}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
      <Plus size={15} /> 新規登録
    </button>
  ) : undefined;

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
            <Field label={<>顧客名 <span className="text-red-400">*</span></>}>
              <input required value={addForm.customerName}
                onChange={(e) => setAddForm({ ...addForm, customerName: e.target.value })}
                placeholder="株式会社〇〇" className={inputCls} />
            </Field>
            <Field label="担当者名">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={addForm.contactPerson}
                  onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                  placeholder="山田 太郎" className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="メールアドレス">
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={addForm.emailAddress}
                  onChange={(e) => setAddForm({ ...addForm, emailAddress: e.target.value })}
                  placeholder="example@company.com" className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="電話番号">
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="090-1234-5678" className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="アポインター名">
              <select value={addForm.appointer}
                onChange={(e) => setAddForm({ ...addForm, appointer: e.target.value })}
                className={inputCls}>
                {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="商談日時">
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="datetime-local" value={addForm.nextMeeting}
                  onChange={(e) => setAddForm({ ...addForm, nextMeeting: e.target.value })}
                  className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <div className="md:col-span-2">
              <Field label="会話メモ">
                <textarea value={addForm.notes} rows={4}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="商談内容・顧客の状況・ポイントなど"
                  className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <div className="md:col-span-2 flex gap-3">
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
  customerName: string; contactPerson: string; emailAddress: string; phone: string;
  status: string; nextMeeting: string; salesPerson: string; appointer: string; notes: string;
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
        <Field label="顧客名">
          <input value={form.customerName ?? ""} onChange={(e) => onChange("customerName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="担当者名">
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.contactPerson ?? ""} onChange={(e) => onChange("contactPerson", e.target.value)} className={`${inputCls} pl-8`} />
          </div>
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
        <Field label="アポインター名">
          <select value={form.appointer ?? APPOINTER_OPTIONS[0]} onChange={(e) => onChange("appointer", e.target.value)} className={inputCls}>
            {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="商談日時">
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="datetime-local" value={form.nextMeeting ?? ""} onChange={(e) => onChange("nextMeeting", e.target.value)} className={`${inputCls} pl-8`} />
          </div>
        </Field>
        <div className="md:col-span-2 lg:col-span-3">
          <Field label="会話メモ">
            <textarea value={form.notes ?? ""} rows={3} onChange={(e) => onChange("notes", e.target.value)} className={`${inputCls} resize-none`} />
          </Field>
        </div>
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
          <InfoItem label="顧客名"   value={caseData.customer_name} />
          <InfoItem label="担当者名" value={caseData.contact_person} />
          <InfoItem label="メール"   value={caseData.email_address} icon={<Mail size={12} className="text-gray-400" />} />
          <InfoItem label="電話"     value={caseData.phone}         icon={<Phone size={12} className="text-gray-400" />} />
          <InfoItem label="アポインター" value={caseData.appointer} />
          <InfoItem label="商談日時" value={caseData.next_meeting ? new Date(caseData.next_meeting).toLocaleString("ja-JP") : ""} />
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
        <Field label="顧客名">
          <input value={form.customerName} onChange={(e) => onChange("customerName", e.target.value)} className={inputCls} />
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
        <Field label="アポインター名">
          <select value={form.appointer} onChange={(e) => onChange("appointer", e.target.value)} className={inputCls}>
            {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="商談日時">
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
        <div className="md:col-span-2 lg:col-span-3">
          <Field label="会話メモ">
            <textarea value={form.notes} rows={3} onChange={(e) => onChange("notes", e.target.value)} className={`${inputCls} resize-none`} />
          </Field>
        </div>
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
