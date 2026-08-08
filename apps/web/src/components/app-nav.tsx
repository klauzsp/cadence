"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";

export function AppNav() {
  return (
    <nav>
      <Link className="wordmark" href="/" aria-label="Cadence home">
        <Image className="company-logo" src="/logo.png" alt="" width={640} height={500} priority />
        <span className="product-name">Cadence</span>
      </Link>
      <div className="nav-links">
        <Link href="/">Create</Link>
        <Link href="/vaults">Vaults</Link>
      </div>
      <div className="nav-right">
        <span className="network-status">
          <i /> Monad testnet
        </span>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
    </nav>
  );
}
