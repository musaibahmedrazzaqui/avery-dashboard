"use client";

import React from "react";
import DashboardLayout from "@/components/DashboardLayout";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <DashboardLayout>
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </DashboardLayout>
  );
}

