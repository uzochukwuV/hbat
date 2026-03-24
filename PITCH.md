# Hedera Options Vault
## AI-Powered Options Trading on Hedera

---

# Slide 1: Title

## **Hedera Options Vault**
### The First AI-Powered Options Protocol on Hedera

*Trade options through natural language conversation*

**Hello Future Hackathon 2026**

---

# Slide 2: The Problem

## Traditional DeFi Options Are Broken

### For Users:
- **Complex Interfaces** - Intimidating for non-experts
- **High Fees** - Ethereum gas makes small trades uneconomical
- **Keeper Dependencies** - Settlement relies on third-party bots
- **Poor UX** - Multiple clicks, confusing Greeks, no guidance

### For Protocols:
- **Infrastructure Overhead** - Running keeper networks is expensive
- **Oracle Manipulation** - Slow oracles enable attacks
- **Variable Costs** - Unpredictable gas makes pricing hard

---

# Slide 3: Our Solution

## Hedera Options Vault

### AI-Powered Trading
> "Write me a 7-day HBAR call at $0.15 for 1000 HBAR"

The AI agent handles everything:
- Fetches live prices from Pyth
- Calculates Black-Scholes premium & Greeks
- Builds the transaction
- User simply signs with their wallet

### Native Hedera Advantages
- **HIP-1215 Auto-Settlement** - No keepers needed
- **Fixed Fees** - ~$0.0001 per transaction
- **Sub-Second Oracle** - Pyth provides <400ms latency
- **Fair Ordering** - No MEV, no front-running

---

# Slide 4: How It Works

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                         │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Dashboard  │    │   AI Chat    │    │  HashPack     │  │
│  │  (Next.js)  │◄──►│   Panel      │◄──►│  Wallet       │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI AGENT API                           │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  LangChain  │    │    Tools     │    │   Session     │  │
│  │  + Claude   │───►│  (9 tools)   │───►│   Manager     │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    HEDERA BLOCKCHAIN                        │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │OptionsVault │    │ OptionToken  │    │   HIP-1215    │  │
│  │  (HSCS)     │───►│   (ERC-721)  │───►│  Scheduler    │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐                       │
│  │    Pyth     │    │   Mirror     │                       │
│  │   Oracle    │    │    Node      │                       │
│  └─────────────┘    └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

# Slide 5: AI Agent Deep Dive

## Conversational Options Trading

### Available Commands (Natural Language)

| User Says | AI Agent Does |
|-----------|---------------|
| "What's the HBAR price?" | Fetches live Pyth price |
| "Quote me a put at $0.08" | Calculates premium + Greeks |
| "Deposit 100 HBAR" | Builds deposit transaction |
| "Write a 7-day call at $0.15" | Creates option + returns unsigned tx |
| "Show my positions" | Queries on-chain state |
| "Exercise option #5" | Builds exercise transaction |

### Under the Hood
- **LangChain Agent** with tool-calling capabilities
- **9 Custom Tools** wrapping Hedera operations
- **Unsigned Transaction Pattern** - AI never touches private keys
- **Context-Aware** - Remembers conversation history

---

# Slide 6: Smart Contract Architecture

## OptionsVault.sol

### Key Features

```solidity
// Write an option (covered call or cash-secured put)
function writeOption(
    WriteParams calldata params,
    uint256 maxPremiumWad
) external payable returns (uint256 tokenId);

// Automatic settlement via HIP-1215
function settleOption(uint256 tokenId) external;

// Black-Scholes pricing with Greeks
function quotePremium(
    QuoteParams calldata params
) external view returns (uint256 premium, Greeks memory greeks);
```

### Security Model
- **Covered Calls** - Collateral = spot × size
- **Cash-Secured Puts** - Collateral = strike × size
- **European Style** - Exercise at expiry only
- **Cash Settlement** - No physical delivery

---

# Slide 7: HIP-1215 Innovation

## Native Auto-Settlement

### Traditional DeFi (Keeper Bots)
```
Option Expires
     │
     ▼
Keeper Bot Monitors ──► Gas Competition ──► Settlement
     │                        │
     └── Can fail ◄──────────┘
         Can be frontrun
         Requires infrastructure
```

### Hedera (HIP-1215)
```
Option Created
     │
     ▼
Schedule Transaction ──► Hedera Executes at Expiry
     │                           │
     └── Guaranteed ◄───────────┘
         No keeper needed
         No extra gas
```

**Result:** Reliable, trustless settlement without operational overhead

---

# Slide 8: Pyth Oracle Integration

## Sub-Second Price Feeds

### Supported Assets
| Symbol | Feed ID | Use Case |
|--------|---------|----------|
| HBAR | 0x3728e5... | Native options |
| BTC | 0xe62df6... | Crypto derivatives |
| ETH | 0xff6149... | Cross-chain options |
| XAU | 0x44465e... | RWA (Gold) |
| EUR | 0x76fa85... | FX options |

