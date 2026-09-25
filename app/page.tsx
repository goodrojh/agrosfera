"use client";

import MarketProvider from "@/components/market/MarketProvider";
import Hero from "@/components/site/Hero";
import Terminal from "@/components/site/Terminal";
import Features from "@/components/site/Features";
import HowItWorks from "@/components/site/HowItWorks";
import Partners from "@/components/site/Partners";
import Crops from "@/components/site/Crops";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <MarketProvider>
      <main className="min-h-screen">
        <Hero />
        <Terminal />
        <Features />
        <HowItWorks />
        <Partners />
        <Crops />
        <FAQ />
        <Footer />
      </main>
    </MarketProvider>
  );
}
