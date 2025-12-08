import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderSync, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";

export function Dashboard() {
  const { data: migrations = [], isLoading } = useQuery({
    queryKey: ["migrations"],
    queryFn: () => api.get("/api/migrations"),
  });

  const stats = {
    total: migrations.length,
    completed: migrations.filter((m: any) => m.status === "completed").length,
    failed: migrations.filter((m: any) => m.status === "failed").length,
    pending: migrations.filter((m: any) => ["pending", "ready", "analyzing"].includes(m.status)).length,
    running: migrations.filter((m: any) => m.status === "running").length,
  };

  const recentMigrations = migrations.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your migration activities</p>
        </div>
        <Link to="/migrations/new" className="btn btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Migration
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Migrations"
          value={stats.total}
          icon={FolderSync}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="In Progress"
          value={stats.running + stats.pending}
          icon={Clock}
          color="yellow"
        />
      </div>

      {/* Recent Migrations */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Migrations</h2>
            <Link to="/migrations" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : recentMigrations.length === 0 ? (
          <div className="p-8 text-center">
            <FolderSync className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No migrations yet</p>
            <Link to="/migrations/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
              Create your first migration
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentMigrations.map((migration: any) => (
              <Link
                key={migration.id}
                to={`/migrations/${migration.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{migration.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(migration.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={migration.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: number;
  icon: any;
  color: "blue" | "green" | "red" | "yellow";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
  };

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    pending: { class: "badge-gray", label: "Pending" },
    analyzing: { class: "badge-info", label: "Analyzing" },
    ready: { class: "badge-info", label: "Ready" },
    running: { class: "badge-warning", label: "Running" },
    completed: { class: "badge-success", label: "Completed" },
    failed: { class: "badge-error", label: "Failed" },
    cancelled: { class: "badge-gray", label: "Cancelled" },
  };

  const { class: badgeClass, label } = config[status] || config.pending;

  return <span className={`badge ${badgeClass}`}>{label}</span>;
}
