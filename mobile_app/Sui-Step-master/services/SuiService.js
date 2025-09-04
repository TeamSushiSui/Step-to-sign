import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

class SuiService {
  constructor() {
    if (!SuiService.instance) {
      this.client = null;
      this.network = "testnet";
      this.initializeClient();
      SuiService.instance = this;
    }
    return SuiService.instance;
  }

  static getInstance() {
    if (!SuiService.instance) {
      SuiService.instance = new SuiService();
    }
    return SuiService.instance;
  }

  initializeClient() {
    const url = getFullnodeUrl(this.network);
    this.client = new SuiClient({ url });
    console.log(
      `🔗 SuiService: Initialized for ${this.network} network -> ${url}`
    );
  }

//  Tests the Client connection
  async testConnection() {
    try {
      console.log("🔍 SuiService: Testing connection...");
      const protocolConfig = await this.client.getProtocolConfig();
      console.log("  SuiService: Connection test successful", protocolConfig);
      return true;
    } catch (error) {
      console.error("   SuiService: Connection test failed:", error);
      return false;
    }
  }

  setNetwork(network) {
    if (["testnet", "mainnet", "devnet"].includes(network)) {
      this.network = network;
      this.initializeClient();
      console.log(`🔄 SuiService: Switched to ${network} network`);
    } else {
      throw new Error(
        `Invalid network: ${network}. Must be testnet, mainnet, or devnet`
      );
    }
  }

  getNetwork() {
    return this.network;
  }
  getExplorerUrl() {
    return "https://suiexplorer.com/txblock/";
  }

  // Ooperating directly with Sui addresses provided by the device 😎

