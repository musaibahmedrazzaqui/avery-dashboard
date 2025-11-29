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
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f43f5e", "#8b5cf6", "#f59e0b", "#ec4899"];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("sales");
  const [storeFilter, setStoreFilter] = useState("All");
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: "All", domain: "all" },
  ]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    async function loadStores() {
      try {
        const res = await fetch("/api/stores");
        if (res.ok) {
          const data = await res.json();
          setStores([{ name: "All", domain: "all" }, ...(data.stores || [])]);
        }
      } catch (error) {
        console.error("Error loading stores:", error);
      }
    }
    loadStores();
  }, []);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: reportType,
          period: period,
        });

        if (storeFilter !== "All") {
          const store = stores.find((s) => s.name === storeFilter);
          if (store) {
            params.append("store_name", store.name);
          }
        }

        if (dateFrom) {
          params.append("date_from", dateFrom);
        }

        if (dateTo) {
          params.append("date_to", dateTo);
        }

        const res = await fetch(`/api/dashboard/reports?${params}`);
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
        }
      } catch (error) {
        console.error("Error loading report:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportType, storeFilter, period, dateFrom, dateTo, stores]);

  if (loading && !reportData) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  const renderSalesReport = () => {
    if (!reportData || reportData.type !== "sales") return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Period</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.revenueByPeriod || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#10b981"
                  name="Orders"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Store</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.revenueByStore || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                <Bar dataKey="orders" fill="#10b981" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportData.topProducts || []).slice(0, 20).map(
                  (product: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {product.product_title || "N/A"}
                      </TableCell>
                      <TableCell>{product.sku || "N/A"}</TableCell>
                      <TableCell>
                        {product.store_name || product.store_type}
                      </TableCell>
                      <TableCell>{product.units_sold}</TableCell>
                      <TableCell>${product.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderProductsReport = () => {
    if (!reportData || reportData.type !== "products") return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Avg Price</TableHead>
                  <TableHead>Days Sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportData.topProductsByRevenue || []).slice(0, 20).map(
                  (product: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {product.product_title || "N/A"}
                      </TableCell>
                      <TableCell>{product.sku || "N/A"}</TableCell>
                      <TableCell>{product.units_sold}</TableCell>
                      <TableCell>${product.revenue.toFixed(2)}</TableCell>
                      <TableCell>${product.avg_price.toFixed(2)}</TableCell>
                      <TableCell>{product.days_sold}</TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Products by Store</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Total Products</TableHead>
                    <TableHead>Product Types</TableHead>
                    <TableHead>Vendors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reportData.productsByStore || []).map(
                    (store: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{store.store_name}</TableCell>
                        <TableCell>{store.total_products}</TableCell>
                        <TableCell>{store.product_types}</TableCell>
                        <TableCell>{store.vendors}</TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low Inventory Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Low Stock Variants</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reportData.lowInventory || []).slice(0, 10).map(
                    (product: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {product.title}
                        </TableCell>
                        <TableCell>{product.store_name}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {product.low_stock_variants}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderCustomersReport = () => {
    if (!reportData || reportData.type !== "customers") return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Avg Order Value</TableHead>
                  <TableHead>First Order</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportData.topCustomers || []).slice(0, 20).map(
                  (customer: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {customer.email || customer.username || "Guest"}
                      </TableCell>
                      <TableCell>{customer.orders_count}</TableCell>
                      <TableCell>${customer.total_spent.toFixed(2)}</TableCell>
                      <TableCell>${customer.avg_order_value.toFixed(2)}</TableCell>
                      <TableCell>
                        {customer.first_order_date
                          ? new Date(
                              customer.first_order_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {customer.last_order_date
                          ? new Date(
                              customer.last_order_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Acquisition</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.customerAcquisition || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="new_customers"
                    stroke="#3b82f6"
                    name="New Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Lifetime Value Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.customerLTV || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ltv_range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="customer_count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderInventoryReport = () => {
    if (!reportData || reportData.type !== "inventory") return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Summary by Store</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Total Products</TableHead>
                  <TableHead>Total Inventory</TableHead>
                  <TableHead>Low Stock Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportData.inventorySummary || []).map(
                  (store: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {store.store_name}
                      </TableCell>
                      <TableCell>{store.total_products}</TableCell>
                      <TableCell>{store.total_inventory}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            store.low_stock_count > 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {store.low_stock_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products by Inventory Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.inventoryLevels || []}
                  dataKey="product_count"
                  nameKey="inventory_level"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(reportData.inventoryLevels || []).map(
                    (entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    )
                  )}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderFinancialReport = () => {
    if (!reportData || reportData.type !== "financial") return null;

    return (
      <div className="space-y-6">
        {reportData.revenueSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  ${reportData.revenueSummary.total_revenue.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  {reportData.revenueSummary.total_orders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Avg Order Value
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  ${reportData.revenueSummary.avg_order_value.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Min Order
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  ${reportData.revenueSummary.min_order.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Max Order
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  ${reportData.revenueSummary.max_order.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Financial Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reportData.revenueByFinancialStatus || []).map(
                    (item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="secondary">{item.status}</Badge>
                        </TableCell>
                        <TableCell>{item.orders}</TableCell>
                        <TableCell>${item.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Fulfillment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reportData.revenueByFulfillment || []).map(
                    (item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="secondary">{item.status}</Badge>
                        </TableCell>
                        <TableCell>{item.orders}</TableCell>
                        <TableCell>${item.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.revenueTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#10b981"
                  name="Orders"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case "sales":
        return renderSalesReport();
      case "products":
        return renderProductsReport();
      case "customers":
        return renderCustomersReport();
      case "inventory":
        return renderInventoryReport();
      case "financial":
        return renderFinancialReport();
      default:
        return <div>Select a report type</div>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales Report</SelectItem>
              <SelectItem value="products">Products Report</SelectItem>
              <SelectItem value="customers">Customers Report</SelectItem>
              <SelectItem value="inventory">Inventory Report</SelectItem>
              <SelectItem value="financial">Financial Report</SelectItem>
            </SelectContent>
          </Select>

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

          {(reportType === "sales" || reportType === "customers") && (
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From Date"
              className="px-3 py-2 border rounded-md text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To Date"
              className="px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading report data...</div>
        ) : (
          renderReportContent()
        )}
      </div>
    </DashboardLayout>
  );
}