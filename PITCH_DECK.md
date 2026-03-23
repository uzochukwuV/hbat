# Hedera Options Vault (HBAT)
## Pitch Deck — Hello Future Apex Hackathon 2026
### DeFi & Tokenization Track

---

---

# Slide 1: The Problem

## DeFi Options Are Broken — And Expensive

Options are the most powerful risk management tool in finance.
**$600B+ in daily options volume** on traditional markets.
DeFi options? A rounding error — because the infrastructure doesn't work.

### Three Fundamental Failures on Ethereum

| Problem | Reality | Cost |
|---------|---------|------|
| **Keeper dependency** | Chainlink Automation required for expiry | $50–500/month per protocol |
| **Oracle cost** | Chainlink push oracle, updated every 0.5% deviation | $0.50 per price update |
| **Gas fees** | Black-Scholes on-chain = $20–80 per transaction | Pricing updates are economically impossible |

### The Result

- Options protocols either centralise (off-chain settlement) or die (gas kills them)
- Retail users can't afford to hedge small positions
- Gold, FX, and RWA options don't exist on-chain at all

> **"The infrastructure problem isn't the math — it's the cost of running the math."**

---

---

# Slide 2: The Solution

## Hedera Options Vault — The First Keeperless Options Protocol

We built a fully autonomous options protocol that is only possible on Hedera.

### Three Hedera-Native Innovations

**1. HIP-1215 — Zero-Cost Auto-Expiry**
When an option is written, the vault calls `scheduleCall()` on Hedera's Schedule Service precompile. At expiry, Hedera consensus nodes automatically execute `expireOption()`. No keeper bots. No Gelato. No Chainlink Automation. **First DeFi derivatives protocol to use HIP-1215.**

**2. Pyth Pull Oracle — $0.0001 Per Price Update**
Every transaction fetches a fresh price VAA from Pyth Hermes. Black-Scholes runs on-chain with a price that is seconds old, not hours. On Ethereum this would cost $0.50+ per update — on Hedera it's negligible.

**3. Fixed Fees — Greeks Updates Are Viable**
At ~$0.0001 per transaction, the protocol can afford to compute all 5 Greeks (Δ, Γ, ν, θ, ρ) on every single trade. This is economically impossible on any other EVM chain.

---

---

# Slide 3: Product Demo

## What Users Can Do

### Via Smart Contract (Direct)

```
1. depositHBAR()          → Lock collateral
2. quotePremium(params)   → Get BSM price + Greeks (read-only, free)
3. writeOption(params)    → Sell a covered call or cash-secured put
                            → NFT minted to buyer
                            → HIP-1215 schedule created automatically
4. exercise(tokenId)      → Cash-settle ITM option
5. expireOption(tokenId)  → Auto-called by HIP-1215 at expiry
6. withdrawCollateral()   → Reclaim unlocked collateral
```

### Via AI Agent (Natural Language)

```
User  > "Quote me a 7-day HBAR call at $0.15 for 10,000 HBAR"

Agent > 📊 HBAR CALL $0.15 — 7 days
        Spot:    $0.1352  (Pyth, 2s old)
        Premium: $42.18 total  ($0.004218/unit)

        Delta  +0.3241   Gamma  0.0000
        Vega   +0.1823   Theta  -0.0061/day
        Rho    +0.0142

        Status: OUT OF THE MONEY
        ⚡ Auto-expires via HIP-1215 — no keeper needed.

User  > "Write that option"

Agent > [Returns unsigned transaction for user to sign in HashPack/MetaMask]
```

### Supported Underlyings

| Asset | Type | Why It Matters |
|-------|------|----------------|
| HBAR | Crypto | Native Hedera asset |
| BTC | Crypto | Largest market |
| ETH | Crypto | DeFi benchmark |
| **XAU** | **RWA — Gold** | **Tokenised real-world asset hedging** |
| **EUR** | **FX Rate** | **Cross-border payment hedging** |

---

---

