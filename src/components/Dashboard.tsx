"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import toast from "react-hot-toast";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  getAggregateData,
  getOrderDetails,
  getProductDetails,
  getCustomerDetails,
  stores,
} from "@/lib/shopify";
import { DialogTrigger } from "@radix-ui/react-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const COLORS = ["#3b82f6", "#10b981", "#f43f5e", "#8b5cf6"];

interface Data {
  totalRevenue: string;
  activeOrders: number;
  inventoryHealth: number;
  totalCustomers: number;
  lowStockCount: number;
  allOrders: any[];
  allProducts: any[];
  allCustomers: any[];
  topProducts: any[];
  topCustomers: any[];
  revenueData: any[];
  fulfillmentStatus: { name: string; value: number }[];
  financialStatus: { name: string; value: number }[];
  errors: { store: string; message: string }[];
}

interface PaginatedTableProps<T> {
  data: T[];
  itemsPerPage?: number;
  renderRow: (item: T) => JSX.Element;
  headers: string[];
  emptyMessage: string;
}

function PaginatedTable<T>({
  data,
  itemsPerPage = 10,
  renderRow,
  headers,
  emptyMessage,
}: PaginatedTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((item, index) => (
              <React.Fragment key={item.id ?? index}>
                {renderRow(item)}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={headers.length}
                className="text-center py-8 text-gray-500"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 self-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [storeFilter, setStoreFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [selectedItem, setSelectedItem] = useState<{
    type: "order" | "product" | "customer";
    details: any;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const aggregate = await getAggregateData();
      setData(aggregate);
      if (aggregate.errors.length > 0) {
        aggregate.errors.forEach((error) => {
          toast.error(`${error.store}: ${error.message}`, { duration: 5000 });
        });
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading || !data)
    return <div className="text-center py-8">Loading...</div>;

  const filteredData = {
    allOrders: data.allOrders.filter(
      (o) => storeFilter === "All" || o.store === storeFilter
    ),
    allProducts: data.allProducts.filter(
      (p) => storeFilter === "All" || p.store === storeFilter
    ),
    allCustomers: data.allCustomers.filter(
      (c) => storeFilter === "All" || c.store === storeFilter
    ),
    revenueData: [],
    fulfillmentStatus: data.fulfillmentStatus.filter(
      (s) =>
        storeFilter === "All" ||
        data.allOrders.some(
          (o) =>
            o.store === storeFilter &&
            (o.fulfillment_status || "pending") === s.name
        )
    ),
    financialStatus: data.financialStatus.filter(
      (s) =>
        storeFilter === "All" ||
        data.allOrders.some(
          (o) => o.store === storeFilter && o.financial_status === s.name
        )
    ),
  };

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dailyRevenue = filteredData.allOrders
      .filter((o) => o.created_at.startsWith(dateStr))
      .reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    filteredData.revenueData.push({ date: dateStr, revenue: dailyRevenue });
  }

  const filteredOrders = filteredData.allOrders
  .filter((o) => {
    // Log the order object to inspect its properties
    console.log("Order:", o);
    if (searchTerm === "" || !searchTerm) return true;

    const orderNumber = (o.order_number ?? "").toString();
    const totalPrice = (o.total_price ?? "").toString();
    const search = searchTerm.toString().toLowerCase();

    return (
      orderNumber.toLowerCase().includes(search) ||
      totalPrice.includes(search)
    );
  })
  .filter((o) => {
    if (statusFilter === "all") return true;
    const fulfillmentStatus = (o.fulfillment_status ?? "").toString();
    return fulfillmentStatus.toLowerCase() === statusFilter.toLowerCase();
  })
  .sort((a, b) => {
    const aVal = sortBy.includes("date")
      ? new Date(a.created_at).getTime()
      : parseFloat(a.total_price || "0");
    const bVal = sortBy.includes("date")
      ? new Date(b.created_at).getTime()
      : parseFloat(b.total_price || "0");
    return sortBy.endsWith("desc") ? bVal - aVal : aVal - bVal;
  });

  const filteredProducts = filteredData.allProducts
    .filter(
      (p) =>
        searchTerm === "" ||
        (p?.title ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = sortBy.includes("inventory")
        ? a.variants.reduce(
            (sum: number, v: any) => sum + v.inventory_quantity,
            0
          )
        : (a?.title ?? "").toLowerCase();
      const bVal = sortBy.includes("inventory")
        ? b.variants.reduce(
            (sum: number, v: any) => sum + v.inventory_quantity,
            0
          )
        : (b?.title ?? "").toLowerCase();
      return sortBy.endsWith("desc")
        ? typeof bVal === "number"
          ? bVal - aVal
          : bVal.localeCompare(aVal)
        : typeof aVal === "number"
        ? aVal - bVal
        : aVal.localeCompare(bVal);
    });

  const filteredCustomers = filteredData.allCustomers
    .filter(
      (c) =>
        searchTerm === "" ||
        (c?.email ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = sortBy.includes("spent")
        ? parseFloat(a.total_spent)
        : a.orders_count;
      const bVal = sortBy.includes("spent")
        ? parseFloat(b.total_spent)
        : b.orders_count;
      return sortBy.endsWith("desc") ? bVal - aVal : aVal - bVal;
    });

  const overviewMetrics = {
    totalRevenue: filteredData.allOrders
      .reduce((sum, o) => sum + parseFloat(o.total_price), 0)
      .toFixed(2),
    activeOrders: filteredData.allOrders.filter(
      (o) => o.fulfillment_status !== "fulfilled"
    ).length,
    inventoryHealth:
      filteredData.allProducts.length > 0
        ? Math.round(
            (filteredData.allProducts.filter((p) =>
              p.variants.some((v) => v.inventory_quantity > 0)
            ).length /
              filteredData.allProducts.length) *
              100
          )
        : 0,
    totalCustomers: filteredData.allCustomers.length,
    lowStockCount: filteredData.allProducts.filter((p) =>
      p.variants.some((v) => v.inventory_quantity < 10)
    ).length,
  };

  const handleViewDetails = async (
    type: "order" | "product" | "customer",
    item: any,
    store: string
  ) => {
    let result;
    try {
      if (type === "order")
        result = await getOrderDetails( (store ?? "").toLowerCase() + ".com", item.id);
      if (type === "product")
        result = await getProductDetails( (store ?? "").toLowerCase() + ".com", item.id);
      if (type === "customer")
        result = await getCustomerDetails(
          (store ?? "").toLowerCase() + ".com",
          item.id
        );
      if ("error" in result) {
        toast.error(`Failed to load ${type} details: ${result.error}`);
        setSelectedItem({ type, details: null, error: result.error });
      } else {
        setSelectedItem({ type, details: result[type] });
      }
    } catch (error) {
      const message = `Failed to load ${type} details`;
      toast.error(message);
      setSelectedItem({ type, details: null, error: message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select store" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Global search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  ${overviewMetrics.totalRevenue}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Active Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  {overviewMetrics.activeOrders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Inventory Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  {overviewMetrics.inventoryHealth}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Customers
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  {overviewMetrics.totalCustomers}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  Low Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">
                  {overviewMetrics.lowStockCount}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData.revenueData}>
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
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Fulfillment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={filteredData.fulfillmentStatus}
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {filteredData.fulfillmentStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (Newest)</SelectItem>
                <SelectItem value="date_asc">Date (Oldest)</SelectItem>
                <SelectItem value="amount_desc">Amount (High)</SelectItem>
                <SelectItem value="amount_asc">Amount (Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaginatedTable
            data={filteredOrders}
            renderRow={(item) => (
              <TableRow>
                <TableCell className="font-medium">
                  {item.order_number}
                </TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell>
                  ${parseFloat(item.total_price).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {item.fulfillment_status || "Pending"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {item.customer
                    ? `${item.customer.first_name} ${item.customer.last_name}`
                    : "Guest"}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleViewDetails("order", item, item.store)
                        }
                      >
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          Order #
                          {selectedItem?.details?.order_number ||
                            item.order_number}
                        </DialogTitle>
                      </DialogHeader>
                      {selectedItem?.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {selectedItem.error}
                          </AlertDescription>
                        </Alert>
                      ) : selectedItem?.type === "order" &&
                        selectedItem.details ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Customer</Label>
                              <p>
                                {selectedItem.details.customer
                                  ? `${selectedItem.details.customer.first_name} ${selectedItem.details.customer.last_name} (${selectedItem.details.customer.email})`
                                  : "Guest"}
                              </p>
                            </div>
                            <div>
                              <Label>Total Amount</Label>
                              <p className="font-semibold">
                                ${selectedItem.details.total_price}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <Label>Shipping Address</Label>
                              <p>
                                {selectedItem.details.shipping_address
                                  ? `${selectedItem.details.shipping_address.address1}, ${selectedItem.details.shipping_address.city}, ${selectedItem.details.shipping_address.country} ${selectedItem.details.shipping_address.zip}`
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <Separator />
                          <Accordion type="single" collapsible>
                            <AccordionItem value="line_items">
                              <AccordionTrigger>
                                Line Items (
                                {selectedItem.details.line_items.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Product</TableHead>
                                      <TableHead>Quantity</TableHead>
                                      <TableHead>Price</TableHead>
                                      <TableHead>Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {selectedItem.details.line_items.map(
                                      (item: any) => (
                                        <TableRow key={item.id}>
                                          <TableCell>{item.title}</TableCell>
                                          <TableCell>{item.quantity}</TableCell>
                                          <TableCell>${item.price}</TableCell>
                                          <TableCell>
                                            $
                                            {(
                                              parseFloat(item.price) *
                                              item.quantity
                                            ).toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                  </TableBody>
                                </Table>
                              </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="tags">
                              <AccordionTrigger>Tags</AccordionTrigger>
                              <AccordionContent>
                                <div className="flex flex-wrap gap-1">
                                  {(Array.isArray(selectedItem.details.tags)
                                    ? selectedItem.details.tags
                                    : typeof selectedItem.details.tags ===
                                      "string"
                                    ? selectedItem.details.tags
                                        .split(",")
                                        .map((t: string) => t.trim())
                                        .filter(Boolean)
                                    : []
                                  ).map((tag: string, i: number) => (
                                    <Badge key={i} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      ) : (
                        <p>Loading...</p>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            )}
            headers={[
              "Order",
              "Platform",
              "Amount",
              "Status",
              "Date",
              "Customer",
              "Actions",
            ]}
            emptyMessage="No orders found"
          />
        </TabsContent>

        <TabsContent value="products">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                <SelectItem value="title_desc">Title (Z-A)</SelectItem>
                <SelectItem value="inventory_desc">Inventory (High)</SelectItem>
                <SelectItem value="inventory_asc">Inventory (Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaginatedTable
            data={filteredProducts}
            renderRow={(item) => (
              <TableRow>
                <TableCell className="font-medium max-w-xs truncate">
                  {item.title}
                </TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell
                  className={
                    item.variants.reduce(
                      (sum: number, v: any) => sum + v.inventory_quantity,
                      0
                    ) < 10
                      ? "text-red-600"
                      : ""
                  }
                >
                  {item.variants.reduce(
                    (sum: number, v: any) => sum + v.inventory_quantity,
                    0
                  )}
                </TableCell>
                <TableCell>${item.variants[0]?.price || "N/A"}</TableCell>
                <TableCell>{item.product_type}</TableCell>
                <TableCell>{item.vendor}</TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleViewDetails("product", item, item.store)
                        }
                      >
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {selectedItem?.details?.title || item.title}
                        </DialogTitle>
                      </DialogHeader>
                      {selectedItem?.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {selectedItem.error}
                          </AlertDescription>
                        </Alert>
                      ) : selectedItem?.type === "product" &&
                        selectedItem.details ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Description</Label>
                              <p className="line-clamp-4">
                                {selectedItem.details.body_html.replace(
                                  /<[^>]*>/g,
                                  ""
                                )}
                              </p>
                            </div>
                            <div>
                              <Label>Vendor</Label>
                              <p>{selectedItem.details.vendor}</p>
                            </div>
                            <div>
                              <Label>Type</Label>
                              <p>{selectedItem.details.product_type}</p>
                            </div>
                          </div>
                          <Separator />
                          <Accordion type="single" collapsible>
                            <AccordionItem value="variants">
                              <AccordionTrigger>
                                Variants ({selectedItem.details.variants.length}
                                )
                              </AccordionTrigger>
                              <AccordionContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>SKU</TableHead>
                                      <TableHead>Price</TableHead>
                                      <TableHead>Inventory</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {selectedItem.details.variants.map(
                                      (v: any) => (
                                        <TableRow key={v.id}>
                                          <TableCell>{v.sku}</TableCell>
                                          <TableCell>${v.price}</TableCell>
                                          <TableCell
                                            className={
                                              v.inventory_quantity < 10
                                                ? "text-red-600"
                                                : ""
                                            }
                                          >
                                            {v.inventory_quantity}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                  </TableBody>
                                </Table>
                              </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="tags">
                              <AccordionTrigger>Tags</AccordionTrigger>
                              <AccordionContent>
                                <div className="flex flex-wrap gap-1">
                                  {(Array.isArray(selectedItem.details.tags)
                                    ? selectedItem.details.tags
                                    : typeof selectedItem.details.tags ===
                                      "string"
                                    ? selectedItem.details.tags
                                        .split(",")
                                        .map((t: string) => t.trim())
                                        .filter(Boolean)
                                    : []
                                  ).map((tag: string, i: number) => (
                                    <Badge key={i} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      ) : (
                        <p>Loading...</p>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            )}
            headers={[
              "Product",
              "Platform",
              "Inventory",
              "Price",
              "Type",
              "Vendor",
              "Actions",
            ]}
            emptyMessage="No products found"
          />
        </TabsContent>

        <TabsContent value="customers">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spent_desc">Spent (High)</SelectItem>
                <SelectItem value="spent_asc">Spent (Low)</SelectItem>
                <SelectItem value="orders_desc">Orders (High)</SelectItem>
                <SelectItem value="orders_asc">Orders (Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaginatedTable
            data={filteredCustomers}
            renderRow={(item) => (
              <TableRow>
                <TableCell className="font-medium">
                  {item.first_name} {item.last_name}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {item.email}
                </TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell>{item.orders_count}</TableCell>
                <TableCell>
                  ${parseFloat(item.total_spent).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleViewDetails("customer", item, item.store)
                        }
                      >
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {selectedItem?.details?.first_name}{" "}
                          {selectedItem?.details?.last_name}
                        </DialogTitle>
                      </DialogHeader>
                      {selectedItem?.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {selectedItem.error}
                          </AlertDescription>
                        </Alert>
                      ) : selectedItem?.type === "customer" &&
                        selectedItem.details ? (
                        <div className="space-y-4">
                          <div>
                            <Label>Email</Label>
                            <p>{selectedItem.details.email}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Orders</Label>
                              <p>{selectedItem.details.orders_count}</p>
                            </div>
                            <div>
                              <Label>Total Spent</Label>
                              <p className="font-semibold">
                                ${selectedItem.details.total_spent}
                              </p>
                            </div>
                          </div>
                          <Separator />
                          <Accordion type="single" collapsible>
                            <AccordionItem value="addresses">
                              <AccordionTrigger>
                                Addresses (
                                {selectedItem.details.addresses.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {selectedItem.details.addresses.map(
                                    (addr: any, i: number) => (
                                      <div
                                        key={i}
                                        className="p-2 bg-gray-50 rounded"
                                      >
                                        <p>
                                          {addr.address1}, {addr.city},{" "}
                                          {addr.country} {addr.zip}
                                        </p>
                                      </div>
                                    )
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      ) : (
                        <p>Loading...</p>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            )}
            headers={[
              "Name",
              "Email",
              "Platform",
              "Orders",
              "Spent",
              "Actions",
            ]}
            emptyMessage="No customers found"
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredData.revenueData}>
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
                <CardTitle>Financial Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredData.financialStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.topProducts.filter(
                      (p) => storeFilter === "All" || p.store === storeFilter
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
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
                      <TableHead>Store</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topProducts
                      .filter(
                        (p) => storeFilter === "All" || p.store === storeFilter
                      )
                      .slice(0, 5)
                      .map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {p.name}
                          </TableCell>
                          <TableCell>{p.store}</TableCell>
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
                  <BarChart
                    data={data.topCustomers.filter(
                      (c) => storeFilter === "All" || c.store === storeFilter
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCustomers
                      .filter(
                        (c) => storeFilter === "All" || c.store === storeFilter
                      )
                      .slice(0, 5)
                      .map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {c.name}
                          </TableCell>
                          <TableCell className="truncate">{c.email}</TableCell>
                          <TableCell>{c.store}</TableCell>
                          <TableCell>${c.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}