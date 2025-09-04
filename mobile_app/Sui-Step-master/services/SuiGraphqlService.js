const ENDPOINTS = {
  mainnet: "https://sui-mainnet.mystenlabs.com/graphql",
  testnet: "https://sui-testnet.mystenlabs.com/graphql",
  devnet: "https://sui-testnet.mystenlabs.com/graphql",
};

const DEFAULT_NETWORK = "testnet";

const TX_QUERY = `#graphql
  query GetWalletTx($address: SuiAddress!, $limit: Int = 50) {
    sent: transactionBlocks(filter: { sentAddress: $address }, first: $limit) {
      nodes {
        digest
        sender { address }
        effects {
          status
          timestamp
        }
      }
    }
    received: transactionBlocks(filter: { affectedAddress: $address }, first: $limit) {
      nodes {
        digest
        sender { address }
        effects {
          status
          timestamp
        }
      }
    }
  }
`;

async function postGraphql(endpoint, query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GraphQL ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      json.errors.map((e) => e.message).join("; ") || "GraphQL error"
    );
  }
  return json.data;
}

export async function fetchWalletTransactions(
  address,
  network = DEFAULT_NETWORK,
  limit = 50
) {
  const endpoint = ENDPOINTS[network] || ENDPOINTS[DEFAULT_NETWORK];
  const data = await postGraphql(endpoint, TX_QUERY, { address, limit });

  // Merge sent and received, deduplicate by digest
  const txMap = new Map();
  const processTx = (tx, direction) => {
    const display = {
      digest: tx.digest,
      status: tx.effects?.status,
      timestamp: tx.effects?.timestamp
        ? new Date(tx.effects.timestamp).toISOString()
        : null,
      sender: tx.sender?.address,
      recipient: null, // Not available in GraphQL API
      amount: null, // Not available in GraphQL API
      coinType: null, // Not available in GraphQL API
      direction,
    };
    if (!txMap.has(tx.digest) || direction === "sent") {
      txMap.set(tx.digest, display);
    }
  };

  (data?.sent?.nodes || []).forEach((tx) => processTx(tx, "sent"));
  (data?.received?.nodes || []).forEach((tx) => processTx(tx, "received"));

  // Sort by timestamp desc
  const merged = Array.from(txMap.values()).sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return merged;
}

const SuiGraphqlService = { fetchWalletTransactions };
export default SuiGraphqlService;
