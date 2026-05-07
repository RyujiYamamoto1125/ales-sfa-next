"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, ClipboardList, Target, LogOut, Megaphone,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard, roles: ["admin","sales","appointer"] },
  { href: "/cases",     label: "案件管理",       icon: ClipboardList,   roles: ["admin","sales","appointer"] },
  { href: "/ads",       label: "広告数値管理",   icon: Megaphone,       roles: ["admin","sales"] },
  { href: "/targets",   label: "目標設定",        icon: Target,          roles: ["admin"] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者", sales: "営業", appointer: "アポインター",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "sales";
  const name = session?.user?.name ?? "";

  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col shrink-0">
      {/* ロゴ */}
      <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <span className="font-bold text-gray-800 text-base tracking-tight">営業 SFA</span>
      </div>

      {/* ユーザー */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-indigo-700 font-bold text-sm">{name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
            <p className="text-xs text-gray-400">{ROLE_LABEL[role] ?? role}</p>
          </div>
        </div>
      </div>

      {/* ナビ */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">メニュー</p>
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}>
              <Icon size={18} className={active ? "text-indigo-600" : "text-gray-400"} />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
            </Link>
          );
        })}
      </nav>

      {/* ログアウト */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <LogOut size={18} />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
