"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import LoadingState from "@/components/LoadingState";

export default function ProfitsPage() {
  const searchParams = useSearchParams();
  const [profits, setProfits] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [profitByDate, setProfitByDate] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: 'All', domain: 'all' },
  ]);
  const [pagination, setPagination] = useState<{
    total: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  } | null>(null);
  const itemsPerPage = 10;

  const page = parseInt(searchParams.get("page") || "1");
  const store = searchParams.get("store") || "All";

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
    async function loadProfits() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          page: page.toString(),
        });

        if (store && store !== "All") {
          params.append('store', store);
        }

        const res = await fetch(`/api/dashboard/profits?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProfits(data.profits || []);
          setSummary(data.summary);
          setProfitByDate(data.profitByDate || []);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error loading profits:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProfits();
  }, [page, store]);

  if (loading && profits.length === 0) {
    return <LoadingState />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-green-600">
                  ${summary.total_revenue.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Total Cost</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-orange-600">
                  ${summary.total_cost.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Total Profit</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-blue-600">
                  ${summary.total_profit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Average Margin</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-purple-600">
                  {summary.average_margin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Total Items</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">{summary.total_items}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profit Trend Chart */}
        {profitByDate.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Profit Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={profitByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#f97316"
                    strokeWidth={2}
                    name="Cost"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <FilterBar
          stores={stores}
          showSearch={false}
          showStoreFilter={true}
        />

        {/* Profits Table */}
        <Card>
          <CardHeader>
            <CardTitle>Profit by Order</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profits.length > 0 ? (
                  profits.map((profit) => (
                    <TableRow key={profit.order_id}>
                      <TableCell className="font-medium">
                        {profit.order_number || profit.order_id}
                      </TableCell>
                      <TableCell>{profit.store || profit.store_type}</TableCell>
                      <TableCell className="text-green-600">
                        ${profit.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        ${profit.cost.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`font-semibold ${
                          profit.profit >= 0 ? "text-blue-600" : "text-red-600"
                        }`}
                      >
                        ${profit.profit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            profit.margin >= 40
                              ? "default"
                              : profit.margin >= 20
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {profit.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{profit.items_count}</TableCell>
                      <TableCell>
                        {new Date(profit.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No profit data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {pagination && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                total={pagination.total}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

