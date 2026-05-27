"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Bell, 
  Moon, 
  Sun, 
  Search, 
  LogOut, 
  User, 
  Settings, 
  Zap, 
  Sparkles,
  Menu
} from "lucide-react";
import { getStoredUser, logout } from "@/lib/auth";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useUIStore } from "@/store/use-ui-store";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { toggleCommandPalette } = useUIStore();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setMounted(true);
  }, []);

  // Remove old dark mode toggle logic - now handled by ThemeProvider

  if (!mounted) return <header className="h-16 border-b border-white/5" />;

  return (
    <header 
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/80 backdrop-blur-xl px-4 sm:px-6"
    >
      {/* Left: Breadcrumb / Path hint */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-brand-500 transition-all"
            aria-label="Toggle Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          <span className="hidden sm:inline hover:text-brand-500 transition-colors cursor-default">Socialium</span>
          <span className="hidden sm:inline text-[var(--text-muted)]/50">/</span>
          <span className="text-[var(--text-secondary)]">
            {pathname.split("/").filter(Boolean).pop() || "dashboard"}
          </span>
        </div>
      </div>

      {/* Middle/Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Global Search / Cmd+K Trigger */}
        <button
          onClick={toggleCommandPalette}
          className="group hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] hover:border-brand-500/30 hover:bg-[var(--bg-hover)]/80 transition-all duration-300"
        >
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-brand-500 transition-colors" />
          <span className="text-[11px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">Search or press</span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-[9px] font-black text-[var(--text-muted)] shadow-inner">
            <span className="text-xs italic font-sans">⌘</span>K
          </kbd>
        </button>

        {/* Separator */}
        <div className="h-4 w-px bg-[var(--border-color)] mx-1 hidden md:block" />

        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-inner"
          style={{
            background: "var(--bg-hover)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)"
          }}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </motion.button>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-9 h-9 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-color)] hover:border-brand-500/30 flex items-center justify-center text-[var(--text-muted)] hover:text-brand-500 transition-all shadow-inner"
        >
          <Bell className="h-4 w-4" />
          <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        </motion.button>

        {/* Create Button */}
        <Link href="/content/generate">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 text-white text-[11px] font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.5)] transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create</span>
          </motion.button>
        </Link>

        {/* User Profile */}
        <div className="relative ml-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-lg border border-white/10"
          >
            {user?.full_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || "U"}
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40" 
                  onClick={() => setUserMenuOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-3 w-60 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50"
                >
                  <div className="px-3 py-3 border-b border-[var(--border-color)] mb-1">
                    <p className="text-[11px] font-black text-[var(--text-primary)] truncate tracking-tight">
                      {user?.full_name || user?.username || "Socialium User"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{user?.email}</p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-[9px] font-black text-brand-500 uppercase tracking-widest">
                      <Zap className="h-2.5 w-2.5 fill-current" />
                      Free Plan
                    </div>
                  </div>
                  
                  <div className="space-y-0.5">
                    {[                      { icon: User, label: "Profile", href: "/settings/billing" },
                      { icon: Settings, label: "Workspace", href: "/settings/billing" },
                      { icon: Zap, label: "Upgrade to Pro", href: "/settings/billing", highlight: true },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                          item.highlight
                            ? "text-brand-400 hover:bg-brand-500/10"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Link>
                    ))}
                    
                    <div className="h-px bg-[var(--border-color)] my-1.5" />
                    
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
