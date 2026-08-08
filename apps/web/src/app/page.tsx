import { AppNav } from "@/components/app-nav";
import { CreateStrategyForm } from "@/components/create-strategy-form";

export default function Home() {
  return (
    <main>
      <AppNav />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"></p>
          <h1>
            Deploy a strategy
            <span>Attract capital</span>
          </h1>
          <p className="hero-text">
            Investment strategies have traditionally been restrictive.
            Institutions decide which products get created, platforms decide
            which products get listed, and most investors can only choose from
            the finished menu. Not with Cadence. Anyone can create
            permissionless, transparent investment strategies strategies on
            Monad.
          </p>
        </div>
        <CreateStrategyForm />
      </section>

      <section className="how-it-works">
        <p className="eyebrow">How it works</p>
        <div className="steps">
          <article>
            <span>01</span>
            <h3>Select your strategy</h3>
            <p>
              Choose your strategy, such as dollar cost averaging every minute.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Set the logic</h3>
            <p>Define what makes your strategy unique</p>
          </article>
          <article>
            <span>03</span>
            <h3>Deposit and own</h3>
            <p>Deposit and own shares in the vault position.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
