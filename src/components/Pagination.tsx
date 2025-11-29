"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  total,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-end gap-2 mt-4 items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        ← Previous
      </Button>
      <span className="text-sm text-gray-600">
        Page {currentPage} of {totalPages} ({total} total)
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
      >
        Next →
      </Button>
    </div>
  );
}

