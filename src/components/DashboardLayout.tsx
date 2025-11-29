"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Overview", href: "/dashboard", icon: "📊" },
  { name: "Orders", href: "/dashboard/orders", icon: "📦" },
  { name: "Products", href: "/dashboard/products", icon: "🛍️" },
  { name: "Customers", href: "/dashboard/customers", icon: "👥" },
  { name: "Analytics", href: "/dashboard/analytics", icon: "📈" },
  { name: "Financials", href: "/dashboard/financials", icon: "💰" },
  { name: "Profits", href: "/dashboard/profits", icon: "💵" },
  { name: "Reports", href: "/dashboard/reports", icon: "📋" },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Avery Optics Dashboard</h1>
          <p className="text-gray-600">Centralized insights from your stores</p>
        </header>

        {/* Navigation */}
        <nav className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "flex items-center gap-2",
                      isActive && "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Page Content */}
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

