import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ActionHost from "@/components/site/ActionHost";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "АгроСфера — сводка предложений предприятий",
  description:
    "Ежедневная сводка предложений проверенных предприятий: регион, объём, влажность, сорная примесь, масличность и цена. Оставьте заявку — АгроСфера проведёт сделку и доставит груз в нужную точку.",
};

export const viewport: Viewport = {
  themeColor: "#07160a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {children}
        <ActionHost />
      </body>
    </html>
  );
}
