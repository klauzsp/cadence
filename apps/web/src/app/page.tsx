import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { CreateStrategyForm } from "@/components/create-strategy-form";

export default function Home() {
  return (
    <main>
      <AppNav />

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>
            Deploy a strategy
            <span>Attract capital</span>
          </h1>
          <p className="hero-text">
            Creating investment strategies has traditionally been restrictive.
            Not with Cadence. Create permissionless, transparent strategies and
            rise to the top of the <Link href="/vaults">leaderboards</Link>.
          </p>
        </div>
        <CreateStrategyForm />
      </section>

      <section className="about-cadence" aria-labelledby="about-cadence-title">
        <div className="about-frame">
          <div className="about-intro">
            <div>
              <p className="eyebrow">About Cadence</p>
              <h2 id="about-cadence-title">
                Investment strategy creation has been kept behind closed doors.
              </h2>
            </div>
            <div className="about-copy">
              <p>
                Traditionally, institutions create investment products,
                platforms decide which ones reach the market, and investors
                choose from a finished menu.
              </p>
              <p>
                Cadence opens that process. Any wallet can publish a strategy as
                an investable vault, attract capital, and let transparent
                onchain rules run it automatically.
              </p>
            </div>
          </div>

          <div
            className="about-shift"
            aria-label="Traditional investment model compared with Cadence"
          >
            <article>
              <span>The old model</span>
              <strong>
                Institutions create.
                <br />
                Platforms distribute.
                <br />
                Investors choose.
              </strong>
            </article>
            <span className="about-arrow" aria-hidden="true">
              →
            </span>
            <article className="cadence-model">
              <span>With Cadence</span>
              <strong>
                Anyone creates.
                <br />
                Capital chooses.
                <br />
                Onchain rules execute.
              </strong>
            </article>
          </div>
        </div>
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
