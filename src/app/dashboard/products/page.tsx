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

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
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
  const sort = searchParams.get("sort") || "title_asc";

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
    async function loadProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          page: page.toString(),
        });

        if (search) params.append('search', search);
        if (store && store !== 'All') params.append('store', store);
        if (sort) params.append('sort', sort);

        const res = await fetch(`/api/dashboard/products?${params}`);
        if (res.ok) {
          const data = await res.json();
          let sortedProducts = [...(data.products || [])];
          
          // Client-side sorting for inventory (can't be done server-side easily)
          if (sort === "inventory_desc") {
            sortedProducts.sort((a, b) => {
              const aInv = a.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0;
              const bInv = b.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0;
              return bInv - aInv;
            });
          } else if (sort === "inventory_asc") {
            sortedProducts.sort((a, b) => {
              const aInv = a.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0;
              const bInv = b.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0;
              return aInv - bInv;
            });
          }

          setProducts(sortedProducts);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [page, search, store, sort]);

  if (loading && products.length === 0) {
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
            { value: "title_asc", label: "Title (A-Z)" },
            { value: "title_desc", label: "Title (Z-A)" },
            { value: "inventory_desc", label: "Inventory (High)" },
            { value: "inventory_asc", label: "Inventory (Low)" },
          ]}
          searchPlaceholder="Search products..."
        />

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Inventory</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length > 0 ? (
                  products.map((product) => {
                    const totalInventory = product.variants?.reduce(
                      (sum: number, v: any) => sum + (v.inventory_quantity || 0),
                      0
                    ) || 0;
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {product.title}
                        </TableCell>
                        <TableCell>{product.store || product.store_type}</TableCell>
                        <TableCell className={totalInventory < 10 ? "text-red-600" : ""}>
                          {totalInventory}
                        </TableCell>
                        <TableCell>
                          ${product.variants?.[0]?.price || "N/A"}
                        </TableCell>
                        <TableCell>{product.product_type || "N/A"}</TableCell>
                        <TableCell>{product.vendor || "N/A"}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{product.title}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Description</Label>
                                    <p className="line-clamp-4 text-sm text-gray-600">
                                      {product.body_html?.replace(/<[^>]*>/g, "") || "No description"}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Vendor</Label>
                                    <p>{product.vendor || "N/A"}</p>
                                  </div>
                                  <div>
                                    <Label>Type</Label>
                                    <p>{product.product_type || "N/A"}</p>
                                  </div>
                                  <div>
                                    <Label>Platform</Label>
                                    <p>{product.store || product.store_type}</p>
                                  </div>
                                </div>
                                <Separator />
                                <Accordion type="single" collapsible>
                                  <AccordionItem value="variants">
                                    <AccordionTrigger>
                                      Variants ({product.variants?.length || 0})
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
                                          {(product.variants || []).map((v: any, idx: number) => (
                                            <TableRow key={v.id || idx}>
                                              <TableCell>{v.sku || "N/A"}</TableCell>
                                              <TableCell>${v.price || "0.00"}</TableCell>
                                              <TableCell className={(v.inventory_quantity || 0) < 10 ? "text-red-600" : ""}>
                                                {v.inventory_quantity || 0}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </AccordionContent>
                                  </AccordionItem>
                                  {product.tags && product.tags.length > 0 && (
                                    <AccordionItem value="tags">
                                      <AccordionTrigger>Tags</AccordionTrigger>
                                      <AccordionContent>
                                        <div className="flex flex-wrap gap-1">
                                          {(Array.isArray(product.tags)
                                            ? product.tags
                                            : typeof product.tags === "string"
                                            ? product.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
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
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No products found
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
