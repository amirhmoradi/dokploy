import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Server, Database, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

type SourceType = "api" | "boltdb";

export function NewMigration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sourceType: "api" as SourceType,
    portainerUrl: "",
    portainerApiKey: "",
    portainerUsername: "",
    portainerPassword: "",
    boltDbPath: "",
    stackFilesPath: "",
    isDryRun: true,
    migrateStacks: true,
    migrateRegistries: true,
    migrateEndpoints: true,
    migrateEnvironmentVariables: true,
  });

  const testMutation = useMutation({
    mutationFn: () => api.post("/api/test-connection", formData),
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Connection successful!");
        setStep(3);
      } else {
        toast.error(data.error || "Connection failed");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/migrations", formData),
    onSuccess: (data) => {
      toast.success("Migration created!");
      navigate(`/migrations/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </button>

      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">New Migration</h1>
          <p className="text-gray-500 mt-1">Create a new Portainer to Dokploy migration</p>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {["Basic Info", "Source Config", "Options", "Review"].map((label, i) => (
              <div key={label} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step > i + 1
                      ? "bg-green-500 text-white"
                      : step === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="ml-2 text-sm text-gray-600 hidden sm:inline">{label}</span>
                {i < 3 && <div className="w-12 h-0.5 bg-gray-200 mx-2 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label mb-1">Migration Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="My Portainer Migration"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Optional description..."
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-2">Source Type *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => updateField("sourceType", "api")}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      formData.sourceType === "api"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Server className="h-6 w-6 text-blue-600 mb-2" />
                    <p className="font-medium">Portainer API</p>
                    <p className="text-sm text-gray-500">Connect to running instance</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("sourceType", "boltdb")}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      formData.sourceType === "boltdb"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Database className="h-6 w-6 text-blue-600 mb-2" />
                    <p className="font-medium">BoltDB File</p>
                    <p className="text-sm text-gray-500">Import from backup</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Source Config */}
          {step === 2 && (
            <div className="space-y-4">
              {formData.sourceType === "api" ? (
                <>
                  <div>
                    <label className="label mb-1">Portainer URL *</label>
                    <input
                      type="url"
                      className="input"
                      placeholder="https://portainer.example.com"
                      value={formData.portainerUrl}
                      onChange={(e) => updateField("portainerUrl", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1">API Key</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="ptr_..."
                      value={formData.portainerApiKey}
                      onChange={(e) => updateField("portainerApiKey", e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Or use username/password below
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1">Username</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.portainerUsername}
                        onChange={(e) => updateField("portainerUsername", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label mb-1">Password</label>
                      <input
                        type="password"
                        className="input"
                        value={formData.portainerPassword}
                        onChange={(e) => updateField("portainerPassword", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label mb-1">BoltDB File Path *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="/path/to/portainer.db"
                      value={formData.boltDbPath}
                      onChange={(e) => updateField("boltDbPath", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Stack Files Path</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="/path/to/compose (optional)"
                      value={formData.stackFilesPath}
                      onChange={(e) => updateField("stackFilesPath", e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Options */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <p className="font-medium text-yellow-800">Dry Run Mode</p>
                  <p className="text-sm text-yellow-600">
                    Test migration without creating resources
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-blue-600 rounded"
                  checked={formData.isDryRun}
                  onChange={(e) => updateField("isDryRun", e.target.checked)}
                />
              </div>
              <div className="space-y-3">
                <p className="font-medium text-gray-700">What to migrate:</p>
                {[
                  { key: "migrateStacks", label: "Docker Compose Stacks" },
                  { key: "migrateRegistries", label: "Container Registries" },
                  { key: "migrateEndpoints", label: "Endpoints (as Servers)" },
                  { key: "migrateEnvironmentVariables", label: "Environment Variables" },
                ].map((option) => (
                  <label key={option.key} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 rounded"
                      checked={(formData as any)[option.key]}
                      onChange={(e) => updateField(option.key, e.target.checked)}
                    />
                    <span className="ml-2 text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Migration Summary</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Name:</dt>
                    <dd className="text-gray-900">{formData.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Source:</dt>
                    <dd className="text-gray-900 capitalize">{formData.sourceType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Dry Run:</dt>
                    <dd className="text-gray-900">{formData.isDryRun ? "Yes" : "No"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="btn btn-secondary"
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  testMutation.mutate();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              className="btn btn-primary"
              disabled={
                (step === 1 && !formData.name) ||
                (step === 2 && testMutation.isPending)
              }
            >
              {step === 2 ? (
                testMutation.isPending ? "Testing..." : "Test & Continue"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Migration"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
