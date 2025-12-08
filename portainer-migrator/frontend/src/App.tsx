import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { LicenseActivation } from "./pages/LicenseActivation";
import { Dashboard } from "./pages/Dashboard";
import { MigrationList } from "./pages/MigrationList";
import { NewMigration } from "./pages/NewMigration";
import { MigrationDetail } from "./pages/MigrationDetail";
import { api } from "./lib/api";

function App() {
  const { data: licenseData, isLoading } = useQuery({
    queryKey: ["license"],
    queryFn: () => api.get("/api/license"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasLicense = licenseData?.license;

  if (!hasLicense) {
    return <LicenseActivation />;
  }

  return (
    <Layout license={licenseData.license}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/migrations" element={<MigrationList />} />
        <Route path="/migrations/new" element={<NewMigration />} />
        <Route path="/migrations/:id" element={<MigrationDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
