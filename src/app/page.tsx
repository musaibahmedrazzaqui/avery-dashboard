import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Avery Optics Dashboard</h1>
          <p className="text-gray-600">Centralized insights from your stores</p>
        </header>
        <Dashboard />
      </div>
    </main>
  );
}