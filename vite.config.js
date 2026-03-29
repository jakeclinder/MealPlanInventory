import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    // Generates a transpiled fallback bundle for older browsers.
    // Targets iOS 12+ Safari, which covers iPads that can no longer
    // receive iOS updates but still need to run the app.
    // This fixes blank-page crashes caused by unsupported syntax like
    // optional chaining (?.) and nullish coalescing (??) on iOS < 13.4.
    legacy({
      targets: ["ios >= 12", "safari >= 12"],
    }),
  ],
});
