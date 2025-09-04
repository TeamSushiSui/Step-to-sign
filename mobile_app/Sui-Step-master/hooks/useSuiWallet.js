import { useCallback, useEffect, useState } from "react";
import SuiService from "../services/SuiService";

export const useSuiWallet = () => {
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [network, setNetwork] = useState("testnet");
  const [lastUpdated, setLastUpdated] = useState(null);

  const suiService = SuiService.getInstance();

  // Initialize network
  useEffect(() => {
    const currentNetwork = suiService.getNetwork();
    setNetwork(currentNetwork);
  }, []);

  const switchNetwork = useCallback(
    async (newNetwork) => {
      try {
        setError(null);
        setIsLoading(true);

        suiService.setNetwork(newNetwork);
        setNetwork(newNetwork);

        // Refreshes wallet data if we have wallets (users can add more wallets in the comment section)
        if (wallets.length > 0) {
          await refreshWallets();
        }

        console.log(`🔄 useSuiWallet: Switched to ${newNetwork} network`);
      } catch (error) {
        console.error("   useSuiWallet: Error switching network:", error);
        setError(`Failed to switch network: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [wallets]
  );

  const fetchWalletsFromPublicKeys = useCallback(
    async (publicKeys) => {
      try {
        setError(null);
        setIsLoading(true);

        console.log(
          `🔍 useSuiWallet: Fetching wallets for ${publicKeys.length} public keys`
        );

        const walletInfo = await suiService.getMultipleWalletInfo(publicKeys);

        setWallets(walletInfo);
        setLastUpdated(new Date().toISOString());

        // Sets first wallet as selected by default if none selected
        if (walletInfo.length > 0 && !selectedWallet) {
          setSelectedWallet(walletInfo[0]);
        }

        console.log(`  useSuiWallet: Fetched ${walletInfo.length} wallets`);
        return walletInfo;
      } catch (error) {
        console.error("   useSuiWallet: Error fetching wallets:", error);
        setError(`Failed to fetch wallets: ${error.message}`);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [selectedWallet]
  );

  const refreshWallets = useCallback(async () => {
    if (wallets.length === 0) return;

    try {
      setError(null);
      setIsLoading(true);

      const publicKeys = wallets.map((wallet) => wallet.publicKey);
      const updatedWallets = await suiService.getMultipleWalletInfo(publicKeys);

      setWallets(updatedWallets);
      setLastUpdated(new Date().toISOString());

      // Update selected wallet if it exists
      if (selectedWallet) {
        const updatedSelected = updatedWallets.find(
          (w) => w.publicKey === selectedWallet.publicKey
        );
        if (updatedSelected) {
          setSelectedWallet(updatedSelected);
        }
      }

      console.log(
        `🔄 useSuiWallet: Refreshed ${updatedWallets.length} wallets`
      );
    } catch (error) {
      console.error("   useSuiWallet: Error refreshing wallets:", error);
      setError(`Failed to refresh wallets: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [wallets, selectedWallet]);

  /**
   * Select a wallet
   */
  const selectWallet = useCallback((wallet) => {
    setSelectedWallet(wallet);
    console.log(`🎯 useSuiWallet: Selected wallet ${wallet.address}`);
  }, []);

  const getWalletByIndex = useCallback(
    (index) => {
      return wallets.find((wallet) => wallet.index === index);
    },
    [wallets]
  );

  const getWalletByPublicKey = useCallback(
    (publicKey) => {
      return wallets.find((wallet) => wallet.publicKey === publicKey);
    },
    [wallets]
  );

  const getTotalBalance = useCallback(() => {
    return wallets.reduce((total, wallet) => {
      const balance = wallet.balance || 0;
      return total + balance;
    }, 0);
  }, [wallets]);

  // Gets total transaction count across all wallets
  const getTotalTransactions = useCallback(() => {
    return wallets.reduce((total, wallet) => {
      const txCount = wallet.recentTransactions?.length || 0;
      return total + txCount;
    }, 0);
  }, [wallets]);

  //  Gets all recent transactions from all wallets
  const getAllRecentTransactions = useCallback(() => {
    const allTransactions = [];
    wallets.forEach((wallet) => {
      if (wallet.recentTransactions) {
        wallet.recentTransactions.forEach((tx) => {
          allTransactions.push({
            ...tx,
            walletAddress: wallet.address,
            walletIndex: wallet.index,
          });
        });
      }
    });

    // Sort by timestamp like in the Slush wallet 😜
    return allTransactions.sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [wallets]);

  // Clear all wallet data
  const clearWallets = useCallback(() => {
    setWallets([]);
    setSelectedWallet(null);
    setError(null);
    setLastUpdated(null);
    console.log("useSuiWallet: Cleared all wallet data");
  }, []);

  //  Get network information
  const getNetworkInfo = useCallback(() => {
    return {
      network,
      explorerUrl: suiService.getExplorerUrl(),
      isTestnet: network === "testnet",
      isMainnet: network === "mainnet",
    };
  }, [network]);

  return {
    // State
    wallets,
    selectedWallet,
    isLoading,
    error,
    network,
    lastUpdated,

    // Actions
    fetchWalletsFromPublicKeys,
    refreshWallets,
    selectWallet,
    switchNetwork,
    clearWallets,

    // Getters
    getWalletByIndex,
    getWalletByPublicKey,
    getTotalBalance,
    getTotalTransactions,
    getAllRecentTransactions,
    getNetworkInfo,

    // Utility
    formatBalance: suiService.formatBalance,
    formatAddress: suiService.formatAddress,
    isValidAddress: suiService.isValidAddress,
  };
};
