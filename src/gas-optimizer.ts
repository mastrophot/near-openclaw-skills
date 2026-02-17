import fetch from 'node-fetch';
import { providers } from 'near-api-js';

const MAINNET_RPC = 'https://rpc.mainnet.near.org';
const ETHERSCAN_GAS_API = 'https://api.etherscan.io/api?module=gastracker&action=gasoracle';
const COINGECKO_PRICES = 'https://api.coingecko.com/api/v3/simple/price?ids=near,ethereum&vs_currencies=usd';

const TX_TYPE_BASE_TGAS: Record<string, number> = {
  transfer: 7,
  function_call: 30,
  stake: 20,
  add_key: 15,
  delete_key: 10,
  delete_account: 10,
  deploy_contract: 80,
  create_account: 20
};

function tgasForTxType(txType: string): number {
  return TX_TYPE_BASE_TGAS[txType.toLowerCase()] ?? 30;
}

function yoctoPerGasToNearPerTgas(yoctoPerGas: string): number {
  return (Number(yoctoPerGas) * 1e12) / 1e24;
}

async function nearGasPriceYoctoPerGas(): Promise<string> {
  const provider = new providers.JsonRpcProvider({ url: MAINNET_RPC });
  const gasPrice = await provider.gasPrice(null);
  return gasPrice.gas_price;
}

async function getPricesUsd(): Promise<{ near: number; ethereum: number }> {
  try {
    const response = await fetch(COINGECKO_PRICES);
    const data: any = await response.json();
    return {
      near: Number(data?.near?.usd ?? 0),
      ethereum: Number(data?.ethereum?.usd ?? 0)
    };
  } catch {
    return { near: 0, ethereum: 0 };
  }
}

async function getEthGasGwei(): Promise<number> {
  try {
    const response = await fetch(ETHERSCAN_GAS_API);
    const data: any = await response.json();
    const proposed = Number(data?.result?.ProposeGasPrice);
    if (Number.isFinite(proposed) && proposed > 0) {
      return proposed;
    }
  } catch {
    // fall through
  }
  return 20; // safe fallback
}

export async function near_gas_estimate(tx_type: string, params: Record<string, any>): Promise<Record<string, any>> {
  const gasPriceYocto = await nearGasPriceYoctoPerGas();
  const baseTgas = tgasForTxType(tx_type);
  const extraActions = Array.isArray(params?.actions) ? params.actions.length : 0;
  const estimatedTgas = baseTgas + extraActions * 5;
  const nearPerTgas = yoctoPerGasToNearPerTgas(gasPriceYocto);

  return {
    tx_type,
    estimated_tgas: estimatedTgas,
    gas_price_yocto_per_gas: gasPriceYocto,
    estimated_cost_near: Number((nearPerTgas * estimatedTgas).toFixed(6)),
    assumptions: [
      'estimate is based on current mainnet gas price',
      'complex contract logic can increase final gas usage'
    ]
  };
}

export async function near_gas_optimize(tx: Record<string, any>): Promise<Record<string, any>> {
  const txType = String(tx?.tx_type ?? tx?.type ?? 'function_call');
  const recommendations: string[] = [];

  if ((tx?.args_size_bytes ?? 0) > 2048) {
    recommendations.push('Reduce argument payload size (consider IDs/pointers instead of full objects).');
  }
  if ((tx?.batch_actions ?? 0) < 2) {
    recommendations.push('Batch related actions to reduce fixed overhead.');
  }
  if ((tx?.attached_deposit_yocto ?? '0') !== '0') {
    recommendations.push('Review attached deposit and keep it minimal when possible.');
  }
  if (txType === 'function_call') {
    recommendations.push('Mark methods as view where possible to avoid unnecessary state changes.');
  }
  if (recommendations.length === 0) {
    recommendations.push('No obvious inefficiencies detected. Benchmark with representative inputs.');
  }

  return {
    tx_type: txType,
    estimated_savings_percent: recommendations.length >= 3 ? 15 : 8,
    recommendations
  };
}

export async function near_gas_history(): Promise<Array<Record<string, any>>> {
  const networks = ['mainnet', 'testnet'] as const;
  const snapshots: Array<Record<string, any>> = [];

  for (const network of networks) {
    try {
      const provider = new providers.JsonRpcProvider({ url: `https://rpc.${network}.near.org` });
      const gasPrice = await provider.gasPrice(null);
      snapshots.push({
        network,
        gas_price_yocto_per_gas: gasPrice.gas_price,
        near_per_tgas: Number(yoctoPerGasToNearPerTgas(gasPrice.gas_price).toFixed(8)),
        captured_at: new Date().toISOString()
      });
    } catch {
      snapshots.push({
        network,
        error: 'rpc_unavailable',
        captured_at: new Date().toISOString()
      });
    }
  }

  return snapshots;
}

export async function near_gas_compare(): Promise<Record<string, any>> {
  const gasPriceYocto = await nearGasPriceYoctoPerGas();
  const nearPerTgas = yoctoPerGasToNearPerTgas(gasPriceYocto);
  const prices = await getPricesUsd();
  const ethGasGwei = await getEthGasGwei();

  const nearUsdPerTgas = nearPerTgas * prices.near;
  const ethUsdSimpleTx = ethGasGwei * 1e-9 * 21000 * prices.ethereum;

  return {
    near: {
      gas_price_yocto_per_gas: gasPriceYocto,
      usd_per_tgas: Number(nearUsdPerTgas.toFixed(8))
    },
    ethereum: {
      gas_price_gwei: ethGasGwei,
      usd_per_simple_transfer_21k: Number(ethUsdSimpleTx.toFixed(4))
    },
    ratio_eth_simple_tx_to_near_1_tgas:
      nearUsdPerTgas > 0 ? Number((ethUsdSimpleTx / nearUsdPerTgas).toFixed(2)) : null
  };
}
