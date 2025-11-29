"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import SyncButton from "@/components/SyncButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Avery Optics Dashboard</h1>
            <p className="text-gray-600 text-lg">Centralized insights from your stores</p>
          </header>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    Go to Dashboard
                  </Button>
                </Link>
                <SyncButton />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📦 Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/orders">
                  <Button variant="outline" className="w-full">
                    View Orders
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">🛍️ Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/products">
                  <Button variant="outline" className="w-full">
                    View Products
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📋 Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/reports">
                  <Button variant="outline" className="w-full">
                    View Reports
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}