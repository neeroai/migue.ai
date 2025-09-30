import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowItWorks';
import { UseCases } from './components/UseCases';
import { Benefits } from './components/Benefits';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <Navigation />

      <div className="pt-16">
        <Hero />
      </div>

      <section id="features">
        <Features />
      </section>

      <section id="how-it-works">
        <HowItWorks />
      </section>

      <section id="use-cases">
        <UseCases />
      </section>

      <section id="benefits">
        <Benefits />
      </section>

      <section id="faq">
        <FAQ />
      </section>

      <Footer />
    </main>
  );
}