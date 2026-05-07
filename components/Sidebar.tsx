"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/cases", label: "案件管理", icon: "📋" },
  { href: "/targets", label: "目標設定", icon: "🎯" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-[#0D1B2A] text-white flex flex-col">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-wide">営業 SFA</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#26C6DA]/20 text-[#26C6DA]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span>🚪</span>
          ログアウト
        </button>
      </div>
    </aside>
  );
}