### Why Pyth on Hedera?
- **Pull Oracle** - On-demand price updates
- **<400ms Latency** - Faster than block time
- **Confidence Intervals** - Built-in price bands
- **Cost Effective** - Batch updates with Hedera's low fees

---

# Slide 9: Demo Walkthrough

## User Journey

### 1. Connect Wallet
- HashPack via WalletConnect
- See balance and account info

### 2. Chat with AI
> "Deposit 50 HBAR as collateral"

AI returns unsigned transaction → Modal appears → User signs

### 3. Write Option
> "Write a 7-day HBAR call at $0.12 for 100 HBAR"

AI:
- Fetches live price ($0.0925)
- Calculates premium ($0.32)
- Shows Greeks (Δ=0.45, Γ=12.5, ...)
- Returns transaction to sign

### 4. Track Positions
- View open positions in sidebar
- See P&L in real-time
- Options auto-settle at expiry

---

# Slide 10: Technical Differentiators

## Why Hedera?

| Feature | Ethereum | Hedera |
|---------|----------|--------|
| Gas Fees | Variable ($1-$100+) | Fixed (~$0.0001) |
| Finality | ~13 min (safe) | 3-5 seconds |
| Auto-Settlement | Requires keepers | Native (HIP-1215) |
| Front-Running | MEV is rampant | Fair ordering |
| Oracle Latency | ~12 sec blocks | <400ms with Pyth |

### Unique to Our Protocol
- **AI Interface** - First conversational options protocol
- **No Keepers** - HIP-1215 handles settlement
- **Full Greeks** - On-chain Black-Scholes
- **Multi-Asset** - HBAR, BTC, ETH, Gold, EUR

---

# Slide 11: Judging Criteria Alignment

## 1. Technical Implementation (Weight: 40%)
- ✅ Full smart contract suite (OptionsVault, OptionToken)
- ✅ AI agent with LangChain + 9 custom tools
- ✅ HashPack wallet integration via WalletConnect
- ✅ Pyth oracle integration for 5 assets
- ✅ HIP-1215 scheduled transaction implementation

## 2. Innovation (Weight: 30%)
- ✅ First AI-powered options protocol on Hedera
- ✅ Novel use of HIP-1215 for trustless settlement
- ✅ Conversational trading UX paradigm

## 3. User Experience (Weight: 20%)
- ✅ Natural language interface (no DeFi expertise needed)
- ✅ Real-time position tracking
- ✅ Transaction history with HashScan links

## 4. Hedera Utilization (Weight: 10%)
- ✅ HSCS for smart contracts
- ✅ HIP-1215 for scheduling
- ✅ Mirror Node for queries
- ✅ HashPack/WalletConnect integration

---

# Slide 12: Future Roadmap

## Phase 1: Post-Hackathon (Q2 2026)
- [ ] Mainnet deployment
- [ ] Security audit
- [ ] Additional collateral types (USDC, WBTC)
- [ ] Mobile-responsive UI

## Phase 2: Growth (Q3 2026)
- [ ] Options marketplace (secondary trading)
- [ ] Limit orders via HIP-1215
- [ ] Portfolio analytics dashboard
- [ ] Multi-language AI support

## Phase 3: Scale (Q4 2026)
- [ ] Exotic options (barriers, Asians)
- [ ] Institutional API
- [ ] Cross-chain settlement (Chainlink CCIP)
- [ ] Governance token

---

# Slide 13: Key Learnings

## What We Learned

### Technical
- HIP-1215 is a powerful primitive for DeFi automation
- Hedera's fixed fees enable micro-transactions impossible on Ethereum
- Mirror Node + JSON-RPC combo provides excellent developer experience

### Product
- AI dramatically lowers the barrier to DeFi participation
- Conversational UI can abstract away blockchain complexity
- Users prefer "tell me what to do" over "give me 50 buttons"

### Challenges Overcome
- Wallet integration between EVM and Hedera native formats
- Contract ID resolution from EVM addresses
- Building unsigned transaction pattern for AI safety

---

# Slide 14: Team

## Built By

### [Your Name]
- Role: Full-Stack Developer
- Background: [Your background]
- GitHub: [Your GitHub]
- LinkedIn: [Your LinkedIn]

### Tech Stack Expertise
- Solidity & Smart Contracts
- React/Next.js Frontend
- LangChain & AI Agents
- Hedera Hashgraph

---

# Slide 15: Thank You

## Hedera Options Vault

### Links
- **Demo:** https://hbat-demo.vercel.app
- **GitHub:** https://github.com/YOUR_REPO/hbat
- **Video:** https://loom.com/share/YOUR_VIDEO

### Contact
- Discord: your_handle
- Twitter: @your_handle
- Email: your@email.com

---

*"Trade options like you're chatting with a friend"*

**Built for Hello Future Hackathon 2026**
