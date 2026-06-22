"use client";
import { useState } from "react";
import {
  ChevronDown, ChevronRight,
  ClipboardList, FilePlus, History,
  FileText, Archive, PlusSquare
} from "lucide-react";

export type SidebarPage =
  | "발주관리"
  | "발주서작성"
  | "발주이력"
  | "작업지시서목록"
  | "작업지시서작성";

export type CategoryFilter = "전체" | "의류" | "슈즈";

interface Props {
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
}

const NAV = [
  {
    group: "WORK ORDER",
    icon: FileText,
    items: [
      { key: "작업지시서작성" as SidebarPage, label: "새 작업지시서",    icon: PlusSquare  },
      { key: "작업지시서목록" as SidebarPage, label: "작업지시서 목록",  icon: Archive     },
      { key: "발주관리"       as SidebarPage, label: "발주 관리",        icon: ClipboardList },
      { key: "발주서작성"     as SidebarPage, label: "발주서 작성",      icon: FilePlus    },
      { key: "발주이력"       as SidebarPage, label: "발주 이력",        icon: History     },
    ],
  },
];

const CATEGORIES: { value: CategoryFilter; emoji: string; label: string }[] = [
  { value: "전체", emoji: "✦",  label: "전체" },
  { value: "의류", emoji: "👕", label: "의류" },
  { value: "슈즈", emoji: "👟", label: "슈즈" },
];

export default function Sidebar({ activePage, onNavigate, categoryFilter, onCategoryChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ ORDER: true, "WORK ORDER": true });

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col">
      {/* 로고 */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xl select-none" style={{ background: "linear-gradient(135deg, #fde68a 0%, #fca5a5 50%, #c4b5fd 100%)" }}>
          📋
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm leading-tight">OZKIZ</div>
          <div className="text-gray-400 text-[10px] leading-tight">제품디자인팀</div>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="px-3 py-3 border-b border-gray-100">
        <p className="text-[9px] font-bold text-gray-300 tracking-widest uppercase px-1 mb-2">CATEGORY</p>
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => {
            const active = categoryFilter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => onCategoryChange(c.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition-all ${
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                }`}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV.map((group) => {
          const Icon = group.icon;
          const isOpen = open[group.group] ?? true;
          return (
            <div key={group.group} className="mb-2">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.group]: !o[group.group] }))}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Icon size={15} className="text-violet-400" />
                <span className="flex-1 text-left font-bold text-xs text-gray-500 tracking-widest uppercase">{group.group}</span>
                {isOpen
                  ? <ChevronDown size={13} className="text-gray-300" />
                  : <ChevronRight size={13} className="text-gray-300" />}
              </button>

              {isOpen && (
                <div className="mt-1 space-y-0.5 pl-2">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = activePage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onNavigate(item.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          active
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        <ItemIcon size={15} className={active ? "text-violet-600" : "text-gray-400"} />
                        {item.label}
                        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="text-[10px] text-gray-300 text-center">오즈키즈 · 제품디자인팀</div>
      </div>
    </aside>
  );
}
