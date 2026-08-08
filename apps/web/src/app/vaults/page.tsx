import { AppNav } from "@/components/app-nav";
import { VaultList } from "@/components/vault-list";

export default function VaultsPage() {
  return (
    <main>
      <AppNav />
      <section className="dashboard-header">
        <p className="eyebrow">Onchain strategies</p>
        <h1>Vaults.</h1>
        <p>Explore every strategy, then inspect your creator and investor positions.</p>
      </section>
      <VaultList />
    </main>
  );
}
