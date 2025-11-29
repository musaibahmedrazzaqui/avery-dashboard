"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import toast from "react-hot-toast";

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

interface DashboardContextType {
  data: Data | null;
  loading: boolean;
  syncing: boolean;
  storeFilter: string;
  setStoreFilter: (filter: string) => void;
  stores: Array<{ name: string; domain: string }>;
  refreshData: () => Promise<void>;
  handleManualSync: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [storeFilter, setStoreFilter] = useState("All");
  const [stores, setStores] = useState<Array<{ name: string; domain: string }>>([
    { name: 'All', domain: 'all' },
  ]);

  useEffect(() => {
    async function loadStores() {
      try {
        const res = await fetch('/api/stores');
        if (res.ok) {
          const data = await res.json();
          setStores(data.stores || [{ name: 'All', domain: 'all' }]);
        }
      } catch (error) {
        console.error('Error loading stores:', error);
      }
    }
    loadStores();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch('/api/dashboard/stats');
      const statsData = statsRes.ok ? await statsRes.json() : null;
      
      if (statsData) {
        setData({
          totalRevenue: statsData.totalRevenue || '0.00',
          activeOrders: statsData.activeOrders || 0,
          inventoryHealth: 0,
          totalCustomers: statsData.totalCustomers || 0,
          lowStockCount: 0,
          allOrders: [],
          allProducts: [],
          allCustomers: [],
          topProducts: statsData.topProducts || [],
          topCustomers: statsData.topCustomers || [],
          revenueData: statsData.revenueData || [],
          fulfillmentStatus: statsData.fulfillmentStatus || [],
          financialStatus: statsData.financialStatus || [],
          errors: [],
        });
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialSync: true }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Sync completed! ${result.totalOrdersSynced} orders, ${result.totalProductsSynced} products, ${result.totalCustomersSynced} customers synced.`);
        await refreshData();
      } else {
        toast.error(`Sync failed: ${result.errors?.join(', ') || result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Sync error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        data,
        loading,
        syncing,
        storeFilter,
        setStoreFilter,
        stores,
        refreshData,
        handleManualSync,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

