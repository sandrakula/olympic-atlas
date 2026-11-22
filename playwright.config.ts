import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:3149";
const deployed = process.env.ATLAS_E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: deployed ?? origin,
    channel: process.env.ATLAS_E2E_CHANNEL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: deployed ? undefined : {
    command: "npm start -- --hostname 127.0.0.1 --port 3149",
    url: origin,
    env: { ATLAS_SITE_URL: origin, NEXT_TELEMETRY_DISABLED: "1" },
    timeout: 45_000,
  },
});
