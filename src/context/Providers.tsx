"use client";

import { TransactionsProvider } from "./TransactionsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TransactionsProvider>{children}</TransactionsProvider>;
}
