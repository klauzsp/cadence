import { isAddress, type Address } from "viem";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { VaultDashboard } from "@/components/vault-dashboard";

export default async function VaultPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  return (
    <main>
      <AppNav />
      <VaultDashboard vault={address as Address} />
    </main>
  );
}
