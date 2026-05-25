"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { isAuthenticated } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

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
        router.push('/login');
      } else {
        console.log('Authenticated, showing dashboard');
        setChecking(false);
      }
    };
    
    checkAuth();
  }, [router]);

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
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div 
        className="flex-1 flex flex-col transition-all duration-400 ease-[0.19,1,0.22,1]"
        style={{ marginLeft: collapsed ? '80px' : '260px' }}
      >
        <Header />
        <main className="flex-1 p-4 lg:p-8 w-full max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
