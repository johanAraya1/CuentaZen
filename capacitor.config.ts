import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cuentazen.app",
  appName: "Cuenta Zen",
  webDir: ".next",
  server: {
    // Produccion web desplegada en Vercel (WebView remota)
    url: process.env.CAPACITOR_SERVER_URL ?? "https://casita-en-orden.vercel.app",
    cleartext: false,
    androidScheme: "https"
  }
};

export default config;
