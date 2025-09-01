// JSON-RPC based Sui transaction history fetcher

const SUI_RPC_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

const DEFAULT_NETWORK = "testnet";

async function rpc(method, params = [], network = DEFAULT_NETWORK) {
  const url = SUI_RPC_URLS[network] || SUI_RPC_URLS[DEFAULT_NETWORK];
  const body = { jsonrpc: "2.0", id: 1, method, params };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${method} ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error?.message || `RPC ${method} error`);
  return json.result;
}

async function queryDigests(address, limit = 50, network = DEFAULT_NETWORK) {
  // Query both sent (FromAddress) and affected (includes received) then merge unique
  const baseOptions = {
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  };

  const [fromRes, affectedRes] = await Promise.all([
    rpc(
      "suix_queryTransactionBlocks",
      [{ filter: { FromAddress: address }, ...baseOptions }, null, limit, true],
      network
    ),
    rpc(
      "suix_queryTransactionBlocks",
      [{ filter: { ToAddress: address }, ...baseOptions }, null, limit, true],
      network
    ),
  ]);

  const digests = new Set();
  (fromRes?.data || []).forEach((tx) => digests.add(tx.digest));
  (affectedRes?.data || []).forEach((tx) => digests.add(tx.digest));
  return Array.from(digests);
}

async function getTxByDigest(digest, network = DEFAULT_NETWORK) {
  const result = await rpc(
    "sui_getTransactionBlock",
    [
      digest,
      {
        showInput: true,
        showRawInput: false,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    ],
    network
  );
  return result;
}

// FIXED parseTx function
function parseTx(result, address) {
  const sender = result?.transaction?.data?.sender || "";
  const status = result?.effects?.status?.status || "unknown";
  const ts = Number(result?.timestampMs || result?.effects?.timestampMs || 0);

  let recipient = null;
  let amount = null;
  let coinType = null;
  let direction =
    sender?.toLowerCase() === (address || "").toLowerCase()
      ? "sent"
      : "received";

  const balanceChanges = result?.balanceChanges || [];

  if (direction === "sent") {
    for (const change of balanceChanges) {
      const ownerAddr = change?.owner?.AddressOwner?.toLowerCase();
      if (
        ownerAddr &&
        ownerAddr !== (address || "").toLowerCase() &&
        Number(change.amount) > 0
      ) {
        recipient = ownerAddr;
        amount = change.amount;
        coinType = change.coinType;
        break;
      }
    }
  } else {
    for (const change of balanceChanges) {
      const ownerAddr = change?.owner?.AddressOwner?.toLowerCase();
      if (
        ownerAddr &&
        ownerAddr === (address || "").toLowerCase() &&
        Number(change.amount) > 0
      ) {
        recipient = ownerAddr;
        amount = change.amount;
        coinType = change.coinType;
        break;
      }
    }
  }

  return {
    digest: result?.digest,
    status,
    timestamp: ts,
    sender,
    recipient,
    amount,
    coinType,
    direction,
  };
}

export async function fetchWalletTransactionsRpc(
  address,
  network = DEFAULT_NETWORK,
  limit = 50
) {
  if (!address) return [];
  const digests = await queryDigests(address, limit, network);
  const details = await Promise.all(
    digests.map(async (dg) => {
      try {
        const tx = await getTxByDigest(dg, network);
        return parseTx(tx, address);
      } catch (e) {
        return null;
      }
    })
  );
  return details.filter(Boolean);
}

const SuiRpcService = { fetchWalletTransactionsRpc };
export default SuiRpcService;
