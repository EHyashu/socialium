"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  {
    group: "MAIN",
    items: [
      {
        icon: "⬡",
        label: "Dashboard",
        path: "/dashboard",
        color: "text-indigo-400",
      },
      {
        icon: "✦",
        label: "Content",
        path: "/content",
        color: "text-violet-400",
        badge: "3 pending",
      },
      {
        icon: "◈",
        label: "Scheduling",
        path: "/scheduling",
        color: "text-blue-400",
        badge: "AI",
      },
      {
        icon: "◉",
        label: "Analytics",
        path: "/analytics",
        color: "text-emerald-400",
      },
      {
        icon: "📅",
        label: "Calendar",
        path: "/calendar",
        color: "text-purple-400",
      },
      {
        icon: "🧪",
        label: "A/B Testing",
        path: "/ab-testing",
        color: "text-teal-400",
        isNew: true,
      },
    ],
  },
  {
    group: "AI TOOLS",
    items: [
      {
        icon: "⟡",
        label: "Memory",
        path: "/memory",
        color: "text-pink-400",
        isNew: true,
      },
      {
        icon: "⟢",
        label: "Approvals",
        path: "/approvals",
        color: "text-amber-400",
        badge: "2",
      },
      {
        icon: "⌖",
        label: "Trends",
        path: "/trends",
        color: "text-cyan-400",
        isNew: true,
      },
      {
        icon: "🔥",
        label: "Viral Scoring",
        path: "/viral-scoring",
        color: "text-red-400",
        isNew: true,
      },
      {
        icon: "💬",
        label: "Auto Reply",
        path: "/auto-reply",
        color: "text-green-400",
        isNew: true,
      },
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      {
        icon: "⟳",
        label: "Platforms",
        path: "/platforms",
        color: "text-orange-400",
      },
      {
        icon: "◎",
        label: "Notifications",
        path: "/notifications",
        color: "text-slate-400",
      },
      {
        icon: "◫",
        label: "Billing",
        path: "/settings/billing",
        color: "text-slate-400",
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ 
  collapsed, 
  onToggle,
  isMobile = false,
  mobileOpen = false,
  onMobileClose
}: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <motion.aside
      initial={false}
      animate={
        isMobile
          ? { x: mobileOpen ? 0 : -260, width: 260 }
          : { x: 0, width: collapsed ? 80 : 260 }
      }
      transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className={`fixed left-0 top-0 z-40 h-screen flex-shrink-0 flex flex-col border-r border-[var(--border-color)] overflow-hidden ${
        isMobile ? "shadow-2xl" : ""
      }`}
      style={{
        background: "var(--bg-secondary)",
      }}
    >
      {/* Gradient orb decoration */}
      <div className="absolute top-0 left-0 w-40 h-40 bg-indigo-600/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center justify-between h-16 px-5 border-b border-[var(--border-color)]">
        <motion.div
          className="flex items-center gap-3 cursor-pointer"
          onClick={isMobile ? undefined : onToggle}
          whileHover={isMobile ? {} : { scale: 1.02 }}
          whileTap={isMobile ? {} : { scale: 0.98 }}
        >
          {/* Animated logo mark */}
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)]" />
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-base italic">
              S
            </div>
            <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl opacity-20 blur animate-pulse" />
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-display font-bold text-[var(--text-primary)] text-xl tracking-tight"
              >
                Socialium
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {isMobile && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            aria-label="Close Menu"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide">
        {NAV_ITEMS.map((group) => (
          <div key={group.group}>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[10px] font-bold text-[var(--text-muted)] tracking-[0.2em] uppercase px-3 mb-3"
                >
                  {group.group}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <motion.div
                    key={item.path}
                    onHoverStart={() => setHoveredItem(item.path)}
                    onHoverEnd={() => setHoveredItem(null)}
                    className="relative group"
                  >
                    <Link
                      href={item.path}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {/* Active/hover background */}
                      <AnimatePresence>
                        {(isActive || hoveredItem === item.path) && (
                          <motion.div
                            layoutId={isActive ? "activeNav" : undefined}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`absolute inset-0 rounded-xl ${
                              isActive
                                ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/10 border border-[var(--border-color)]"
                                : "bg-[var(--bg-hover)]"
                            }`}
                          />
                        )}
                      </AnimatePresence>

                      {/* Icon */}
                      <span
                        className={`relative z-10 text-xl flex-shrink-0 transition-all duration-300 ${
                          isActive
                            ? item.color + " drop-shadow-[0_0_8px_currentColor]"
                            : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        {item.icon}
                      </span>

                      {/* Label + badges */}
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="relative z-10 flex-1 flex items-center justify-between min-w-0"
                          >
                            <span className="text-sm font-semibold truncate tracking-tight">
                              {item.label}
                            </span>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.isNew && (
                                <span className="text-[8px] font-black bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-widest shadow-lg">
                                  NEW
                                </span>
                              )}
                              {item.badge && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                    item.badge === "AI"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                      : "bg-white/5 text-white/40 border border-white/5"
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom user card */}
      <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-hover)]">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-all"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-lg border border-[var(--border-color)]">
              U
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--bg-secondary)] shadow-sm" />
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[var(--text-primary)] font-bold text-xs truncate tracking-tight">
                  User
                </p>
                <p className="text-[var(--text-muted)] text-[10px] truncate font-medium">
                  Free plan · 3 posts left
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.aside>
  );
}
