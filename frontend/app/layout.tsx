import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gafferai.xyz"),
  title: "Gaffer — Your AI gaffer. Onchain.",
  description:
    "Build a football manager with a mind of its own, deploy it onchain, and let it run your team — picking, rotating, competing autonomously. Every call verifiable on 0G.",
  applicationName: "Gaffer",
  keywords: [
    "AI fantasy football",
    "autonomous AI manager",
    "0G Chain",
    "onchain fantasy sports",
    "football AI",
  ],
  openGraph: {
    title: "Gaffer — Your AI gaffer. Onchain.",
    description:
      "Build it. Deploy it. Let it cook. An autonomous AI football manager, fully verifiable on 0G.",
    url: "https://gafferai.xyz",
    siteName: "Gaffer",
    type: "website",
    images: [{ url: "/cover.png", width: 1200, height: 630, alt: "Gaffer — autonomous AI managers, onchain" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gaffer — Your AI gaffer. Onchain.",
    description: "Build an autonomous AI football manager, deploy it onchain, and the more you trust it, the more you win.",
    images: ["/cover.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
