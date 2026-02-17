import fetch from 'node-fetch';

function yoctoToNear(value: any): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed / 1e24;
}

function pickAmountNear(tx: any): number {
  return yoctoToNear(tx?.amount ?? tx?.deposit ?? tx?.token_transfer_amount ?? 0);
}

export async function near_analytics_network(): Promise<Record<string, any>> {
  const response = await fetch('https://rpc.mainnet.near.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'analytics-network',
      method: 'status',
      params: []
    })
  });
  const data: any = await response.json();
  const result = data?.result || {};
  return {
    chain_id: result.chain_id,
    protocol_version: result.protocol_version,
    latest_block_height: result.sync_info?.latest_block_height,
    syncing: result.sync_info?.syncing,
    validators: Array.isArray(result.validators) ? result.validators.length : null,
    source: 'near_rpc_status'
  };
}

export async function near_analytics_whales(min_amount: number = 10000): Promise<Array<Record<string, any>>> {
  try {
    const response = await fetch('https://api.nearblocks.io/v1/txns?limit=100');
    const data: any = await response.json();
    const txns = Array.isArray(data?.txns) ? data.txns : [];

    return txns
      .map((tx: any) => ({
        signer_id: tx.signer_id,
        receiver_id: tx.receiver_id,
        amount_near: Number(pickAmountNear(tx).toFixed(4)),
        tx_hash: tx.transaction_hash
      }))
      .filter((tx: any) => tx.amount_near >= min_amount)
      .slice(0, 20);
  } catch {
    return [{ error: 'Whale data unavailable.' }];
  }
}

export async function near_analytics_trending(): Promise<Array<Record<string, any>>> {
  try {
    const response = await fetch('https://api.nearblocks.io/v1/contracts?limit=10&sort=txns&order=desc');
    const data: any = await response.json();
    const contracts = Array.isArray(data?.contracts) ? data.contracts : [];
    return contracts.map((c: any) => ({
      contract_id: c.contract_id,
      txns_24h: c.txns_24h ?? null,
      txns_growth_24h: c.txns_growth_24h ?? null
    }));
  } catch {
    return [{ error: 'Trending contracts unavailable.' }];
  }
}

export async function near_analytics_defi(): Promise<Record<string, any>> {
  const output: Record<string, any> = {};

  try {
    const nearBlocksRes = await fetch('https://api.nearblocks.io/v1/stats');
    const nearBlocksData: any = await nearBlocksRes.json();
    const stats = nearBlocksData?.stats?.[0] || {};
    output.near_price_usd = stats.near_price ?? null;
    output.daily_active_accounts = stats.active_accounts_24h ?? null;
    output.total_transactions = stats.total_txns ?? null;
  } catch {
    output.nearblocks_error = 'stats_unavailable';
  }

  try {
    const llamaRes = await fetch('https://api.llama.fi/v2/chains');
    const chains: any = await llamaRes.json();
    const nearChain = Array.isArray(chains)
      ? chains.find((chain: any) => String(chain?.name || '').toLowerCase() === 'near')
      : null;
    output.defi_tvl_usd = nearChain?.tvl ?? null;
  } catch {
    output.defillama_error = 'tvl_unavailable';
  }

  output.source = ['nearblocks', 'defillama'];
  return output;
}
