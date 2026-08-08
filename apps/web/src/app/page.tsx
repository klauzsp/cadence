import { AppNav } from "@/components/app-nav";
import { CreateStrategyForm } from "@/components/create-strategy-form";

export default function Home() {
  return (
    <main>
      <AppNav />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true">✦</span> Open strategy infrastructure</p>
          <h1>
            Automated investing,
            <span> open to everyone.</span>
          </h1>
          <p className="hero-text">
            Create transparent ERC-4626 strategies on Monad. Choose DCA or
            threshold rebalancing, invite deposits, and let permissionless
            automation handle execution.
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
        <p className="eyebrow">Two strategies. One permissionless factory.</p>
        <div className="steps">
          <article>
            <span>01</span>
            <h3>Choose the pair</h3>
            <p>Select the asset your vault accepts and the token it accumulates.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Set the logic</h3>
            <p>Choose a DCA schedule or a target allocation with a drift threshold.</p>
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
