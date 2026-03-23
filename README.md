# Hedera Options Vault (HBAT)

> **The first keeperless, agentic options protocol on Hedera**
> Built for the Hello Future Apex Hackathon 2026 — DeFi & Tokenization Track

---

## What Is This?

A fully on-chain options protocol where:

1. **Users deposit collateral** (HBAR, USDC, or FRNT) and write covered calls / cash-secured puts.
2. **Black-Scholes pricing** runs entirely on-chain using Pyth Network real-time price feeds.
3. **Options auto-expire and settle** via **HIP-1215** (Hedera's native Schedule Service) — no keeper bots, no Gelato, no Chainlink Automation.
4. **An AI agent** (Claude + LangChain + Hedera Agent Kit) lets users manage positions via natural language.

---

## Live Deployment (Hedera Testnet — Chain ID 296)

| Contract | Address |
|----------|---------|
| OptionsVault | `0x2c8926FbF96f902798f9602CDBeb099659C095aF` |
| OptionToken (ERC-721) | `0xB84C25D2389B08465A4891660bffc0fd93a69745` |
| Pyth Oracle | `0xa2aa501b19aff244d90cc15a4cf739d2725b5729` |

---

## Hedera Stack

| Layer | Component | Role |
|-------|-----------|------|
| Smart Contracts | Hedera Smart Contract Service (HSCS) | Vault logic in Solidity |
| Automation | **HIP-1215** (Schedule Service Precompile) | Keeperless option auto-expiry |
| Oracle | **Pyth Network** (pull-oracle) | HBAR, BTC, ETH, XAU, EUR price feeds |
| Tokens | **HTS** + ERC-721 (**OptionToken**) | NFT option positions |
| AI Agent | Claude + LangChain + Hedera Agent Kit | Natural-language trading interface |
| Fair Ordering | Hedera consensus | Prevents front-running on settlements |
| Fees | Fixed (~$0.0001/tx) | Makes frequent Greek updates viable |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     OptionsVault.sol                          │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │   Collateral │   │ Black-Scholes │   │  HIP-1215 HSS   │  │
│  │   HBAR /     │   │  Pricing     │   │  Auto-Expiry    │  │
│  │   USDC /     │   │  (on-chain)  │   │  Scheduler      │  │
│  │   FRNT       │   │              │   │                 │  │
│  └──────┬───────┘   └──────┬───────┘   └────────┬────────┘  │
│         │                  │                     │           │
│         └──────────────────┴─────────────────────┘           │
│                            │                                  │
│  ┌─────────────────────────▼────────────────────────────┐   │
│  │              Pyth Network (Pull Oracle)               │   │
│  │  HBAR · BTC · ETH · XAU (Gold) · EUR/USD            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  OptionToken.sol (ERC-721 NFT with on-chain SVG metadata)   │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │
            ┌──────────────────────────┐
            │   AI Agent (LangChain)   │
            │   Claude claude-opus-4   │
            │                          │
            │  Tools:                  │
            │  • get_option_price      │
            │  • write_option          │
            │  • exercise_option       │
            │  • vault_status          │
            │  • hedera_kit (native)   │
            └──────────────────────────┘
```

---

## Why Options on Hedera Wins

### vs. Ethereum Options (e.g. Lyra, Dopex)

| Feature | Ethereum Options | Hedera Options Vault |
|---------|-----------------|----------------------|
| Auto-expiry | Chainlink Keepers ($$$) | **HIP-1215** (native, free) |
| Oracle | Chainlink push (~$0.50/update) | **Pyth pull** ($0.0001/update) |
| Greek updates | $5–50/tx | **$0.0001/tx** (fixed) |
| Front-running | MEV bots exploit liquidations | **Fair Ordering** prevents this |
| Settlement | Manual or keeper | **Fully autonomous** |

### The HIP-1215 Advantage

When you write an option, the vault calls `scheduleCall()` on the Hedera Schedule Service precompile. At expiry, Hedera consensus nodes automatically call `expireOption(tokenId)` — no external infrastructure needed. This is a first-of-its-kind feature for DeFi derivatives.

---

## Supported Underlyings

| Symbol | Description | Pyth Feed ID |
|--------|-------------|--------------|
| HBAR | Hedera Hashgraph | `0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd` |
| BTC | Bitcoin | `0xc5e0e0c92116c0c070a242b254270441a6201af680a33e0381561c59db3266c9` |
| ETH | Ethereum | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| XAU | Gold (RWA) | `0x44465e17d2e9d390e70c999d5a11fda4f092847fcd2e3e5aa089d96c98a30e67` |
| EUR | Euro / USD FX | `0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c` |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A Hedera testnet account ([portal.hedera.com](https://portal.hedera.com))
- HBAR testnet tokens (free from the faucet)
- Anthropic or OpenRouter API key

### 1. Install

```bash
cd hbat
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Fill in: OPERATOR_ACCOUNT_ID, OPERATOR_PRIVATE_KEY, ANTHROPIC_API_KEY (or OPENROUTER_API_KEY)
```

### 3. Compile & Test

```bash
npm run compile
npm test          # 23 unit tests, all passing on hardhat local
```

### 4. Deploy to Hedera Testnet

```bash
npm run deploy:testnet
```

### 5. Start the AI Agent

```bash
npm run agent
```

Example conversation:

```
You > show me the current HBAR price and quote a 7-day $0.15 call for 10,000 HBAR

Agent > 📊 Option Quote — HBAR CALL $0.15
        Spot Price:  $0.1352 (Pyth age: 2s)
        Strike:      $0.15
        Size:        10,000 units
        Expiry:      7 days

        ── Premium & Greeks ──
        Total Premium: $42.18
        Per Unit:      $0.004218/unit

        Delta:   0.3241
        Gamma:   0.0000
        Vega:    0.1823 per 1% vol
        Theta:   -0.0061 per day
        Rho:     0.0142 per 1% rate

        Moneyness: OUT OF THE MONEY
        ⚡ Settlement auto-executed by HIP-1215 — no keeper bots needed.
```

---

## Contract Architecture

### `OptionsVault.sol`

Main protocol contract. Handles:
- Collateral deposits (HBAR native + ERC-20)
- Option writing with on-chain Black-Scholes premium computation
- Exercise and cash settlement
- HIP-1215 auto-expiry scheduling via HSS precompile

### `OptionToken.sol`

ERC-721 NFT representing option positions. Each token:
- Encodes all option terms (strike, expiry, type, size, writer)
- Generates fully on-chain SVG artwork via `tokenURI()`
- Tracks lifecycle: Active → Exercised / Expired

### `libraries/BlackScholes.sol`

Full on-chain BSM implementation using WAD (1e18) fixed-point math:
- `price(params)` → premium + all 5 Greeks (Δ, Γ, ν, θ, ρ)
- `impliedVolatility()` → Newton-Raphson IV solver (8–16 iterations)
- `secondsToAnnualised()` → time conversion utility

### `libraries/FixedPointMath.sol`

WAD math primitives:
- `lnWad`, `expWad` — accurate to < 1e-15 relative error
- `ncdf` — Abramowitz & Stegun normal CDF (error < 7.5e-8)
- `sqrtWad` — Babylonian method
- `pythPriceToWad` — Pyth price format conversion

---

## AI Agent

The agent uses LangChain's ReAct pattern with Claude. It has four vault tools and five native Hedera tools via the Hedera Agent Kit:

| Tool | Description |
|------|-------------|
| `get_option_price` | Quote BSM premium + Greeks using live Pyth prices |
| `write_option` | Write covered calls or cash-secured puts |
| `exercise_option` | Exercise ITM options for cash settlement |
| `vault_status` | Check prices, collateral balances, open positions |
| `get_hbar_balance` | Check HBAR balance for any account |
| `get_account_info` | Get account details including EVM address |
| `transfer_hbar` | Build unsigned HBAR transfer transaction |

All write operations return **unsigned transactions** — the user signs with their own wallet. The agent never handles private keys.

---

## RWA & Institutional Focus

The XAU (gold) feed from Pyth enables options on **tokenised real-world assets** — directly aligned with Hedera's Governing Council (DBS, DTCC, Google) and the hackathon's DeFi & Tokenization track. Users can hedge gold exposure on-chain at Hedera's fixed-fee infrastructure.

The FRNT (Wyoming Frontier Stable Token) integration as collateral demonstrates Hedera's native stablecoin ecosystem support.

---

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24, OpenZeppelin v4.9.6, Hardhat
- **Oracle**: Pyth Network (pull-oracle, VAA-based updates)
- **Automation**: HIP-1215 Hedera Schedule Service precompile
- **AI Agent**: LangChain, Claude claude-opus-4, Hedera Agent Kit
- **Testing**: Hardhat + Chai (23 unit tests)
- **Network**: Hedera Testnet (EVM-compatible, Paris hardfork)

---

## License

MIT

---

*Built for the Hello Future Apex Hackathon 2026 — DeFi & Tokenization Track*
*$250,000 prize pool | Feb 17 – March 23, 2026 | [hellofuturehackathon.dev](https://hellofuturehackathon.dev)*
# hbat
