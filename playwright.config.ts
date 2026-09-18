import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
    },
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 4175 --mode test --strictPort",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: true,
    },
    {
      command: "npm run build && npm run preview -- --port 4176 --strictPort",
      url: "http://127.0.0.1:4176",
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
