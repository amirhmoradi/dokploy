import { Link, useLocation } from "react-router-dom";
import { Home, FolderSync, Settings, LogOut } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  license: {
    type: string;
    holder: string;
    expiresAt: string;
  };
}

export function Layout({ children, license }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Migrations", href: "/migrations", icon: FolderSync },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
        <div className="flex h-16 items-center px-6">
          <FolderSync className="h-8 w-8 text-blue-500" />
          <span className="ml-3 text-xl font-bold text-white">Migrator</span>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* License Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400">
            <p className="font-medium text-gray-300">{license.holder}</p>
            <p className="capitalize">{license.type} License</p>
            <p>Expires: {new Date(license.expiresAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-8 px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
