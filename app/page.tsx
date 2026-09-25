"use client";

import MarketProvider from "@/components/market/MarketProvider";
import Hero from "@/components/site/Hero";
import Terminal from "@/components/site/Terminal";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <MarketProvider>
      <main className="min-h-screen bg-white">
        <Hero />
        <Terminal />
        <Footer withForm={false} />
      </main>
    </MarketProvider>
  );
}
