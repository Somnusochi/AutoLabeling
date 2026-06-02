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
          "@tanstack/react-query": [
            "useQuery", "useMutation", "useQueryClient",
            "useInfiniteQuery", "QueryClient", "QueryClientProvider",
          ],
        },
      ],
      dts: "./src/auto-imports.d.ts",
      dirs: [
        "./src/hooks",
        "./src/components",
        "./src/lib",
        "./src/services",
        "./src/types",
        "./src/pages",
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
