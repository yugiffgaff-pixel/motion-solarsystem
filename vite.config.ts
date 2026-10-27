import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5173 },
  build: {
    modulePreload: false,
    rolldownOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/app.js",
      },
    },
  },
  plugins: [
    {
      name: "classic-script-for-file-open",
      apply: "build",
      transformIndexHtml(html) {
        return html
          .replaceAll(' type="module" crossorigin', "")
          .replaceAll(" crossorigin", "")
          .replace(
            /<script src="(\.\/assets\/app\.js)"><\/script>/,
            '<script defer src="$1"></script>',
          );
      },
    },
  ],
});
