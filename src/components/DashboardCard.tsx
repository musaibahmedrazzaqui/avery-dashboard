// app/dashboard/components/DashboardCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        {trend && <p className="text-sm font-medium text-green-600 mt-2">{trend}</p>}
      </CardContent>
    </Card>
  );
}