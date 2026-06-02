import { Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Outlet />
    </div>
  );
}
