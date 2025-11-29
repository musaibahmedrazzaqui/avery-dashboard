"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";

const COLORS = ["#3b82f6", "#10b981", "#f43f5e", "#8b5cf6"];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("All");
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: 'All', domain: 'all' },
  ]);

  useEffect(() => {
    async function loadStores() {
      try {
        const res = await fetch('/api/stores');
        if (res.ok) {
          const data = await res.json();
          setStores([{ name: 'All', domain: 'all' }, ...(data.stores || [])]);
        }
      } catch (error) {
        console.error('Error loading stores:', error);
      }
    }
    loadStores();
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        
        if (storeFilter !== "All") {
          const store = stores.find(s => s.name === storeFilter);
          if (store) {
            params.append('store_name', store.name);
          }
        }

        const res = await fetch(`/api/dashboard/stats?${params}`);
        if (res.ok) {
          const statsData = await res.json();
          setData(statsData);
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [storeFilter, stores]);

  if (loading || !data) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  // Format top products for display
  const topProducts = (data.topProducts || []).slice(0, 10).map((p: any, i: number) => ({
    name: p.product_title || `Product ${i + 1}`,
    units: p.units || 0,
    revenue: p.revenue || 0,
    store: p.store || 'all',
  }));

  // Format top customers for display
  const topCustomers = (data.topCustomers || []).slice(0, 10).map((c: any) => ({
    name: c.username || c.email || 'Unknown',
    email: c.email || '',
    total: c.total_spent || 0,
    orders_count: c.orders_count || 0,
    store: 'all',
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.domain} value={store.name}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.financialStatus || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="units" fill="#10b981" name="Units" />
                </BarChart>
              </ResponsiveContainer>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.slice(0, 5).map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium truncate max-w-xs">
                        {p.name}
                      </TableCell>
                      <TableCell>{p.units}</TableCell>
                      <TableCell>${p.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topCustomers}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#8b5cf6" name="Total Spent" />
                </BarChart>
              </ResponsiveContainer>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.slice(0, 5).map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="truncate max-w-xs">{c.email}</TableCell>
                      <TableCell>{c.orders_count}</TableCell>
                      <TableCell>${c.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {data.revenueByMonth && data.revenueByMonth.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Month (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {data.ordersByDay && data.ordersByDay.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Orders by Day of Week (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.ordersByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#f43f5e" name="Orders" />
                  <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {data.revenueByStore && data.revenueByStore.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Store Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Type</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenueByStore.map((store: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{store.store_type}</TableCell>
                      <TableCell>${store.revenue.toFixed(2)}</TableCell>
                      <TableCell>{store.orders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

