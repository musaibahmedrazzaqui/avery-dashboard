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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DashboardLayout from "@/components/DashboardLayout";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import LoadingState from "@/components/LoadingState";

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
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
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const itemsPerPage = 10;

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const store = searchParams.get("store") || "All";
  const status = searchParams.get("status") || "all";

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
    async function loadOrders() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          page: page.toString(),
        });

        if (search) params.append('search', search);
        if (store && store !== 'All') params.append('store', store);
        if (status && status !== 'all') params.append('status', status);

        const res = await fetch(`/api/dashboard/orders?${params}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [page, search, store, status]);

  if (loading && orders.length === 0) {
    return <LoadingState />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <FilterBar
          stores={stores}
          showSearch={true}
          showStoreFilter={true}
          showStatusFilter={true}
          showDateRange={true}
          statusOptions={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "partial", label: "Partial" },
            { value: "fulfilled", label: "Fulfilled" },
          ]}
          searchPlaceholder="Search orders, customers..."
        />

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>{order.store || order.store_type}</TableCell>
                      <TableCell>
                        ${parseFloat(order.total_price || "0").toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {order.fulfillment_status || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {order.customer
                          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.customer.email
                          : "Guest"}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>
                                Order #{order.order_number}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Platform</Label>
                                  <p>{order.store || order.store_type}</p>
                                </div>
                                <div>
                                  <Label>Customer</Label>
                                  <p>
                                    {order.customer
                                      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.customer.email
                                      : "Guest"}
                                  </p>
                                </div>
                                <div>
                                  <Label>Status</Label>
                                  <p>
                                    <Badge
                                      variant={
                                        order.fulfillment_status === "fulfilled"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {order.fulfillment_status || "Pending"}
                                    </Badge>
                                  </p>
                                </div>
                                <div>
                                  <Label>Total Amount</Label>
                                  <p className="font-semibold">
                                    ${parseFloat(order.total_price || "0").toFixed(2)}
                                  </p>
                                </div>
                                {order.shipping_address && (
                                  <div className="col-span-2">
                                    <Label>Shipping Address</Label>
                                    <p>
                                      {typeof order.shipping_address === 'string'
                                        ? order.shipping_address
                                        : `${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''}, ${order.shipping_address.country || ''} ${order.shipping_address.zip || ''}`}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <Separator />
                              <Accordion type="single" collapsible>
                                <AccordionItem value="line_items">
                                  <AccordionTrigger>
                                    Line Items ({order.line_items?.length || 0})
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
                                        {(order.line_items || []).map((item: any, idx: number) => (
                                          <TableRow key={idx}>
                                            <TableCell>{item.title || item.name}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>${item.price || '0.00'}</TableCell>
                                            <TableCell>
                                              ${(parseFloat(item.price || '0') * (item.quantity || 0)).toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No orders found
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
