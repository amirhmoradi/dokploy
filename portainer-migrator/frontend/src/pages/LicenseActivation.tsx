import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderSync, Key, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

export function LicenseActivation() {
  const [licenseKey, setLicenseKey] = useState("");
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: (key: string) => api.post("/api/license/activate", { licenseKey: key }),
    onSuccess: () => {
      toast.success("License activated successfully!");
      queryClient.invalidateQueries({ queryKey: ["license"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (licenseKey.trim()) {
      activateMutation.mutate(licenseKey.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <FolderSync className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Portainer Migrator</h1>
          <p className="text-gray-400 mt-2">
            Migrate your Portainer setup to Dokploy with ease
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Key className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Activate License</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="license" className="label mb-1">
                License Key
              </label>
              <input
                type="text"
                id="license"
                placeholder="PM-XXXX-XXXX-XXXX-XXXX"
                className="input"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                disabled={activateMutation.isPending}
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter your license key to activate the product
              </p>
            </div>

            <button
              type="submit"
              disabled={!licenseKey.trim() || activateMutation.isPending}
              className="btn btn-primary w-full"
            >
              {activateMutation.isPending ? (
                "Activating..."
              ) : (
                <>
                  Activate License
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Don't have a license?{" "}
              <a href="https://dokploy.com/portainer-migrator" className="text-blue-600 hover:underline">
                Purchase one here
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Need help?{" "}
          <a href="mailto:support@dokploy.com" className="text-blue-400 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