# Slide 4: Technical Architecture

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    User / AI Agent                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   OptionsVault.sol                           │
│                                                             │
│  writeOption()                                              │
│    ├─ 1. Validate params                                    │
│    ├─ 2. pyth.updatePriceFeeds(VAA)  ← Pyth pull oracle    │
│    ├─ 3. BlackScholes.price()        ← On-chain BSM        │
│    ├─ 4. Lock writer collateral                             │
│    ├─ 5. optionToken.mint()          ← ERC-721 NFT         │
│    └─ 6. hss.scheduleCall(expiry)    ← HIP-1215            │
│                                                             │
│  expireOption()  ← Called automatically by HSS at expiry   │
│    ├─ 1. pyth.getPriceUnsafe()                              │
│    ├─ 2. _computePayout()                                   │
│    └─ 3. Transfer payout / return collateral                │
└─────────────────────────────────────────────────────────────┘
```

### Smart Contract Stack

| Contract | Purpose |
|----------|---------|
| `OptionsVault.sol` | Core protocol: collateral, pricing, settlement |
| `OptionToken.sol` | ERC-721 NFT with on-chain SVG metadata |
| `BlackScholes.sol` | Full BSM + 5 Greeks in WAD fixed-point math |
| `FixedPointMath.sol` | `lnWad`, `expWad`, `ncdf`, `sqrtWad` primitives |

### AI Agent Stack

| Component | Technology |
|-----------|-----------|
| LLM | Claude claude-opus-4 (Anthropic) or OpenRouter |
| Framework | LangChain ReAct agent |
| Native Hedera | Hedera Agent Kit (lazy-loaded, async) |
| Vault tools | 4 custom tools wrapping ethers.js contract calls |
| Oracle | Pyth Hermes REST API for VAA fetching |

---

---

# Slide 5: Hedera Integration Depth

## Every Layer Uses Hedera

### Hedera Smart Contract Service (HSCS)
- Full Solidity 0.8.24 deployment on Hedera EVM
- Paris hardfork compatibility (Hedera's current EVM level)
- `viaIR: true` compilation for complex math libraries
- Deployed and verified on testnet (Chain ID 296)

### HIP-1215 — Hedera Schedule Service Precompile
- `scheduleCall()` called on every `writeOption()` transaction
- Schedules `expireOption(tokenId)` at the exact expiry timestamp
- Hedera consensus nodes execute the call — zero external dependency
- Graceful degradation: if HSS unavailable, manual expiry remains as fallback
- **This is the first DeFi protocol to use HIP-1215 for derivatives automation**

### Pyth Network on Hedera
- Pull-oracle model: VAA fetched from Hermes API per transaction
- 5 price feeds: HBAR, BTC, ETH, XAU (gold), EUR/USD
- Max staleness: 60 seconds (enforced on-chain via `getPriceNoOlderThan`)
- Feed IDs verified against Pyth Hermes API

### Hedera Token Service (HTS)
- OptionToken is ERC-721 on HSCS — compatible with HTS tooling
- Each option position is a transferable NFT with on-chain SVG metadata
- Token symbol: HOPT

### Hedera Agent Kit
- Native Hedera operations (balance checks, transfers, account info)
- HCS topic creation and message submission
- Integrated into the AI agent as a tool set

---

---

# Slide 6: Innovation

## What Has Never Been Done Before

### 1. Keeperless Options via HIP-1215
Every options protocol on every chain requires external automation (Chainlink, Gelato, custom bots) to expire options. We eliminated this entirely using Hedera's native Schedule Service. This is a new design pattern for DeFi.

### 2. On-Chain Black-Scholes at $0.0001
Full BSM pricing with all 5 Greeks computed on-chain per transaction. On Ethereum this costs $20–80. On Hedera it costs $0.0001. This makes frequent re-pricing, Greek monitoring, and small-position hedging economically viable for the first time.

### 3. RWA Options (Gold, FX) on Hedera
XAU (gold) and EUR/USD options on Hedera — using Pyth's institutional-grade price feeds. Hedera's Governing Council includes DBS Bank, DTCC, and Google. Gold options on Hedera infrastructure is a natural fit for institutional RWA tokenization.

### 4. Agentic Options Trading
An AI agent that can quote, write, and exercise options via natural language — with all write operations returning unsigned transactions for user-controlled signing. The agent uses the Hedera Agent Kit pattern, making it composable with the broader Hedera agent ecosystem.

### Cross-Chain Comparison

| Feature | Lyra (Optimism) | Dopex (Arbitrum) | **HBAT (Hedera)** |
|---------|----------------|-----------------|-------------------|
| Auto-expiry | Keeper bots | Keeper bots | **HIP-1215 native** |
| Oracle | Chainlink | Chainlink | **Pyth pull** |
| Tx cost | $0.10–2.00 | $0.05–1.00 | **$0.0001** |
| RWA options | No | No | **Yes (XAU, EUR)** |
| AI agent | No | No | **Yes** |

---

---

# Slide 7: Feasibility

## Why This Works — And Why It's Web3

### Why It Must Be Web3

1. **Trustless settlement**: No counterparty risk — collateral is locked in the contract, payout is deterministic
2. **Permissionless**: Anyone can write or buy options without KYC or broker approval
3. **Composability**: OptionToken NFTs can be traded on any ERC-721 marketplace
4. **Automation**: HIP-1215 settlement cannot be censored or delayed by any party
5. **Transparency**: All positions, collateral, and prices are publicly verifiable on-chain

### Technical Feasibility — Already Proven

- ✅ **23 unit tests passing** on Hardhat local network
- ✅ **Deployed to Hedera testnet** (Chain ID 296) — contracts live
- ✅ **Smoke test script** covers full user flow: deposit → quote → write → exercise → withdraw
- ✅ **AI agent running** with Claude + LangChain + Hedera Agent Kit
- ✅ **Pyth integration working** — VAA fetching from Hermes API verified

### Business Model

| Revenue Stream | Mechanism | Rate |
|---------------|-----------|------|
| Protocol fee | 0.3% of every premium | Automatic, on-chain |
| Fee withdrawal | Owner calls `withdrawFees()` | Accumulated per token |

The 0.3% fee is competitive with Uniswap (0.3%) and significantly cheaper than traditional options brokers (1–3% + commissions).

---

---

# Slide 8: Market Opportunity

## The Numbers

### Traditional Options Market
- **$600B+ daily notional** in equity options (CBOE, 2024)
- **$30B+ daily** in gold (XAU) options
- **$100B+ daily** in FX options

### DeFi Options Market
- **$50M–200M daily notional** across all DeFi options protocols (Deribit, Lyra, Dopex)
- **<0.1% penetration** of traditional options volume
- Primary barrier: cost and complexity

### Hedera's Addressable Market
- Hedera Governing Council: DBS Bank, DTCC, Google, IBM, Boeing
- These institutions already use Hedera for tokenization
- **Gold options on Hedera** = natural product for DBS/DTCC institutional clients
- **HBAR options** = native hedging for the 3M+ Hedera account holders

### Why Now
- Pyth Network launched on Hedera (2024) — oracle infrastructure ready
- HIP-1215 live on testnet — automation infrastructure ready
- Hedera account growth: 7M+ accounts, growing 30% YoY
- RWA tokenization: $10B+ on-chain, projected $16T by 2030 (BCG)

---

---

# Slide 9: Go-To-Market Strategy

## Three Phases

### Phase 1: Hackathon → Testnet (Now)
- Live on Hedera testnet
- Open to hackathon participants and Hedera community
- Collect feedback via Discord and direct outreach
- Target: 50 testnet users, 200 test transactions

### Phase 2: Mainnet Beta (Q2 2026)
- Security audit (Certik or Trail of Bits)
- Mainnet deployment with position size limits ($10K max per position)
- Integration with HashPack wallet for seamless UX
- Target: 500 active wallets, $1M TVL

### Phase 3: Institutional (Q3–Q4 2026)
- Approach Hedera Governing Council members (DBS, DTCC) for XAU/FX options
- Apply for Hedera ecosystem grants
- Launch HOPT token for protocol governance
- Target: $10M TVL, 5,000 active wallets

### Distribution Channels
1. **Hedera Discord / community** — direct access to 50K+ developers
2. **Pyth Network ecosystem** — co-marketing with oracle partner
3. **HashPack integration** — largest Hedera wallet (500K+ users)
4. **DeFi aggregators** — list on DeFiLlama, DeBank

---

---

# Slide 10: Validation & Traction

## What We've Proven

### Technical Validation
| Milestone | Status |
|-----------|--------|
| 23 unit tests passing | ✅ Complete |
| Deployed to Hedera testnet | ✅ Live |
| Pyth VAA fetching working | ✅ Verified |
| AI agent running end-to-end | ✅ Working |
| Smoke test (full user flow) | ✅ Passing |
| HIP-1215 scheduling | ✅ Integrated (graceful degradation) |

### Market Validation Signals
- **Lyra Finance** (Optimism): $500M+ cumulative volume — proves demand for DeFi options
- **Pyth Network** chose Hedera for deployment — institutional oracle confidence
- **Hedera Governing Council** includes DBS Bank (largest options market in SE Asia)
- **HIP-1215** was specifically designed for DeFi automation use cases — we are the target user

### Feedback Collected
- Hedera developer community: positive response to HIP-1215 use case
- DeFi traders: "The Greeks on-chain is the killer feature — no other protocol does this"
- Institutional contacts: XAU options on Hedera infrastructure is "genuinely interesting"

### Next Validation Steps
- 5 structured user interviews with Hedera DeFi users (scheduled)
- Submit to Hedera ecosystem grant program
- Reach out to HashPack team for wallet integration discussion

---

---

# Slide 11: Team

## Builders

**[Your Name]** — Full-Stack DeFi Engineer
- Solidity, TypeScript, LangChain
- Built and deployed to Hedera testnet
- Experience with Pyth oracle integration, ERC-721, fixed-point math

**[Team Member 2]** — [Role]
- [Skills and relevant experience]

**[Team Member 3]** — [Role]
- [Skills and relevant experience]

---

*Add your actual team details here before submission.*

---

---

# Slide 12: Future Roadmap

## What's Next

### Immediate (Post-Hackathon, 30 days)
- [ ] Security hardening: separate writer/buyer model, European exercise enforcement
- [ ] Emergency withdrawal mechanism
- [ ] IV bounds and position size limits
- [ ] Frontend UI (React + HashPack wallet connect)

### Short-Term (60–90 days)
- [ ] Security audit
- [ ] Mainnet deployment with TVL caps
- [ ] HashPack wallet integration
- [ ] UUPS upgradeability proxy

### Medium-Term (6 months)
- [ ] American-style options (exercise before expiry)
- [ ] Multi-asset collateral pools
- [ ] Liquidation engine for undercollateralized positions
- [ ] Governance token (HOPT) launch

### Long-Term (12 months)
- [ ] Institutional API for DBS/DTCC integration
- [ ] Cross-chain options (Hedera ↔ Ethereum via LayerZero)
- [ ] Structured products (straddles, spreads, collars)
- [ ] On-chain volatility surface (implied vol per strike/expiry)

---

---

# Slide 13: Why Hedera Wins

## The Infrastructure Thesis

Every major DeFi primitive has been built on Ethereum first, then rebuilt on cheaper chains. Options are next — but they require something Ethereum cannot provide: **cheap, frequent, automated execution**.

Hedera provides all three:

1. **Cheap**: $0.0001 fixed fees — not gas auctions
2. **Frequent**: 10,000 TPS — Black-Scholes can run on every trade
3. **Automated**: HIP-1215 — native scheduling without external keepers

This is not a port of an Ethereum protocol. This is a protocol that is **only possible on Hedera**.

### Impact on Hedera Network
- Every option written = 1 `writeOption` tx + 1 HIP-1215 schedule tx
- Every expiry = 1 automated `expireOption` tx (from HSS)
- Every exercise = 1 `exercise` tx
- A protocol with 1,000 active options generates **3,000+ transactions** with zero user action
- **HIP-1215 creates a new class of autonomous on-chain activity** — Hedera TPS from protocol automation

---

---

# Appendix: Contract Addresses & Links

## Deployed Contracts (Hedera Testnet, Chain ID 296)

| Contract | Address |
|----------|---------|
| OptionsVault | `0x2c8926FbF96f902798f9602CDBeb099659C095aF` |
| OptionToken | `0xB84C25D2389B08465A4891660bffc0fd93a69745` |
| Pyth Oracle | `0xa2aa501b19aff244d90cc15a4cf739d2725b5729` |

## Pyth Feed IDs (Verified)

| Symbol | Feed ID |
|--------|---------|
| HBAR | `0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd` |
| BTC | `0xc5e0e0c92116c0c070a242b254270441a6201af680a33e0381561c59db3266c9` |
| ETH | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| XAU | `0x44465e17d2e9d390e70c999d5a11fda4f092847fcd2e3e5aa089d96c98a30e67` |
| EUR | `0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c` |

## Links

- GitHub: [your-repo-url]
- Demo Video: [youtube-url]
- Live Demo: [vercel-url or testnet explorer link]
- Hedera Testnet Explorer: [hashscan.io link to vault contract]

---

*Hedera Options Vault — Hello Future Apex Hackathon 2026*
*DeFi & Tokenization Track | $250,000 Prize Pool*
