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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import FilterBar from "@/components/FilterBar";
import LoadingState from "@/components/LoadingState";

interface FinancialData {
  outstandingInvoices: Array<{
    customer: string;
    email: string;
    platform: string;
    outstandingAmount: number;
    invoiceCount: number;
    lastOrderDate: string;
    status: string;
  }>;
  margins: {
    totalRevenue: number;
    estimatedCOGS: number;
    grossMarginDollars: number;
    grossMarginPercent: number;
  };
  dailyMargins: Array<{
    date: string;
    revenue: number;
    margin: number;
    marginPercent: number;
  }>;
  inventory: {
    totalInventoryValue: number;
    platformValues: Array<{
      platform: string;
      value: number;
      items: number;
    }>;
  };
}

export default function FinancialsPage() {
  const searchParams = useSearchParams();
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: 'All', domain: 'all' },
  ]);

  const store = searchParams.get("store") || "All";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

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
    async function loadFinancialData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (store && store !== "All") {
          params.append('store', store);
        }
        if (dateFrom) {
          params.append('date_from', dateFrom);
        }
        if (dateTo) {
          params.append('date_to', dateTo);
        }

        const res = await fetch(`/api/dashboard/financials?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFinancialData(data);
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadFinancialData();
  }, [store, dateFrom, dateTo]);

  if (loading && !financialData) {
    return <LoadingState />;
  }

  if (!financialData) {
    return <LoadingState />;
  }

  const { outstandingInvoices, margins, dailyMargins, inventory } = financialData;

  // Format date for chart (show short format)
  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format chart data with formatted dates
  const chartData = dailyMargins.map(item => ({
    ...item,
    date: formatChartDate(item.date),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <FilterBar
          stores={stores}
          showSearch={false}
          showStoreFilter={true}
          showDateRange={true}
        />

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Invoices by Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Outstanding Amount</TableHead>
                  <TableHead>Invoice Count</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingInvoices.length > 0 ? (
                  outstandingInvoices.map((invoice, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {invoice.customer}
                        <div className="text-sm text-gray-500">{invoice.email}</div>
                      </TableCell>
                      <TableCell>{invoice.platform}</TableCell>
                      <TableCell className="font-semibold text-red-600">
                        ${invoice.outstandingAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>{invoice.invoiceCount}</TableCell>
                      <TableCell>
                        {new Date(invoice.lastOrderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'pending' ? 'destructive' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No outstanding invoices
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margins Analysis (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ${margins.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Gross Margin Dollars</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${margins.grossMarginDollars.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Gross Margin %</p>
                <p className="text-2xl font-bold text-purple-600">
                  {margins.grossMarginPercent.toFixed(1)}%
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="margin" fill="#3b82f6" name="Gross Margin" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total On-Hand Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">Total Inventory Value</p>
                  <p className="text-3xl font-bold text-blue-600">
                    ${inventory.totalInventoryValue.toFixed(2)}
                  </p>
                </div>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.platformValues.length > 0 ? (
                      inventory.platformValues.map((platformData) => (
                        <TableRow key={platformData.platform}>
                          <TableCell className="font-medium">
                            {platformData.platform}
                          </TableCell>
                          <TableCell>${platformData.value.toFixed(2)}</TableCell>
                          <TableCell>{platformData.items}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                          No inventory data
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
