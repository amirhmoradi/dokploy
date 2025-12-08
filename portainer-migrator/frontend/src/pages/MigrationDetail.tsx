import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Square, RotateCcw, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

export function MigrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: migration, isLoading } = useQuery({
    queryKey: ["migration", id],
    queryFn: () => api.get(`/api/migrations/${id}`),
    refetchInterval: (data) =>
      data?.status === "running" || data?.status === "analyzing" ? 2000 : false,
  });

  const { data: stats } = useQuery({
    queryKey: ["migration-stats", id],
    queryFn: () => api.get(`/api/migrations/${id}/statistics`),
    enabled: !!migration,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["migration-logs", id],
    queryFn: () => api.get(`/api/migrations/${id}/logs?limit=50`),
    enabled: !!migration,
    refetchInterval: migration?.status === "running" ? 3000 : false,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.post(`/api/migrations/${id}/analyze`),
    onSuccess: () => {
      toast.success("Analysis started");
      queryClient.invalidateQueries({ queryKey: ["migration", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const executeMutation = useMutation({
    mutationFn: (isDryRun: boolean) =>
      api.post(`/api/migrations/${id}/execute`, { isDryRun }),
    onSuccess: () => {
      toast.success("Migration started");
      queryClient.invalidateQueries({ queryKey: ["migration", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/api/migrations/${id}/cancel`),
    onSuccess: () => {
      toast.success("Migration cancelled");
      queryClient.invalidateQueries({ queryKey: ["migration", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/migrations/${id}`),
    onSuccess: () => {
      toast.success("Migration deleted");
      navigate("/migrations");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!migration) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Migration not found</p>
      </div>
    );
  }

  const canAnalyze = ["pending"].includes(migration.status);
  const canExecute = ["ready", "failed", "completed"].includes(migration.status);
  const canCancel = ["running", "analyzing"].includes(migration.status);
  const canDelete = !["running", "analyzing"].includes(migration.status);

  return (
    <div>
      <button
        onClick={() => navigate("/migrations")}
        className="flex items-center text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Migrations
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{migration.name}</h1>
          {migration.description && (
            <p className="text-gray-500 mt-1">{migration.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canAnalyze && (
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="btn btn-secondary"
            >
              <Play className="h-4 w-4 mr-2" />
              Analyze
            </button>
          )}
          {canExecute && (
            <>
              <button
                onClick={() => executeMutation.mutate(true)}
                disabled={executeMutation.isPending}
                className="btn btn-secondary"
              >
                <Play className="h-4 w-4 mr-2" />
                Dry Run
              </button>
              <button
                onClick={() => executeMutation.mutate(false)}
                disabled={executeMutation.isPending}
                className="btn btn-primary"
              >
                <Play className="h-4 w-4 mr-2" />
                Execute
              </button>
            </>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="btn btn-danger"
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this migration?")) {
                  deleteMutation.mutate();
                }
              }}
              className="btn btn-secondary text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status and Progress */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <StatusBadge status={migration.status} />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="text-2xl font-bold text-gray-900">{migration.progress}%</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                migration.status === "failed" ? "bg-red-500" : "bg-blue-600"
              }`}
              style={{ width: `${migration.progress}%` }}
            />
          </div>
          {migration.currentStep && (
            <p className="text-sm text-gray-500 mt-2">{migration.currentStep}</p>
          )}
          {migration.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{migration.errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, color: "gray" },
            { label: "Pending", value: stats.pending, color: "gray" },
            { label: "Completed", value: stats.completed, color: "green" },
            { label: "Failed", value: stats.failed, color: "red" },
            { label: "Skipped", value: stats.skipped, color: "yellow" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Logs</h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No logs yet</div>
          ) : (
            logs.map((log: any) => (
              <div key={log.id} className="p-3 text-sm">
                <div className="flex items-start gap-3">
                  <LogLevelBadge level={log.level} />
                  <div className="flex-1">
                    <p className="text-gray-900">{log.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
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

function LogLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    debug: "bg-gray-100 text-gray-600",
    info: "bg-blue-100 text-blue-600",
    warning: "bg-yellow-100 text-yellow-600",
    error: "bg-red-100 text-red-600",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || colors.info}`}>
      {level}
    </span>
  );
}
