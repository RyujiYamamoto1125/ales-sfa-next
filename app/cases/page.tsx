"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import { Plus, Filter, Download, ChevronDown, ChevronUp, Mail, Phone, User, Calendar } from "lucide-react";

const STATUS_OPTIONS = [
  "未実行","見込み（高）","見込み（中）","見込み（低）",
  "申し込みフォーム返送待ち","NG","契約",
];

const STATUS_STYLE: Record<string, string> = {
  "未実行":                    "bg-slate-100 text-slate-600",
  "見込み（高）":              "bg-indigo-100 text-indigo-700",
  "見込み（中）":              "bg-emerald-100 text-emerald-700",
  "見込み（低）":              "bg-amber-100 text-amber-700",
  "申し込みフォーム返送待ち": "bg-purple-100 text-purple-700",
  "NG":                        "bg-red-100 text-red-600",
  "契約":                      "bg-cyan-100 text-cyan-700",
};

const APPOINTER_OPTIONS = ["荒木", "直申し込み"];

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
  amount?: number;
  contracted_at?: string;
  created_at: string;
}

const EMPTY_ADD = {
  customerName: "", contactPerson: "", emailAddress: "",
  phone: "", appointer: "荒木", nextMeeting: "", notes: "",
};

const EMPTY_EDIT = {
  customerName: "", contactPerson: "", emailAddress: "", phone: "",
  status: "未実行", nextMeeting: "", salesPerson: "", appointer: "",
  notes: "", amount: 0,
};

export default function CasesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "sales";
  const isAdmin     = role === "admin";
  const isSales     = role === "sales";
  const isAppointer = role === "appointer";

  const [cases, setCases]             = useState<CaseData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"list" | "add">("list");
  const [filterStatus, setFilterStatus]       = useState("すべて");
  const [filterAppointer, setFilterAppointer] = useState("");
  const [filterSales, setFilterSales]         = useState("");
  const [editId, setEditId]   = useState<string | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [saving, setSaving]   = useState(false);

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setAddForm(EMPTY_ADD);
    await fetchCases();
    setSaving(false);
    setTab("list");
  }

  function openEdit(c: CaseData) {
    setEditId(c.id);
    setEditForm({
      customerName:  c.customer_name,
      contactPerson: c.contact_person ?? "",
      emailAddress:  c.email_address  ?? "",
      phone:         c.phone          ?? "",
      status:        c.status,
      nextMeeting:   c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
      salesPerson:   c.sales_person   ?? "",
      appointer:     c.appointer       ?? "",
      notes:         c.notes           ?? "",
      amount:        c.amount          ?? 0,
    });
  }

  async function handleSave(id: string) {
    setSaving(true);
    await fetch(`/api/cases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    await fetchCases();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    fetchCases();
  }

  function downloadCSV() {
    const header = ["顧客名","担当者名","メール","電話","ステータス","商談日時","営業担当","アポインター","会話メモ","売上","登録日"];
    const rows = filtered.map((c) => [
      c.customer_name, c.contact_person ?? "", c.email_address ?? "", c.phone ?? "",
      c.status,
      c.next_meeting ? new Date(c.next_meeting).toLocaleString("ja-JP") : "",
      c.sales_person ?? "", c.appointer ?? "", c.notes ?? "",
      c.amount ?? 0,
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

      {/* タブ（アポインターのみ「新規登録」を表示） */}
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
          {/* フィルターバー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3 items-center">
            <Filter size={15} className="text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="すべて">すべてのステータス</option>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="アポインターで絞り込み" value={filterAppointer}
              onChange={(e) => setFilterAppointer(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            {(isAdmin || isSales) && (
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
                  {/* 行ヘッダー */}
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => editId === c.id ? setEditId(null) : openEdit(c)}>
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
                              <Calendar size={11} />{new Date(c.next_meeting).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}
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
                      {editId === c.id ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </div>

                  {/* 展開パネル */}
                  {editId === c.id && (
                    <div className="border-t border-gray-100 px-5 py-5 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

                        {/* 顧客情報（全ロール閲覧可・アポインター編集可） */}
                        <Field label="顧客名">
                          <input value={editForm.customerName}
                            onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                            className={inputCls} />
                        </Field>
                        <Field label="担当者名">
                          <input value={editForm.contactPerson}
                            onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                            className={inputCls} />
                        </Field>
                        <Field label="メールアドレス">
                          <div className="relative">
                            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="email" value={editForm.emailAddress}
                              onChange={(e) => setEditForm({ ...editForm, emailAddress: e.target.value })}
                              className={`${inputCls} pl-8`} />
                          </div>
                        </Field>
                        <Field label="電話番号">
                          <div className="relative">
                            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="tel" value={editForm.phone}
                              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                              className={`${inputCls} pl-8`} />
                          </div>
                        </Field>
                        <Field label="アポインター名">
                          <select value={editForm.appointer}
                            onChange={(e) => setEditForm({ ...editForm, appointer: e.target.value })}
                            className={inputCls}>
                            {APPOINTER_OPTIONS.map((a) => <option key={a}>{a}</option>)}
                          </select>
                        </Field>
                        <Field label="商談日時">
                          <input type="datetime-local" value={editForm.nextMeeting}
                            onChange={(e) => setEditForm({ ...editForm, nextMeeting: e.target.value })}
                            className={inputCls} />
                        </Field>

                        {/* 営業情報（admin/salesのみ編集） */}
                        {!isAppointer && (
                          <Field label="ステータス">
                            <select value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className={inputCls}>
                              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </Field>
                        )}
                        {!isAppointer && (
                          <Field label="営業担当者名">
                            <input value={editForm.salesPerson}
                              onChange={(e) => setEditForm({ ...editForm, salesPerson: e.target.value })}
                              className={inputCls} />
                          </Field>
                        )}
                        {!isAppointer && (
                          <Field label="売上金額（円）">
                            <input type="number" min={0} value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                              className={inputCls} />
                          </Field>
                        )}

                        {/* 会話メモ（全幅） */}
                        <div className="md:col-span-2 lg:col-span-3">
                          <Field label="会話メモ">
                            <textarea value={editForm.notes} rows={3}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className={`${inputCls} resize-none`} />
                          </Field>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleSave(c.id)} disabled={saving}
                          className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                          保存する
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(c.id)}
                            className="px-5 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
                            削除する
                          </button>
                        )}
                        <button onClick={() => setEditId(null)}
                          className="px-5 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                          キャンセル
                        </button>
                      </div>
                    </div>
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
                placeholder="株式会社〇〇"
                className={inputCls} />
            </Field>
            <Field label="担当者名">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={addForm.contactPerson}
                  onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                  placeholder="山田 太郎"
                  className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="メールアドレス">
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={addForm.emailAddress}
                  onChange={(e) => setAddForm({ ...addForm, emailAddress: e.target.value })}
                  placeholder="example@company.com"
                  className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="電話番号">
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="090-1234-5678"
                  className={`${inputCls} pl-8`} />
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

      {/* 非アポインターが新規登録タブを開こうとした場合 */}
      {tab === "add" && !isAppointer && (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <p className="text-gray-400">新規登録はアポインターのみ行えます</p>
        </div>
      )}
    </AppLayout>
  );
}

// ── 共通スタイル ───────────────────────────────────────
const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
