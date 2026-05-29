"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ConfirmModal from "@/components/ConfirmModal";
import { isAuthenticated } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Give it a small delay to ensure localStorage is accessible
      await new Promise(resolve => setTimeout(resolve, 100));

      const token = localStorage.getItem('access_token');
      console.log('Dashboard auth check - Token exists:', !!token);
      console.log('Dashboard auth check - Token preview:', token ? token.substring(0, 30) + '...' : 'none');

      if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login...');
        console.log('isAuthenticated() returned:', isAuthenticated());
        setChecking(false);
        router.push('/login');
      } else {
        console.log('Authenticated, showing dashboard');
        // Auto-fetch workspace if not stored
        try {
          const { getWorkspaceId, fetchAndStoreWorkspace } = await import('@/lib/workspace');
          if (!getWorkspaceId()) {
            await fetchAndStoreWorkspace();
          }
        } catch (e) {
          console.warn('Workspace fetch failed, continuing anyway', e);
        } finally {
          setChecking(false);
        }
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl animate-spin block" style={{ color: "#6366f1" }}>progress_activity</span>
          <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-35 bg-black backdrop-blur-sm cursor-pointer"
          />
        )}
      </AnimatePresence>

      <ConfirmModal />

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className="flex-1 flex flex-col transition-all duration-400 ease-[0.19,1,0.22,1] min-w-0"
        style={{ marginLeft: isMobile ? '0px' : (collapsed ? '80px' : '260px') }}
      >
        <Header onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-4 pb-24 md:pb-8 lg:p-8 w-full max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

