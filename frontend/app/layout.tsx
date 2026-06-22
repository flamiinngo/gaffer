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
    type: "website",
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
