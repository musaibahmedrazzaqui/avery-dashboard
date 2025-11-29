"use client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    toast.loading("Syncing all stores...");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Synced ${data.totalOrdersSynced} orders!`);
      } else {
        toast.error("Sync failed");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
      toast.dismiss();
    }
  };

  return (
    <Button onClick={handleSync} disabled={loading} variant="default">
      {loading ? "Syncing..." : "Sync All Data"}
    </Button>
  );
}