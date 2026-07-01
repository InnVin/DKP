import { defineConfig } from "vite"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    // CRITICAL: Use IIFE format for Android WebView file:// protocol
    // ES modules don't load from file:// due to MIME type restrictions
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        inlineDynamicImports: true,
      },
    },
    // Target older browsers for WebView compatibility
    target: "es2020",
  },
})
