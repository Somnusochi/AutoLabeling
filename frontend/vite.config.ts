import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    AutoImport({
      imports: [
        "react",
        "ahooks",
        {
          "react-hot-toast": ["toast"],
          "react-i18next": ["useTranslation"],
          "@tanstack/react-query": [
            "useQuery", "useMutation", "useQueryClient",
            "useInfiniteQuery", "QueryClient", "QueryClientProvider",
          ],
          "@tanstack/react-virtual": ["useVirtualizer"],
        },
      ],
      dts: "./src/auto-imports.d.ts",
      dirs: [
        "./src/hooks/**",
        "./src/components/**",
        "./src/lib/**",
        "./src/services/**",
        "./src/types/**",
        "./src/pages/**",
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react") ||
              id.includes("scheduler")
            ) {
              return "vendor-react";
            }
            if (id.includes("antd") || id.includes("@ant-design")) {
              return "vendor-antd";
            }
            if (id.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            return "vendor-libs";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.VITE_BACKEND_PORT || 8000}`,
        changeOrigin: true,
      },
    },
  },
});