  async getWalletBalance(address) {
    try {
      // Validates address format first 
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Sui address format: ${address}`);
      }

      console.log(`🔍 SuiService: Fetching balance for address: ${address}`);
      console.log(`🔍 SuiService: Using client:`, this.client);
      console.log(`🔍 SuiService: Network: ${this.network}`);

      const balanceParams = {
        owner: address,
        coinType: "0x2::sui::SUI",
      };
      console.log(`🔍 SuiService: Balance params:`, balanceParams);

      const balance = await this.client.getBalance(balanceParams);

      console.log(`  SuiService: Balance response:`, balance);

      const coinsParams = {
        owner: address,
        coinType: "0x2::sui::SUI",
      };
      console.log(`🔍 SuiService: Coins params:`, coinsParams);

      const coins = await this.client.getCoins(coinsParams);

      console.log(`  SuiService: Coins response:`, coins);

      const totalBalance = Number(balance.totalBalance) / 1_000_000_000;
      return {
        balance: totalBalance,
        coinCount: coins.data.length,
        coins: coins.data,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `   SuiService: getWalletBalance failed for ${address}:`,
        error
      );
      console.error(`   SuiService: Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  }

  async getBasicBalance(address) {
    try {
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Sui address format: ${address}`);
      }

      console.log(`🔍 SuiService: Getting basic balance for: ${address}`);

      const balance = await this.client.getBalance({
        owner: address,
        coinType: "0x2::sui::SUI",
      });

      console.log(`  SuiService: Basic balance response:`, balance);

      const totalBalance = Number(balance.totalBalance) / 1_000_000_000;
      return {
        balance: totalBalance,
        coinCount: 0, // We'll skip coins for now
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `   SuiService: getBasicBalance failed for ${address}:`,
        error
      );
      throw error;
    }
  }

  async getWalletObjects(address) {
    try {
      // Validate address format first
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Sui address format: ${address}`);
      }

      const objects = await this.client.getOwnedObjects({
        owner: address,
        options: {
          showType: true,
          showContent: true,
          showDisplay: true,
        },
      });

      return {
        objects: objects.data,
        objectCount: objects.data.length,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `   SuiService: getWalletObjects failed for ${address}:`,
        error
      );
      throw error;
    }
  }

  async getTransactionHistory(address, limit = 10) {
    try {
      // Validates address format first
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid Sui address format: ${address}`);
      }

      const transactions = await this.client.queryTransactionBlocks({
        filter: {
          FromAddress: address,
        },
        options: {
          showEffects: true,
          showInput: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
        },
        limit,
      });

      return transactions.data.map((tx) => ({
        digest: tx.digest,
        timestamp: tx.timestampMs,
        status: tx.effects?.status?.status,
        gasUsed: tx.effects?.gasUsed,
        balanceChanges: tx.balanceChanges,
        objectChanges: tx.objectChanges,
        events: tx.events,
        explorerUrl: `${this.getExplorerUrl()}${tx.digest}`,
      }));
    } catch (error) {
      console.error(
        `   SuiService: getTransactionHistory failed for ${address}:`,
        error
      );
      return [];
    }
  }

  // Gets comprehensive wallet information by address
  async getWalletInfoByAddress(address) {
    const fetchOnce = async () => {
      try {
        // Try to get basic balance first (simplest call)
        const balance = await this.getBasicBalance(address);

        // If basic balance works, try other calls
        let objects = { objectCount: 0, objects: [] };
        let transactions = [];

        try {
          objects = await this.getWalletObjects(address);
        } catch (objError) {
          console.log(
            `   SuiService: getWalletObjects failed for ${address}, using defaults`
          );
        }

        try {
          transactions = await this.getTransactionHistory(address, 5);
        } catch (txError) {
          console.log(
            `   SuiService: getTransactionHistory failed for ${address}, using defaults`
          );
        }

        return {
          address,
          balance: balance.balance,
          coinCount: balance.coinCount,
          objectCount: objects.objectCount,
          recentTransactions: transactions,
          lastUpdated: new Date().toISOString(),
          network: this.network,
          explorerUrl: `${this.getExplorerUrl()}${address}`,
        };
      } catch (error) {
        console.error(
          `   SuiService: All API calls failed for ${address}:`,
          error
        );
        throw error;
      }
    };

    try {
      return await fetchOnce();
    } catch (_e1) {
      try {
        return await fetchOnce();
      } catch (e2) {
        console.error(
          "   SuiService: Error getting wallet info by address:",
          e2
        );
        return {
          address,
          balance: 0,
          coinCount: 0,
          objectCount: 0,
          recentTransactions: [],
          error: e2.message || "network",
          network: this.network,
        };
      }
    }
  }

  /** Fetch multiple wallets by addresses */
  async getMultipleWalletInfoByAddresses(addresses) {
    try {
      const walletPromises = addresses.map(async (addr, index) => {
        try {
          const walletInfo = await this.getWalletInfoByAddress(addr);
          return { ...walletInfo, index, id: index };
        } catch (error) {
          return {
            index,
            id: index,
            address: addr,
            balance: 0,
            coinCount: 0,
            objectCount: 0,
            recentTransactions: [],
            error: error.message,
            network: this.network,
          };
        }
      });
      return await Promise.all(walletPromises);
    } catch (_error) {
      console.error(
        "   SuiService: Error getting multiple wallet info by addresses:",
        _error
      );
      throw new Error(`Failed to get multiple wallet info: ${_error.message}`);
    }
  }

  async getSuiPrice() {
    try {
      // For now, return a mock price (planning to fetch from CoinGecko later)
      const mockPrice = 1.23; // Mock SUI price
      console.log(`💲 SuiService: SUI price fetched - $${mockPrice}`);
      return mockPrice;
    } catch (error) {
      console.error("   SuiService: Error fetching SUI price:", error);
      return 1.0; // Fallback price 😂
    }
  }

  isValidAddress(address) {
    try {
      // Basic validation - Sui addresses start with 0x and are 66 characters long
      return address && address.startsWith("0x") && address.length === 66;
    } catch (_error) {
      return false;
    }
  }

  formatBalance(balance) {
    if (balance === 0) return "0 SUI";
    if (balance < 0.001) return "< 0.001 SUI";
    return `${balance.toFixed(3)} SUI`;
  }

  formatAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

export default SuiService;
