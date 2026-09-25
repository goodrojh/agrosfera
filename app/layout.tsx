import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "АгроСфера — котировки масличного льна",
  description:
    "Цены и свободные объёмы производителей масличного льна в реальном времени. Разбивка по регионам и направлениям экспорта: Китай, Казахстан, Каспий, Чёрное море.",
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
