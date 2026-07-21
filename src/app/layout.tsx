import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

/**
 * Inter na interface (o mais próximo do SF Pro que dá pra servir na web) e um
 * serif só na marca — o toque editorial, sem comprometer a legibilidade de
 * quem usa isso no celular todo dia.
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio",
  description: "Vídeos de produto para o TikTok Shop, no automático.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${inter.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col scrollbar-subtle">
        {children}
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
