import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Nav } from "@/components/Nav";
import { Pricing } from "@/components/Pricing";

export default function HomePage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />
        <Hero />
        <HowItWorks />
        <Pricing />
        <Footer />
      </div>
    </>
  );
}
