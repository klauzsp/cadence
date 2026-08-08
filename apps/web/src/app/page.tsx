import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CreateStrategyForm } from "@/components/create-strategy-form";

export default function Home() {
  return (
    <main>
      <nav>
        <a className="wordmark" href="#top" aria-label="Cadence home">
          <span className="mark">C</span>
          cadence
        </a>
        <div className="nav-right">
          <span className="network-status">
            <i /> Monad testnet
          </span>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Open strategy infrastructure</p>
          <h1>
            Invest with a rhythm.
            <span> Own the vault.</span>
          </h1>
          <p className="hero-text">
            Create transparent ERC-4626 strategies that run on schedule. No
            managers, no gatekeepers—just code and composable vault shares.
          </p>
          <div className="principles">
            <span>Permissionless creation</span>
            <span>Onchain execution</span>
            <span>Non-custodial shares</span>
          </div>
        </div>
        <CreateStrategyForm />
      </section>

      <section className="how-it-works">
        <p className="eyebrow">One strategy today. An open protocol tomorrow.</p>
        <div className="steps">
          <article>
            <span>01</span>
            <h3>Choose the pair</h3>
            <p>Select the asset your vault accepts and the token it accumulates.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Set the cadence</h3>
            <p>Define a fixed tranche and interval. Anyone can trigger a due swap.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Deposit and own</h3>
            <p>Depositors receive standard vault shares representing their position.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
