import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    strictPort: false,
    watch: {
      ignored: ["**/_node_modules_old/**", "**/backups/**"]
    }
  },
  plugins: [
    react({ jsxDev: false }),
  ].filter(Boolean),
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') }
    ]
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: false
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
}));
