"use client";

import MarketProvider from "@/components/market/MarketProvider";
import Hero from "@/components/site/Hero";
import Features from "@/components/site/Features";
import HowItWorks from "@/components/site/HowItWorks";
import Partners from "@/components/site/Partners";
import Metric from "@/components/site/Metric";
import Crops from "@/components/site/Crops";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <MarketProvider>
      <main className="min-h-screen">
        <Hero />
        <Features />
        <HowItWorks />
        <Partners />
        <Metric />
        <Crops />
        <FAQ />
        <Footer />
      </main>
    </MarketProvider>
  );
}
