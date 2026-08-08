"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function AppNav() {
  return (
    <nav>
      <Link className="wordmark" href="/" aria-label="Cadence home">
        <span className="mark">C</span>
        cadence
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
