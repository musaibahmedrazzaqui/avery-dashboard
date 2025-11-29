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

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<any[]>([]);
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
  const search = searchParams.get("search") || "";
  const store = searchParams.get("store") || "All";
  const sort = searchParams.get("sort") || "spent_desc";

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
    async function loadCustomers() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          page: page.toString(),
        });

        if (search) params.append('search', search);
        if (store && store !== 'All') params.append('store', store);
        if (sort) params.append('sort', sort);

        const res = await fetch(`/api/dashboard/customers?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, [page, search, store, sort]);

  if (loading && customers.length === 0) {
    return <LoadingState />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <FilterBar
          stores={stores}
          showSearch={true}
          showStoreFilter={true}
          showSortBy={true}
          sortOptions={[
            { value: "spent_desc", label: "Spent (High)" },
            { value: "spent_asc", label: "Spent (Low)" },
            { value: "orders_desc", label: "Orders (High)" },
            { value: "orders_asc", label: "Orders (Low)" },
          ]}
          searchPlaceholder="Search customers..."
        />

        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {customer.email}
                      </TableCell>
                      <TableCell>{customer.store || customer.store_type}</TableCell>
                      <TableCell>{customer.orders_count || 0}</TableCell>
                      <TableCell>
                        ${parseFloat(customer.total_spent || "0").toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>
                                {customer.first_name} {customer.last_name}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Email</Label>
                                <p>{customer.email}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Orders</Label>
                                  <p>{customer.orders_count || 0}</p>
                                </div>
                                <div>
                                  <Label>Total Spent</Label>
                                  <p className="font-semibold">
                                    ${parseFloat(customer.total_spent || "0").toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <Label>Platform</Label>
                                <p>{customer.store || customer.store_type}</p>
                              </div>
                              {customer.addresses && customer.addresses.length > 0 && (
                                <>
                                  <Separator />
                                  <Accordion type="single" collapsible>
                                    <AccordionItem value="addresses">
                                      <AccordionTrigger>
                                        Addresses ({customer.addresses.length})
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="space-y-2">
                                          {customer.addresses.map((addr: any, i: number) => (
                                            <div
                                              key={i}
                                              className="p-2 bg-gray-50 rounded"
                                            >
                                              <p>
                                                {addr.address1 || addr.street1 || ''}, {addr.city || ''},{" "}
                                                {addr.country || addr.stateOrProvince || ''} {addr.zip || addr.postalCode || ''}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                </>
                              )}
                              {customer.tags && customer.tags.length > 0 && (
                                <>
                                  <Separator />
                                  <div>
                                    <Label>Tags</Label>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {(Array.isArray(customer.tags)
                                        ? customer.tags
                                        : typeof customer.tags === "string"
                                        ? customer.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                                        : []
                                      ).map((tag: string, i: number) => (
                                        <Badge key={i} variant="secondary">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No customers found
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
