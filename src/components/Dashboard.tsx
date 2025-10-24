"use client";

import React, { useState, useEffect, JSX } from "react";
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
import {
  EbayBuyer,
  EbayOrder,
  EbayProduct,
  getEbayBuyerDetails,
  getEbayOrderDetails,
  getEbayProductDetails,
} from "@/lib/ebay";

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

interface PaginatedTableProps<T extends { id?: string | number }> {
  data: T[];
  itemsPerPage?: number;
  renderRow: (item: T) => JSX.Element;
  headers: string[];
  emptyMessage: string;
}

function PaginatedTable<T extends { id?: string | number }>({
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

interface OrderDetailsResponse {
  order: any;
}

interface ProductDetailsResponse {
  product: any;
}

interface CustomerDetailsResponse {
  customer: any;
}

interface ErrorResponse {
  error: string;
}

interface EbayOrderDetailsResponse {
  order: EbayOrder;
}

interface EbayProductDetailsResponse {
  product: EbayProduct;
}

interface EbayBuyerDetailsResponse {
  buyer: EbayBuyer;
}

type DetailsResponse =
  | OrderDetailsResponse
  | ProductDetailsResponse
  | CustomerDetailsResponse
  | EbayOrderDetailsResponse
  | EbayProductDetailsResponse
  | EbayBuyerDetailsResponse
  | ErrorResponse;

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [storeFilter, setStoreFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [searchType, setSearchType] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [profitDateRange, setProfitDateRange] = useState("30");
  const [profitStartDate, setProfitStartDate] = useState("");
  const [profitEndDate, setProfitEndDate] = useState("");
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

  const filteredData: Omit<
    Data,
    | "totalRevenue"
    | "activeOrders"
    | "inventoryHealth"
    | "totalCustomers"
    | "lowStockCount"
    | "errors"
    | "topProducts"
    | "topCustomers"
  > & { revenueData: { date: string; revenue: number }[] } = {
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
      .reduce(
        (sum: number, o: any) => sum + parseFloat(o.total_price || "0"),
        0
      );
    filteredData.revenueData.push({ date: dateStr, revenue: dailyRevenue });
  }

  const filteredOrders = filteredData.allOrders
    .filter((o: any) => {
      if (searchTerm === "" || !searchTerm) return true;

      const search = searchTerm.toString().toLowerCase();

      // Apply search type filters
      if (searchType === "customer") {
        const customerName = o.customer ? 
          `${o.customer.first_name} ${o.customer.last_name}`.toLowerCase() : 
          "guest";
        return customerName.includes(search);
      } else if (searchType === "location") {
        const city = (o.shipping_address?.city || "").toLowerCase();
        const country = (o.shipping_address?.country || "").toLowerCase();
        const state = (o.shipping_address?.stateOrProvince || "").toLowerCase();
        return city.includes(search) || country.includes(search) || state.includes(search);
      } else if (searchType === "order") {
        const orderNumber = (o.order_number ?? "").toString().toLowerCase();
        return orderNumber.includes(search);
      } else if (searchType === "product") {
        return o.line_items.some((item: any) => 
          (item.title || "").toLowerCase().includes(search)
        );
      } else {
        // Global search
        const orderNumber = (o.order_number ?? "").toString();
        const totalPrice = (o.total_price ?? "").toString();
        const customerName = o.customer ? 
          `${o.customer.first_name} ${o.customer.last_name}` : "";
        const city = o.shipping_address?.city || "";
        const country = o.shipping_address?.country || "";

        return (
          orderNumber.toLowerCase().includes(search) ||
          totalPrice.includes(search) ||
          customerName.toLowerCase().includes(search) ||
          city.toLowerCase().includes(search) ||
          country.toLowerCase().includes(search) ||
          o.line_items.some((item: any) => 
            (item.title || "").toLowerCase().includes(search)
          )
        );
      }
    })
    .filter((o: any) => {
      // Apply location filter if set
      if (locationFilter !== "all") {
        return o.shipping_address?.country === locationFilter;
      }
      return true;
    })
    .filter((o: any) => {
      if (statusFilter === "all") return true;
      const fulfillmentStatus = (o.fulfillment_status ?? "").toString();
      return fulfillmentStatus.toLowerCase() === statusFilter.toLowerCase();
    })
    .sort((a: any, b: any) => {
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
      (p: any) => {
        if (searchTerm === "" || !searchTerm) return true;

        const search = searchTerm.toString().toLowerCase();

        if (searchType === "product" || searchType === "all") {
          const title = (p?.title ?? "").toLowerCase();
          const vendor = (p?.vendor ?? "").toLowerCase();
          const productType = (p?.product_type ?? "").toLowerCase();
          return title.includes(search) || vendor.includes(search) || productType.includes(search);
        }
        return true;
      }
    )
    .sort((a: any, b: any) => {
      const aVal = sortBy.includes("inventory")
        ? a.variants.reduce(
            (sum: number, v: any) => sum + (v.inventory_quantity || 0),
            0
          )
        : (a?.title ?? "").toLowerCase();
      const bVal = sortBy.includes("inventory")
        ? b.variants.reduce(
            (sum: number, v: any) => sum + (v.inventory_quantity || 0),
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
      (c: any) => {
        if (searchTerm === "" || !searchTerm) return true;

        const search = searchTerm.toString().toLowerCase();

        if (searchType === "customer" || searchType === "all") {
          const customerName = `${c.first_name} ${c.last_name}`.toLowerCase();
          const email = (c.email || "").toLowerCase();
          return customerName.includes(search) || email.includes(search);
        }
        return true;
      }
    )
    .sort((a: any, b: any) => {
      const aVal = sortBy.includes("spent")
        ? parseFloat(a.total_spent || "0")
        : a.orders_count || 0;
      const bVal = sortBy.includes("spent")
        ? parseFloat(b.total_spent || "0")
        : b.orders_count || 0;
      return sortBy.endsWith("desc") ? bVal - aVal : aVal - bVal;
    });

  const overviewMetrics = {
    totalRevenue: filteredData.allOrders
      .reduce(
        (sum: number, o: any) => sum + parseFloat(o.total_price || "0"),
        0
      )
      .toFixed(2),
    activeOrders: filteredData.allOrders.filter(
      (o: any) => o.fulfillment_status !== "fulfilled"
    ).length,
    inventoryHealth:
      filteredData.allProducts.length > 0
        ? Math.round(
            (filteredData.allProducts.filter((p: any) =>
              p.variants.some((v: any) => (v.inventory_quantity || 0) > 0)
            ).length /
              filteredData.allProducts.length) *
              100
          )
        : 0,
    totalCustomers: filteredData.allCustomers.length,
    lowStockCount: filteredData.allProducts.filter((p: any) =>
      p.variants.some((v: any) => (v.inventory_quantity || 0) < 10)
    ).length,
  };

  const handleViewDetails = async (
    type: "order" | "product" | "customer",
    item: any,
    store: string
  ) => {
    let result: DetailsResponse | undefined;
    try {
      if (store === "eBay") {
        // eBay details
        if (type === "order")
          result = await getEbayOrderDetails(item.orderId || item.id);
        else if (type === "product")
          result = await getEbayProductDetails(item.itemId || item.id);
        else if (type === "customer")
          result = await getEbayBuyerDetails(item.username || item.email);
      } else {
        // Shopify details
        if (type === "order")
          result = await getOrderDetails(store.toLowerCase() + ".com", item.id);
        else if (type === "product")
          result = await getProductDetails(
            store.toLowerCase() + ".com",
            item.id
          );
        else if (type === "customer")
          result = await getCustomerDetails(
            store.toLowerCase() + ".com",
            item.id
          );
      }

      if (!result) {
        throw new Error("No result returned");
      }

      if ("error" in result) {
        toast.error(`Failed to load ${type} details: ${result.error}`);
        setSelectedItem({ type, details: null, error: result.error });
      } else {
        let details: any;
        if (type === "order") {
          details =
            store === "eBay"
              ? (result as EbayOrderDetailsResponse).order
              : (result as OrderDetailsResponse).order;
        } else if (type === "product") {
          details =
            store === "eBay"
              ? (result as EbayProductDetailsResponse).product
              : (result as ProductDetailsResponse).product;
        } else {
          details =
            store === "eBay"
              ? (result as EbayBuyerDetailsResponse).buyer
              : (result as CustomerDetailsResponse).customer;
        }
        setSelectedItem({ type, details });
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
        
        <Select value={searchType} onValueChange={setSearchType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Search type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="customer">Customer Name</SelectItem>
            <SelectItem value="location">Location</SelectItem>
            <SelectItem value="order">Order Number</SelectItem>
            <SelectItem value="product">Product</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder={
            searchType === "customer" ? "Search by customer name..." :
            searchType === "location" ? "Search by city, state, or country..." :
            searchType === "order" ? "Search by order number..." :
            searchType === "product" ? "Search by product name..." :
            "Global search..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md"
        />

        {searchType === "location" && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(() => {
                const locations = Array.from(new Set(
                  filteredData.allOrders
                    .map((order: any) => order.shipping_address?.country)
                    .filter(Boolean)
                )).sort();
                return locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="profit">Profit Analysis</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
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
                    label={(props: any) => {
                      const { name, percent } = props;
                      return `${name} ${(percent * 100).toFixed(0)}%`;
                    }}
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
            renderRow={(item: any) => (
              <TableRow>
                <TableCell className="font-medium">
                  {item.order_number}
                </TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell>
                  ${parseFloat(item.total_price || "0").toFixed(2)}
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
                          {selectedItem?.details?.store === "eBay" && " (eBay)"}
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
                              <Label>Platform</Label>
                              <p>{selectedItem.details.store || "eBay"}</p>
                            </div>
                            <div>
                              <Label>Customer</Label>
                              <p>
                                {selectedItem.details.customer
                                  ? `${selectedItem.details.customer.first_name} ${selectedItem.details.customer.last_name} (${selectedItem.details.customer.email})`
                                  : selectedItem.details.buyer
                                  ? `${selectedItem.details.buyer.username} (${selectedItem.details.buyer.email})`
                                  : "Guest"}
                              </p>
                            </div>
                            <div>
                              <Label>Status</Label>
                              <p>
                                <Badge
                                  variant={
                                    selectedItem.details.fulfillment_status ===
                                    "fulfilled"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {selectedItem.details.fulfillment_status ||
                                    selectedItem.details.orderStatus ||
                                    "Pending"}
                                </Badge>
                              </p>
                            </div>
                            <div>
                              <Label>Total Amount</Label>
                              <p className="font-semibold">
                                $
                                {selectedItem.details.total_price ||
                                  selectedItem.details.totalPrice}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <Label>Shipping Address</Label>
                              <p>
                                {selectedItem.details.shipping_address
                                  ? `${selectedItem.details.shipping_address.address1}, ${selectedItem.details.shipping_address.city}, ${selectedItem.details.shipping_address.country} ${selectedItem.details.shipping_address.zip}`
                                  : selectedItem.details.shippingAddress
                                  ? `${selectedItem.details.shippingAddress.street1}, ${selectedItem.details.shippingAddress.city}, ${selectedItem.details.shippingAddress.stateOrProvince} ${selectedItem.details.shippingAddress.postalCode}`
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <Separator />
                          <Accordion type="single" collapsible>
                            <AccordionItem value="line_items">
                              <AccordionTrigger>
                                Line Items (
                                {selectedItem.details.line_items?.length ||
                                  selectedItem.details.lineItems?.length ||
                                  0}
                                )
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
                                    {(
                                      selectedItem.details.line_items ||
                                      selectedItem.details.lineItems ||
                                      []
                                    ).map((lineItem: any) => (
                                      <TableRow
                                        key={lineItem.id || lineItem.itemId}
                                      >
                                        <TableCell>{lineItem.title}</TableCell>
                                        <TableCell>
                                          {lineItem.quantity}
                                        </TableCell>
                                        <TableCell>${lineItem.price}</TableCell>
                                        <TableCell>
                                          $
                                          {(
                                            parseFloat(lineItem.price || "0") *
                                            (lineItem.quantity || 0)
                                          ).toFixed(2)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </AccordionContent>
                            </AccordionItem>
                            {selectedItem.details.tags &&
                              selectedItem.details.tags.length > 0 && (
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
                              )}
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
            renderRow={(item: any) => (
              <TableRow>
                <TableCell className="font-medium max-w-xs truncate">
                  {item.title}
                </TableCell>
                <TableCell>{item.store}</TableCell>
                <TableCell
                  className={
                    item.variants.reduce(
                      (sum: number, v: any) =>
                        sum + (v.inventory_quantity || 0),
                      0
                    ) < 10
                      ? "text-red-600"
                      : ""
                  }
                >
                  {item.variants.reduce(
                    (sum: number, v: any) => sum + (v.inventory_quantity || 0),
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
                                {selectedItem.details.body_html?.replace(
                                  /<[^>]*>/g,
                                  ""
                                ) || ""}
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
                                Variants (
                                {selectedItem.details.variants?.length || 0})
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
                                    {selectedItem.details.variants?.map(
                                      (v: any) => (
                                        <TableRow key={v.id}>
                                          <TableCell>{v.sku}</TableCell>
                                          <TableCell>${v.price}</TableCell>
                                          <TableCell
                                            className={
                                              (v.inventory_quantity || 0) < 10
                                                ? "text-red-600"
                                                : ""
                                            }
                                          >
                                            {v.inventory_quantity}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    ) || []}
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
            renderRow={(item: any) => (
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
                  ${parseFloat(item.total_spent || "0").toFixed(2)}
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
                                {selectedItem.details.addresses?.length || 0})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {selectedItem.details.addresses?.map(
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
                                  ) || []}
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
                      (p: any) =>
                        storeFilter === "All" || p.store === storeFilter
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
                        (p: any) =>
                          storeFilter === "All" || p.store === storeFilter
                      )
                      .slice(0, 5)
                      .map((p: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {p.name}
                          </TableCell>
                          <TableCell>{p.store}</TableCell>
                          <TableCell>{p.units}</TableCell>
                          <TableCell>${(p.revenue || 0).toFixed(2)}</TableCell>
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
                      (c: any) =>
                        storeFilter === "All" || c.store === storeFilter
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
                        (c: any) =>
                          storeFilter === "All" || c.store === storeFilter
                      )
                      .slice(0, 5)
                      .map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {c.name}
                          </TableCell>
                          <TableCell className="truncate">{c.email}</TableCell>
                          <TableCell>{c.store}</TableCell>
                          <TableCell>${(c.total || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financials">
          <div className="space-y-6">
            {/* Outstanding Invoices */}
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
                      <TableHead>Last Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const outstandingInvoices = filteredData.allOrders
                        .filter((order: any) => order.financial_status === 'pending' || order.financial_status === 'partially_paid')
                        .reduce((acc: any, order: any) => {
                          const customerKey = order.customer ? `${order.customer.email}-${order.store}` : `guest-${order.id}`;
                          if (!acc[customerKey]) {
                            acc[customerKey] = {
                              customer: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Guest',
                              email: order.customer?.email || 'N/A',
                              platform: order.store,
                              outstandingAmount: 0,
                              invoiceCount: 0,
                              lastOrderDate: order.created_at,
                              status: order.financial_status
                            };
                          }
                          acc[customerKey].outstandingAmount += parseFloat(order.total_price || '0');
                          acc[customerKey].invoiceCount += 1;
                          if (new Date(order.created_at) > new Date(acc[customerKey].lastOrderDate)) {
                            acc[customerKey].lastOrderDate = order.created_at;
                          }
                          return acc;
                        }, {});

                      return Object.values(outstandingInvoices)
                        .sort((a: any, b: any) => b.outstandingAmount - a.outstandingAmount)
                        .slice(0, 10)
                        .map((invoice: any, index: number) => (
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
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Margins Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Margins Analysis (Recent Orders)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {(() => {
                    const recentOrders = filteredData.allOrders
                      .filter((order: any) => {
                        const orderDate = new Date(order.created_at);
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return orderDate >= thirtyDaysAgo;
                      });

                    const totalRevenue = recentOrders.reduce((sum: number, order: any) => 
                      sum + parseFloat(order.total_price || '0'), 0);

                    // Estimate COGS as 60% of revenue (this would ideally come from actual cost data)
                    const estimatedCOGS = totalRevenue * 0.6;
                    const grossMarginDollars = totalRevenue - estimatedCOGS;
                    const grossMarginPercent = totalRevenue > 0 ? (grossMarginDollars / totalRevenue) * 100 : 0;

                    return (
                      <>
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Total Revenue (30 days)</p>
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
                      </>
                    );
                  })()}
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(() => {
                    const dailyMargins = [];
                    for (let i = 6; i >= 0; i--) {
                      const date = new Date();
                      date.setDate(date.getDate() - i);
                      const dateStr = date.toISOString().split('T')[0];
                      const dayOrders = filteredData.allOrders.filter((o: any) => o.created_at.startsWith(dateStr));
                      const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
                      const dayCOGS = dayRevenue * 0.6; // Estimated
                      const dayMargin = dayRevenue - dayCOGS;
                      dailyMargins.push({
                        date: dateStr,
                        revenue: dayRevenue,
                        margin: dayMargin,
                        marginPercent: dayRevenue > 0 ? (dayMargin / dayRevenue) * 100 : 0
                      });
                    }
                    return dailyMargins;
                  })()}>
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

            {/* Inventory Value */}
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
                        ${(() => {
                          const totalValue = filteredData.allProducts.reduce((sum: number, product: any) => {
                            return sum + product.variants.reduce((variantSum: number, variant: any) => {
                              return variantSum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0');
                            }, 0);
                          }, 0);
                          return totalValue.toFixed(2);
                        })()}
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
                        {(() => {
                          const platformValues = filteredData.allProducts.reduce((acc: any, product: any) => {
                            if (!acc[product.store]) {
                              acc[product.store] = { value: 0, items: 0 };
                            }
                            const productValue = product.variants.reduce((sum: number, variant: any) => 
                              sum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0'), 0);
                            acc[product.store].value += productValue;
                            acc[product.store].items += product.variants.reduce((sum: number, v: any) => 
                              sum + (v.inventory_quantity || 0), 0);
                            return acc;
                          }, {});

                          return Object.entries(platformValues).map(([platform, data]: [string, any]) => (
                            <TableRow key={platform}>
                              <TableCell className="font-medium">{platform}</TableCell>
                              <TableCell>${data.value.toFixed(2)}</TableCell>
                              <TableCell>{data.items}</TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profit">
          <div className="space-y-6">
            {/* Date Range Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Profit Analysis - Custom Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label htmlFor="profit-range">Quick Range</Label>
                    <Select value={profitDateRange} onValueChange={setProfitDateRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="180">Last 6 months</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {profitDateRange === "custom" && (
                    <>
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={profitStartDate}
                          onChange={(e) => setProfitStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={profitEndDate}
                          onChange={(e) => setProfitEndDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  
                  
                </div>
              </CardContent>
            </Card>

            {/* Profit Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const getDateRange = () => {
                  if (profitDateRange === "custom" && profitStartDate && profitEndDate) {
                    return { start: new Date(profitStartDate), end: new Date(profitEndDate) };
                  }
                  const days = parseInt(profitDateRange);
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - days);
                  return { start, end };
                };

                const { start, end } = getDateRange();
                const filteredOrders = filteredData.allOrders.filter((order: any) => {
                  const orderDate = new Date(order.created_at);
                  return orderDate >= start && orderDate <= end;
                });

                const totalRevenue = filteredOrders.reduce((sum: number, order: any) => 
                  sum + parseFloat(order.total_price || '0'), 0);

                // More sophisticated COGS calculation based on product categories
                const cogsByCategory = {
                  'Electronics': 0.65, // 65% COGS
                  'Accessories': 0.55, // 55% COGS
                  'Camera': 0.70, // 70% COGS
                  'Lens': 0.75, // 75% COGS
                  'Tripod': 0.60, // 60% COGS
                  'Lighting': 0.65, // 65% COGS
                  'Audio': 0.60, // 60% COGS
                  'Storage': 0.50, // 50% COGS
                  'Uncategorized': 0.60 // Default 60% COGS
                };

                let totalCOGS = 0;
                filteredOrders.forEach((order: any) => {
                  order.line_items.forEach((item: any) => {
                    const product = filteredData.allProducts.find(p => 
                      p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                    );
                    const category = product?.product_type || 'Uncategorized';
                    const cogsRate = cogsByCategory[category as keyof typeof cogsByCategory] || 0.60;
                    totalCOGS += parseFloat(item.price || '0') * (item.quantity || 0) * cogsRate;
                  });
                });

                const grossProfit = totalRevenue - totalCOGS;
                const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

                // Estimate operating expenses (typically 15-25% of revenue)
                const operatingExpenses = totalRevenue * 0.20; // 20% estimate
                const netProfit = grossProfit - operatingExpenses;
                const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

                return (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-600">Total Revenue</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{filteredOrders.length} orders</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-600">Gross Profit</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-blue-600">${grossProfit.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{grossMarginPercent.toFixed(1)}% margin</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-600">Net Profit</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-purple-600">${netProfit.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{netMarginPercent.toFixed(1)}% margin</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-gray-600">Avg Order Value</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-orange-600">
                          ${filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : '0.00'}
                        </p>
                        <p className="text-xs text-gray-500">per order</p>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* Detailed Profit Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Profit Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Profit by Platform</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>COGS</TableHead>
                          <TableHead>Gross Profit</TableHead>
                          <TableHead>Margin %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const getDateRange = () => {
                            if (profitDateRange === "custom" && profitStartDate && profitEndDate) {
                              return { start: new Date(profitStartDate), end: new Date(profitEndDate) };
                            }
                            const days = parseInt(profitDateRange);
                            const end = new Date();
                            const start = new Date();
                            start.setDate(start.getDate() - days);
                            return { start, end };
                          };

                          const { start, end } = getDateRange();
                          const platformStats = filteredData.allOrders
                            .filter((order: any) => {
                              const orderDate = new Date(order.created_at);
                              return orderDate >= start && orderDate <= end;
                            })
                            .reduce((acc: any, order: any) => {
                              if (!acc[order.store]) {
                                acc[order.store] = { revenue: 0, cogs: 0, orders: 0 };
                              }
                              acc[order.store].revenue += parseFloat(order.total_price || '0');
                              acc[order.store].orders += 1;
                              
                              // Calculate COGS for this order
                              order.line_items.forEach((item: any) => {
                                const product = filteredData.allProducts.find(p => 
                                  p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                                );
                                const category = product?.product_type || 'Uncategorized';
                                const cogsRates: Record<string, number> = {
                                  'Electronics': 0.65, 'Accessories': 0.55, 'Camera': 0.70,
                                  'Lens': 0.75, 'Tripod': 0.60, 'Lighting': 0.65,
                                  'Audio': 0.60, 'Storage': 0.50, 'Uncategorized': 0.60
                                };
                                const cogsRate = cogsRates[category] || 0.60;
                                acc[order.store].cogs += parseFloat(item.price || '0') * (item.quantity || 0) * cogsRate;
                              });
                              return acc;
                            }, {});

                          return Object.entries(platformStats).map(([platform, stats]: [string, any]) => {
                            const grossProfit = stats.revenue - stats.cogs;
                            const marginPercent = stats.revenue > 0 ? (grossProfit / stats.revenue) * 100 : 0;
                            return (
                              <TableRow key={platform}>
                                <TableCell className="font-medium">{platform}</TableCell>
                                <TableCell>${stats.revenue.toFixed(2)}</TableCell>
                                <TableCell>${stats.cogs.toFixed(2)}</TableCell>
                                <TableCell className={grossProfit >= 0 ? "text-green-600" : "text-red-600"}>
                                  ${grossProfit.toFixed(2)}
                                </TableCell>
                                <TableCell className={marginPercent >= 0 ? "text-green-600" : "text-red-600"}>
                                  {marginPercent.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-4">Profit by Product Category</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>COGS</TableHead>
                          <TableHead>Gross Profit</TableHead>
                          <TableHead>Margin %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const getDateRange = () => {
                            if (profitDateRange === "custom" && profitStartDate && profitEndDate) {
                              return { start: new Date(profitStartDate), end: new Date(profitEndDate) };
                            }
                            const days = parseInt(profitDateRange);
                            const end = new Date();
                            const start = new Date();
                            start.setDate(start.getDate() - days);
                            return { start, end };
                          };

                          const { start, end } = getDateRange();
                          const categoryStats = filteredData.allOrders
                            .filter((order: any) => {
                              const orderDate = new Date(order.created_at);
                              return orderDate >= start && orderDate <= end;
                            })
                            .reduce((acc: any, order: any) => {
                              order.line_items.forEach((item: any) => {
                                const product = filteredData.allProducts.find(p => 
                                  p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                                );
                                const category = product?.product_type || 'Uncategorized';
                                
                                if (!acc[category]) {
                                  acc[category] = { revenue: 0, cogs: 0, units: 0 };
                                }
                                
                                const itemRevenue = parseFloat(item.price || '0') * (item.quantity || 0);
                                const cogsRates: Record<string, number> = {
                                  'Electronics': 0.65, 'Accessories': 0.55, 'Camera': 0.70,
                                  'Lens': 0.75, 'Tripod': 0.60, 'Lighting': 0.65,
                                  'Audio': 0.60, 'Storage': 0.50, 'Uncategorized': 0.60
                                };
                                const cogsRate = cogsRates[category] || 0.60;
                                
                                acc[category].revenue += itemRevenue;
                                acc[category].cogs += itemRevenue * cogsRate;
                                acc[category].units += item.quantity || 0;
                              });
                              return acc;
                            }, {});

                          return Object.entries(categoryStats)
                            .map(([category, stats]: [string, any]) => {
                              const grossProfit = stats.revenue - stats.cogs;
                              const marginPercent = stats.revenue > 0 ? (grossProfit / stats.revenue) * 100 : 0;
                              return { category, ...stats, grossProfit, marginPercent };
                            })
                            .sort((a, b) => b.grossProfit - a.grossProfit)
                            .slice(0, 10)
                            .map((stat, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{stat.category}</TableCell>
                                <TableCell>${stat.revenue.toFixed(2)}</TableCell>
                                <TableCell>${stat.cogs.toFixed(2)}</TableCell>
                                <TableCell className={stat.grossProfit >= 0 ? "text-green-600" : "text-red-600"}>
                                  ${stat.grossProfit.toFixed(2)}
                                </TableCell>
                                <TableCell className={stat.marginPercent >= 0 ? "text-green-600" : "text-red-600"}>
                                  {stat.marginPercent.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profit Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Profit Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={(() => {
                    const getDateRange = () => {
                      if (profitDateRange === "custom" && profitStartDate && profitEndDate) {
                        return { start: new Date(profitStartDate), end: new Date(profitEndDate) };
                      }
                      const days = parseInt(profitDateRange);
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - days);
                      return { start, end };
                    };

                    const { start, end } = getDateRange();
                    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const dataPoints = Math.min(daysDiff, 30); // Limit to 30 data points for readability
                    
                    const trendData = [];
                    for (let i = 0; i < dataPoints; i++) {
                      const date = new Date(start);
                      date.setDate(date.getDate() + i);
                      const dateStr = date.toISOString().split('T')[0];
                      
                      const dayOrders = filteredData.allOrders.filter((o: any) => o.created_at.startsWith(dateStr));
                      const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
                      
                      let dayCOGS = 0;
                      dayOrders.forEach((order: any) => {
                        order.line_items.forEach((item: any) => {
                          const product = filteredData.allProducts.find(p => 
                            p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                          );
                          const category = product?.product_type || 'Uncategorized';
                          const cogsRates: Record<string, number> = {
                            'Electronics': 0.65, 'Accessories': 0.55, 'Camera': 0.70,
                            'Lens': 0.75, 'Tripod': 0.60, 'Lighting': 0.65,
                            'Audio': 0.60, 'Storage': 0.50, 'Uncategorized': 0.60
                          };
                          const cogsRate = cogsRates[category] || 0.60;
                          dayCOGS += parseFloat(item.price || '0') * (item.quantity || 0) * cogsRate;
                        });
                      });
                      
                      const dayGrossProfit = dayRevenue - dayCOGS;
                      const dayOperatingExpenses = dayRevenue * 0.20;
                      const dayNetProfit = dayGrossProfit - dayOperatingExpenses;
                      
                      trendData.push({
                        date: dateStr,
                        revenue: dayRevenue,
                        cogs: dayCOGS,
                        grossProfit: dayGrossProfit,
                        operatingExpenses: dayOperatingExpenses,
                        netProfit: dayNetProfit
                      });
                    }
                    
                    return trendData;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="grossProfit" stroke="#3b82f6" strokeWidth={2} name="Gross Profit" />
                    <Line type="monotone" dataKey="netProfit" stroke="#8b5cf6" strokeWidth={2} name="Net Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Profitable Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Profitable Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Units Sold</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>COGS</TableHead>
                      <TableHead>Gross Profit</TableHead>
                      <TableHead>Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const getDateRange = () => {
                        if (profitDateRange === "custom" && profitStartDate && profitEndDate) {
                          return { start: new Date(profitStartDate), end: new Date(profitEndDate) };
                        }
                        const days = parseInt(profitDateRange);
                        const end = new Date();
                        const start = new Date();
                        start.setDate(start.getDate() - days);
                        return { start, end };
                      };

                      const { start, end } = getDateRange();
                      const productStats = new Map();
                      
                      filteredData.allOrders
                        .filter((order: any) => {
                          const orderDate = new Date(order.created_at);
                          return orderDate >= start && orderDate <= end;
                        })
                        .forEach((order: any) => {
                          order.line_items.forEach((item: any) => {
                            const product = filteredData.allProducts.find(p => 
                              p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                            );
                            const category = product?.product_type || 'Uncategorized';
                            const productKey = `${item.title}-${order.store}`;
                            
                            if (!productStats.has(productKey)) {
                              productStats.set(productKey, {
                                title: item.title,
                                category,
                                platform: order.store,
                                units: 0,
                                revenue: 0,
                                cogs: 0
                              });
                            }
                            
                            const itemRevenue = parseFloat(item.price || '0') * (item.quantity || 0);
                            const cogsRates: Record<string, number> = {
                              'Electronics': 0.65, 'Accessories': 0.55, 'Camera': 0.70,
                              'Lens': 0.75, 'Tripod': 0.60, 'Lighting': 0.65,
                              'Audio': 0.60, 'Storage': 0.50, 'Uncategorized': 0.60
                            };
                            const cogsRate = cogsRates[category] || 0.60;
                            
                            const stats = productStats.get(productKey);
                            stats.units += item.quantity || 0;
                            stats.revenue += itemRevenue;
                            stats.cogs += itemRevenue * cogsRate;
                          });
                        });

                      return Array.from(productStats.values())
                        .map(product => ({
                          ...product,
                          grossProfit: product.revenue - product.cogs,
                          marginPercent: product.revenue > 0 ? ((product.revenue - product.cogs) / product.revenue) * 100 : 0
                        }))
                        .sort((a, b) => b.grossProfit - a.grossProfit)
                        .slice(0, 15)
                        .map((product, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.title}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell>{product.platform}</TableCell>
                            <TableCell>{product.units}</TableCell>
                            <TableCell>${product.revenue.toFixed(2)}</TableCell>
                            <TableCell>${product.cogs.toFixed(2)}</TableCell>
                            <TableCell className={product.grossProfit >= 0 ? "text-green-600" : "text-red-600"}>
                              ${product.grossProfit.toFixed(2)}
                            </TableCell>
                            <TableCell className={product.marginPercent >= 0 ? "text-green-600" : "text-red-600"}>
                              {product.marginPercent.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            {/* Revenue with Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={(() => {
                    const periods = [];
                    const now = new Date();
                    
                    if (sortBy === 'day') {
                      for (let i = 6; i >= 0; i--) {
                        const date = new Date(now);
                        date.setDate(date.getDate() - i);
                        const dateStr = date.toISOString().split('T')[0];
                        const dayRevenue = filteredData.allOrders
                          .filter((o: any) => o.created_at.startsWith(dateStr))
                          .reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
                        periods.push({ period: dateStr, revenue: dayRevenue });
                      }
                    } else if (sortBy === 'week') {
                      for (let i = 3; i >= 0; i--) {
                        const weekStart = new Date(now);
                        weekStart.setDate(weekStart.getDate() - (i * 7));
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        const weekRevenue = filteredData.allOrders
                          .filter((o: any) => {
                            const orderDate = new Date(o.created_at);
                            return orderDate >= weekStart && orderDate <= weekEnd;
                          })
                          .reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
                        periods.push({ period: `Week ${4-i}`, revenue: weekRevenue });
                      }
                    } else if (sortBy === 'month') {
                      for (let i = 5; i >= 0; i--) {
                        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
                        const monthRevenue = filteredData.allOrders
                          .filter((o: any) => {
                            const orderDate = new Date(o.created_at);
                            return orderDate >= monthStart && orderDate <= monthEnd;
                          })
                          .reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
                        periods.push({ period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), revenue: monthRevenue });
                      }
                    }
                    
                    return periods;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Product Category */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Product Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          const categoryRevenue = filteredData.allOrders.reduce((acc: any, order: any) => {
                            order.line_items.forEach((item: any) => {
                              // Use product type as category, fallback to 'Uncategorized'
                              const category = filteredData.allProducts.find(p => 
                                p.line_items?.some((li: any) => li.title === item.title)
                              )?.product_type || 'Uncategorized';
                              
                              if (!acc[category]) acc[category] = 0;
                              acc[category] += parseFloat(item.price || '0') * (item.quantity || 0);
                            });
                            return acc;
                          }, {});

                          return Object.entries(categoryRevenue)
                            .map(([name, value]) => ({ name, value: value as number }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 8);
                        })()}
                        labelLine={false}
                        label={(props: any) => {
                          const { name, percent } = props;
                          return `${name} ${(percent * 100).toFixed(0)}%`;
                        }}
                      >
                        {(() => {
                          const categoryRevenue = filteredData.allOrders.reduce((acc: any, order: any) => {
                            order.line_items.forEach((item: any) => {
                              const category = filteredData.allProducts.find(p => 
                                p.line_items?.some((li: any) => li.title === item.title)
                              )?.product_type || 'Uncategorized';
                              
                              if (!acc[category]) acc[category] = 0;
                              acc[category] += parseFloat(item.price || '0') * (item.quantity || 0);
                            });
                            return acc;
                          }, {});

                          return Object.entries(categoryRevenue)
                            .map(([name, value]) => ({ name, value: value as number }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 8);
                        })().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const categoryStats = filteredData.allOrders.reduce((acc: any, order: any) => {
                          order.line_items.forEach((item: any) => {
                            const category = filteredData.allProducts.find(p => 
                              p.line_items?.some((li: any) => li.title === item.title)
                            )?.product_type || 'Uncategorized';
                            
                            if (!acc[category]) {
                              acc[category] = { revenue: 0, orders: new Set() };
                            }
                            acc[category].revenue += parseFloat(item.price || '0') * (item.quantity || 0);
                            acc[category].orders.add(order.id);
                          });
                          return acc;
                        }, {});

                        return Object.entries(categoryStats)
                          .map(([category, stats]: [string, any]) => ({
                            category,
                            revenue: stats.revenue,
                            orders: stats.orders.size
                          }))
                          .sort((a, b) => b.revenue - a.revenue)
                          .slice(0, 10)
                          .map((stat, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{stat.category}</TableCell>
                              <TableCell>${stat.revenue.toFixed(2)}</TableCell>
                              <TableCell>{stat.orders}</TableCell>
                            </TableRow>
                          ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Top Selling SKUs by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Top Selling SKUs by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Units Sold</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const skuSales = new Map();
                      filteredData.allOrders.forEach((order: any) => {
                        order.line_items.forEach((item: any) => {
                          const product = filteredData.allProducts.find(p => 
                            p.variants.some((v: any) => v.sku === item.sku || p.title === item.title)
                          );
                          const category = product?.product_type || 'Uncategorized';
                          const sku = item.sku || `${item.title}-${order.store}`;
                          
                          if (!skuSales.has(sku)) {
                            skuSales.set(sku, {
                              sku,
                              title: item.title,
                              category,
                              platform: order.store,
                              units: 0,
                              revenue: 0
                            });
                          }
                          const skuData = skuSales.get(sku);
                          skuData.units += item.quantity || 0;
                          skuData.revenue += parseFloat(item.price || '0') * (item.quantity || 0);
                        });
                      });

                      return Array.from(skuSales.values())
                        .sort((a, b) => b.units - a.units)
                        .slice(0, 20)
                        .map((sku, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{sku.sku}</TableCell>
                            <TableCell>{sku.title}</TableCell>
                            <TableCell>{sku.category}</TableCell>
                            <TableCell>{sku.platform}</TableCell>
                            <TableCell>{sku.units}</TableCell>
                            <TableCell>${sku.revenue.toFixed(2)}</TableCell>
                          </TableRow>
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sales Channel Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Channel Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const channelStats = filteredData.allOrders.reduce((acc: any, order: any) => {
                        if (!acc[order.store]) {
                          acc[order.store] = { revenue: 0, orders: 0, customers: new Set() };
                        }
                        acc[order.store].revenue += parseFloat(order.total_price || '0');
                        acc[order.store].orders += 1;
                        if (order.customer?.email) {
                          acc[order.store].customers.add(order.customer.email);
                        }
                        return acc;
                      }, {});

                      return Object.entries(channelStats).map(([channel, stats]: [string, any]) => ({
                        channel,
                        revenue: stats.revenue,
                        orders: stats.orders,
                        customers: stats.customers.size
                      }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="channel" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                      <Bar dataKey="orders" fill="#10b981" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Avg Order Value</TableHead>
                        <TableHead>Customers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const channelStats = filteredData.allOrders.reduce((acc: any, order: any) => {
                          if (!acc[order.store]) {
                            acc[order.store] = { revenue: 0, orders: 0, customers: new Set() };
                          }
                          acc[order.store].revenue += parseFloat(order.total_price || '0');
                          acc[order.store].orders += 1;
                          if (order.customer?.email) {
                            acc[order.store].customers.add(order.customer.email);
                          }
                          return acc;
                        }, {});

                        return Object.entries(channelStats)
                          .map(([channel, stats]: [string, any]) => ({
                            channel,
                            revenue: stats.revenue,
                            orders: stats.orders,
                            avgOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
                            customers: stats.customers.size
                          }))
                          .sort((a, b) => b.revenue - a.revenue)
                          .map((stat, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{stat.channel}</TableCell>
                              <TableCell>${stat.revenue.toFixed(2)}</TableCell>
                              <TableCell>{stat.orders}</TableCell>
                              <TableCell>${stat.avgOrderValue.toFixed(2)}</TableCell>
                              <TableCell>{stat.customers}</TableCell>
                            </TableRow>
                          ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Order Patterns & Geographical Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Order Patterns & Geographical Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Orders by Country</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Country</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const countryStats = filteredData.allOrders.reduce((acc: any, order: any) => {
                            const country = order.shipping_address?.country || 'Unknown';
                            if (!acc[country]) {
                              acc[country] = { orders: 0, revenue: 0 };
                            }
                            acc[country].orders += 1;
                            acc[country].revenue += parseFloat(order.total_price || '0');
                            return acc;
                          }, {});

                          return Object.entries(countryStats)
                            .map(([country, stats]: [string, any]) => ({ country, ...stats }))
                            .sort((a, b) => b.orders - a.orders)
                            .slice(0, 10)
                            .map((stat, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{stat.country}</TableCell>
                                <TableCell>{stat.orders}</TableCell>
                                <TableCell>${stat.revenue.toFixed(2)}</TableCell>
                              </TableRow>
                            ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Orders by City</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const cityStats = filteredData.allOrders.reduce((acc: any, order: any) => {
                            const city = order.shipping_address?.city || 'Unknown';
                            const country = order.shipping_address?.country || 'Unknown';
                            const key = `${city}, ${country}`;
                            if (!acc[key]) {
                              acc[key] = { city, country, orders: 0 };
                            }
                            acc[key].orders += 1;
                            return acc;
                          }, {});

                          return Object.values(cityStats)
                            .sort((a: any, b: any) => b.orders - a.orders)
                            .slice(0, 10)
                            .map((stat: any, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{stat.city}</TableCell>
                                <TableCell>{stat.country}</TableCell>
                                <TableCell>{stat.orders}</TableCell>
                              </TableRow>
                            ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
