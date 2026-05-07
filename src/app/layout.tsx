import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { ThemeProvider, themeBootstrapScript } from "@/components/theme-provider";
import { AriaRouterProvider } from "@/components/router-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { PwaSplash } from "@/components/pwa-splash";
import { Toaster } from "sonner";

const fontSans = localFont({
  src: [
    {
      path: "../fonts/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/InterVariable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-inter",
});

const fontMono = localFont({
  src: [
    { path: "../fonts/geist-mono.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist-mono",
});

const appName = "Books";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: "Lightweight double-entry accounting.",
  applicationName: appName,
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${fontSans.variable} ${fontMono.variable} antialiased`}>
        <ThemeProvider>
          <PwaSplash />
          <AriaRouterProvider>{children}</AriaRouterProvider>
          <Toaster richColors closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
