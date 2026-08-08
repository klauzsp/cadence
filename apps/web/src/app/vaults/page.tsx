import { AppNav } from "@/components/app-nav";
import { VaultList } from "@/components/vault-list";

export default function VaultsPage() {
  return (
    <main>
      <AppNav />
      <section className="dashboard-header">
        <p className="eyebrow">Live standings</p>
        <h1>Vault leaderboard.</h1>
        <p>Strategies compete for the top spot. Rankings update from live TVL on Monad.</p>
      </section>
      <VaultList />
    </main>
  );
}
