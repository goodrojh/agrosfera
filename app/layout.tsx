import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "АгроСфера — котировки агрокультур от предприятий",
  description:
    "Цены и свободные объёмы предприятий-производителей и заявки покупателей по регионам России. Сделки между предприятиями, экспортёрами и агентами проводит АгроСфера.",
};

export const viewport: Viewport = {
  themeColor: "#07160a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
