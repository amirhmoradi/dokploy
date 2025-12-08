import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderSync, Trash2, Eye } from "lucide-react";
import { api } from "../lib/api";

export function MigrationList() {
  const { data: migrations = [], isLoading } = useQuery({
    queryKey: ["migrations"],
    queryFn: () => api.get("/api/migrations"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Migrations</h1>
          <p className="text-gray-500 mt-1">Manage your Portainer to Dokploy migrations</p>
        </div>
        <Link to="/migrations/new" className="btn btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Migration
        </Link>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : migrations.length === 0 ? (
          <div className="p-12 text-center">
            <FolderSync className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No migrations yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first migration</p>
            <Link to="/migrations/new" className="btn btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create Migration
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {migrations.map((migration: any) => (
                  <tr key={migration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{migration.name}</div>
                      {migration.description && (
                        <div className="text-sm text-gray-500">{migration.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="badge badge-gray capitalize">{migration.sourceType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={migration.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${migration.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">{migration.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(migration.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/migrations/${migration.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="h-4 w-4 inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
