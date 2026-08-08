import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { monadTestnet } from "wagmi/chains";

const rpcUrl =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

export const wagmiConfig = getDefaultConfig({
  appName: "Cadence",
  projectId,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(rpcUrl),
  },
  ssr: true,
});
