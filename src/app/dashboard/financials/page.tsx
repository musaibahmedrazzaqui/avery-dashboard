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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function FinancialsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("All");
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: 'All', domain: 'all' },
  ]);
  const [currentOrdersPage, setCurrentOrdersPage] = useState(1);
  const [ordersPagination, setOrdersPagination] = useState<any>(null);
  const itemsPerPage = 50; // Load more orders for financial analysis

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
    async function loadData() {
      setLoading(true);
      try {
        // Load orders
        const ordersParams = new URLSearchParams({
          limit: itemsPerPage.toString(),
          offset: ((currentOrdersPage - 1) * itemsPerPage).toString(),
        });
        if (storeFilter !== "All") {
          const store = stores.find(s => s.name === storeFilter);
          if (store) {
            ordersParams.append('store_name', store.name);
          }
        }

        const ordersRes = await fetch(`/api/dashboard/orders?${ordersParams}`);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
          setOrdersPagination(ordersData.pagination);
        }

        // Load products for inventory calculation
        const productsParams = new URLSearchParams({
          limit: '1000', // Load all products for inventory value
        });
        if (storeFilter !== "All") {
          const store = stores.find(s => s.name === storeFilter);
          if (store) {
            productsParams.append('store_name', store.name);
          }
        }
        const productsRes = await fetch(`/api/dashboard/products?${productsParams}`);
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData.products || []);
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrdersPage, storeFilter, stores]);

  // Calculate outstanding invoices
  const outstandingInvoices = orders
    .filter((order: any) => 
      order.financial_status === 'pending' || 
      order.financial_status === 'partially_paid' ||
      order.financial_status === null
    )
    .reduce((acc: any, order: any) => {
      const customerKey = order.customer 
        ? `${order.customer.email || order.customer.first_name}-${order.store}` 
        : `guest-${order.id}`;
      if (!acc[customerKey]) {
        acc[customerKey] = {
          customer: order.customer 
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.customer.email || 'Guest'
            : 'Guest',
          email: order.customer?.email || 'N/A',
          platform: order.store || order.store_type,
          outstandingAmount: 0,
          invoiceCount: 0,
          lastOrderDate: order.created_at,
          status: order.financial_status || 'pending',
        };
      }
      acc[customerKey].outstandingAmount += parseFloat(order.total_price || '0');
      acc[customerKey].invoiceCount += 1;
      if (new Date(order.created_at) > new Date(acc[customerKey].lastOrderDate)) {
        acc[customerKey].lastOrderDate = order.created_at;
      }
      return acc;
    }, {});

  const outstandingInvoicesList = Object.values(outstandingInvoices)
    .sort((a: any, b: any) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 10);

  // Calculate margins (30 days)
  const recentOrders = orders.filter((order: any) => {
    const orderDate = new Date(order.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return orderDate >= thirtyDaysAgo;
  });

  const totalRevenue = recentOrders.reduce((sum: number, order: any) => 
    sum + parseFloat(order.total_price || '0'), 0);
  const estimatedCOGS = totalRevenue * 0.6;
  const grossMarginDollars = totalRevenue - estimatedCOGS;
  const grossMarginPercent = totalRevenue > 0 ? (grossMarginDollars / totalRevenue) * 100 : 0;

  // Daily margins for last 7 days
  const dailyMargins = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOrders = orders.filter((o: any) => o.created_at?.startsWith(dateStr));
    const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const dayCOGS = dayRevenue * 0.6;
    const dayMargin = dayRevenue - dayCOGS;
    dailyMargins.push({
      date: dateStr,
      revenue: dayRevenue,
      margin: dayMargin,
      marginPercent: dayRevenue > 0 ? (dayMargin / dayRevenue) * 100 : 0,
    });
  }

  // Inventory value
  const totalInventoryValue = products.reduce((sum: number, product: any) => {
    return sum + (product.variants || []).reduce((variantSum: number, variant: any) => {
      return variantSum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0');
    }, 0);
  }, 0);

  const platformValues = products.reduce((acc: any, product: any) => {
    const platform = product.store || product.store_type || 'Unknown';
    if (!acc[platform]) {
      acc[platform] = { value: 0, items: 0 };
    }
    const productValue = (product.variants || []).reduce((sum: number, variant: any) => 
      sum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0'), 0);
    acc[platform].value += productValue;
    acc[platform].items += (product.variants || []).reduce((sum: number, v: any) => 
      sum + (v.inventory_quantity || 0), 0);
    return acc;
  }, {});

  if (loading && orders.length === 0) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

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
                {outstandingInvoicesList.length > 0 ? (
                  outstandingInvoicesList.map((invoice: any, index: number) => (
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
                      <TableCell>{new Date(invoice.lastOrderDate).toLocaleDateString()}</TableCell>
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
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Gross Margin Dollars</p>
                <p className="text-2xl font-bold text-blue-600">${grossMarginDollars.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Gross Margin %</p>
                <p className="text-2xl font-bold text-purple-600">{grossMarginPercent.toFixed(1)}%</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyMargins}>
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
                    ${totalInventoryValue.toFixed(2)}
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
                    {Object.entries(platformValues).map(([platform, data]: [string, any]) => (
                      <TableRow key={platform}>
                        <TableCell className="font-medium">{platform}</TableCell>
                        <TableCell>${data.value.toFixed(2)}</TableCell>
                        <TableCell>{data.items}</TableCell>
                      </TableRow>
                    ))}
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
