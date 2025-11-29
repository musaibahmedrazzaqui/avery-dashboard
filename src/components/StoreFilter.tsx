// app/dashboard/components/StoreFilter.tsx
"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StoreFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stores, setStores] = useState<{ name: string; domain: string }[]>([
    { name: "All", domain: "all" },
  ]);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => {
        setStores([{ name: "All", domain: "all" }, ...(data.stores || [])]);
      });
  }, []);

  const current = searchParams.get("store") || "All";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("store", value);
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
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
  );
}