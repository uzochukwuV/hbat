"use client";

/**
 * useWallet Hook
 * React hook for Hedera wallet connection using DAppConnector
 */

import { useState, useEffect, useCallback } from "react";
import type { WalletState, UnsignedTransaction } from "@/types";
import {
  initializeWallet,
  openConnectModal,
  disconnectWallet,
  getAccountId,
  getBalance,
  sendEvmTransaction,
  subscribeToAccount,
  accountIdToEvmAddress,
} from "@/lib/wallets";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    accountId: null,
    balance: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize wallet on mount
   */
  useEffect(() => {
    const init = async () => {
      try {
        await initializeWallet();
        setIsInitialized(true);

        // Check if already connected
        const accountId = getAccountId();
        if (accountId) {
          const address = accountIdToEvmAddress(accountId);
          const balance = await getBalance(accountId);

          setState({
            isConnected: true,
            address,
            accountId,
            balance,
          });
        }
      } catch (err) {
        console.error("Failed to initialize wallet:", err);
        setError("Failed to initialize wallet connection");
      }
    };

    init();
  }, []);

  /**
   * Subscribe to account changes
   */
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribe = subscribeToAccount(async (accountId) => {
      if (accountId) {
        const address = accountIdToEvmAddress(accountId);

        try {
          const balance = await getBalance(accountId);
          setState({
            isConnected: true,
            address,
            accountId,
            balance,
          });
        } catch {
          setState({
            isConnected: true,
            address,
            accountId,
            balance: null,
          });
        }
      } else {
        setState({
          isConnected: false,
          address: null,
          accountId: null,
          balance: null,
        });
      }
    });

    return unsubscribe;
  }, [isInitialized]);

  /**
   * Connect wallet - opens modal
   */
  const connect = useCallback(async () => {
    if (!isInitialized) {
      setError("Wallet not initialized yet");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await openConnectModal();

      // After modal closes, check connection state
      // Give a brief moment for state to update
      setTimeout(() => {
        const accountId = getAccountId();
        if (accountId) {
          const address = accountIdToEvmAddress(accountId);
          getBalance(accountId).then((balance) => {
            setState({
              isConnected: true,
              address,
              accountId,
              balance,
            });
          });
        }
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to connect wallet";
      setError(errorMsg);
      console.error("Wallet connection error:", err);
      setIsLoading(false);
    }
  }, [isInitialized]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    setIsLoading(true);

    try {
      await disconnectWallet();
      setState({
        isConnected: false,
        address: null,
        accountId: null,
        balance: null,
      });
    } catch (err: any) {
      console.error("Disconnect error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign and send EVM transaction
   */
  const signTransaction = useCallback(
    async (tx: UnsignedTransaction): Promise<string> => {
      if (!state.isConnected) {
        throw new Error("Wallet not connected");
      }

      setIsLoading(true);
      setError(null);

      try {
        const txHash = await sendEvmTransaction(tx);
        return txHash;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to sign transaction";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [state.isConnected]
  );

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (!state.accountId) return;

    try {
      const balance = await getBalance(state.accountId);
      setState((prev) => ({ ...prev, balance }));
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    }
  }, [state.accountId]);

  return {
    ...state,
    connect,
    disconnect,
    signTransaction,
    refreshBalance,
    isLoading,
    isInitialized,
    error,
  };
}
