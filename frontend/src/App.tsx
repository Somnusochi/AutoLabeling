import { ConfigProvider, theme } from "antd";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token: {
          colorPrimary: "#76b900",
        },
      }}
    >
      <Toaster position="top-center" />
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
