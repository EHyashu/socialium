"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[var(--sidebar-width)]">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
