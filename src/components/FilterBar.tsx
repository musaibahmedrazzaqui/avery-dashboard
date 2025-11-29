"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface FilterBarProps {
  stores: Array<{ name: string; domain: string }>;
  showSearch?: boolean;
  showStoreFilter?: boolean;
  showStatusFilter?: boolean;
  showDateRange?: boolean;
  showSortBy?: boolean;
  statusOptions?: Array<{ value: string; label: string }>;
  sortOptions?: Array<{ value: string; label: string }>;
  searchPlaceholder?: string;
}

export default function FilterBar({
  stores,
  showSearch = true,
  showStoreFilter = true,
  showStatusFilter = false,
  showDateRange = false,
  showSortBy = false,
  statusOptions = [],
  sortOptions = [],
  searchPlaceholder = "Search...",
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [storeFilter, setStoreFilter] = useState(searchParams.get("store") || "All");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || "");

  const updateURL = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "All" && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    // Reset to page 1 when filters change
    params.delete("page");
    params.set("page", "1");
    
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    updateURL({ search: value || null });
  };

  const handleStoreChange = (value: string) => {
    setStoreFilter(value);
    updateURL({ store: value });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    updateURL({ status: value });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    updateURL({ sort: value });
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    updateURL({ date_from: value || null });
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    updateURL({ date_to: value || null });
  };

  const clearFilters = () => {
    setSearch("");
    setStoreFilter("All");
    setStatusFilter("all");
    setSortBy("");
    setDateFrom("");
    setDateTo("");
    router.push("?", { scroll: false });
  };

  const hasActiveFilters = 
    search || 
    (storeFilter && storeFilter !== "All") || 
    (statusFilter && statusFilter !== "all") || 
    sortBy || 
    dateFrom || 
    dateTo;

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {showStoreFilter && (
        <Select value={storeFilter} onValueChange={handleStoreChange}>
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
      )}

      {showStatusFilter && statusOptions.length > 0 && (
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showSortBy && sortOptions.length > 0 && (
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showDateRange && (
        <>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="w-full sm:w-[150px]"
            placeholder="From"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="w-full sm:w-[150px]"
            placeholder="To"
          />
        </>
      )}

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="w-full sm:w-auto"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

