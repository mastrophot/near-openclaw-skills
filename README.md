# NEAR OpenClaw Skills

Specialized agentic skills for NEAR Protocol, designed for OpenClaw.

## Gas Optimizer Skill

Optimizes gas usage and provides cost comparisons.

- `near_gas_estimate`: Estimate TGas for a transaction.
- `near_gas_optimize`: Get actionable optimization tips for a transaction payload.
- `near_gas_history`: Snapshot gas pricing for mainnet/testnet.
- `near_gas_compare`: Compare NEAR gas costs to Ethereum baseline costs.

## On-Chain Analytics Skill

Direct insights from the NEAR blockchain.

- `near_analytics_network`: Real-time network health and throughput.
- `near_analytics_whales`: Detection of high-value transactions with `min_amount`.
- `near_analytics_trending`: Identification of most used contracts.
- `near_analytics_defi`: TVL and ecosystem stats for NEAR DeFi.

## Integration

These skills are compatible with the OpenClaw skill runner and can be published directly to MoltHub.

## License

MIT
