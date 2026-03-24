# Hedera Options Vault - Hackathon Submission

## Project Name
**Hedera Options Vault (HBAT)**

## Project Description

Hedera Options Vault is an AI-powered DeFi options trading platform built natively on Hedera. Users interact via natural language with an AI agent that handles complex options operations - from pricing to execution. The platform leverages Hedera's unique features: HIP-1215 for automatic option settlement (no keeper bots needed), fixed low fees (~$0.0001/tx), and Pyth Network for real-time oracle pricing with <400ms latency.

**Key Innovation:** First options protocol combining conversational AI with on-chain derivatives on Hedera.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Hedera Hashgraph (HSCS - Smart Contract Service) |
| **Smart Contracts** | Solidity 0.8.24, OpenZeppelin, Hardhat |
| **Oracle** | Pyth Network (Hermes API for HBAR, BTC, ETH, XAU, EUR) |
| **Frontend** | Next.js 14, React 18, TailwindCSS, TypeScript |
| **AI Agent** | LangChain, Claude/OpenRouter, Express.js |
| **Wallet** | HashPack via @hashgraph/hedera-wallet-connect, WalletConnect v2 |
| **Pricing Model** | Black-Scholes with full Greeks (Δ, Γ, ν, θ, ρ) |
| **Auto-Settlement** | HIP-1215 Scheduled Transactions |
| **Option Tokens** | ERC-721 NFTs with on-chain SVG metadata |

### Setup Instructions (Local Demo)

```bash
# 1. Clone and install
git clone https://github.com/YOUR_REPO/hbat
cd hbat

# 2. Install dependencies
cd contracts && npm install
cd ../agent && npm install
cd ../client/frontend && npm install

# 3. Configure environment
cp .env.example .env.local
# Set: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, OPENROUTER_API_KEY

# 4. Start services
cd agent && npm run agent:api     # Port 3001
cd client/frontend && npm run dev # Port 3000

# 5. Connect HashPack wallet to Hedera Testnet
```

---

## GitHub Repository

**Link:** `https://github.com/YOUR_USERNAME/hbat`

All commits made during hackathon period (Feb 17 - Mar 23, 2026).

---

## Project Demo Video Link

`https://www.loom.com/share/YOUR_VIDEO_ID`

---

## Project Demo Link

`https://hbat-demo.vercel.app` (or localhost:3000 for local demo)

**Demo Credentials:** Connect any HashPack wallet on Hedera Testnet

---

## Hackathon Survey Responses

### On a scale of 1-10, how confident did you feel after reading the docs that you could build successfully?
**8**

### On a scale of 1-10, how easy was it to get help when you were blocked?
**7**

### On a scale of 1-10, how intuitive were the APIs / SDKs to use?
**8**

### On a scale of 1-10, how easy was it to debug issues?
**6**

### On a scale of 1-10, how likely are you to build again on Hedera after the hackathon?
**9**

---

## Goals for Participating

Our primary objectives were:
1. **Explore HIP-1215** - Test native scheduled transactions for DeFi automation (replacing keeper bots)
2. **Integrate Pyth on Hedera** - Build a production-ready oracle integration for derivatives pricing
3. **AI + DeFi Innovation** - Create the first conversational AI interface for on-chain options trading
4. **Demonstrate Hedera's Advantages** - Showcase fixed fees, fast finality, and fair ordering for financial applications
5. **Learn & Build** - Gain deep experience with Hedera's ecosystem and tooling

---

## Biggest Friction or Blocker

The main challenges we faced:

1. **HashPack + WalletConnect Integration** - Converting between EVM-style transactions and Hedera's native `ContractExecuteTransaction` format required significant debugging. The `DAppConnector` signer's `freezeWithSigner()` method wasn't implemented, requiring manual transaction construction.

2. **Contract ID Resolution** - Mapping EVM addresses (0x...) to Hedera Contract IDs (0.0.XXXXX) wasn't straightforward. We had to query the Mirror Node to resolve addresses for HashPack transactions.

3. **Pyth Integration on Testnet** - The Pyth update fee mechanism on Hedera testnet required trial-and-error to find the correct value (ended up using 1 HBAR buffer).

4. **Limited SDK Documentation** - Some advanced patterns (scheduled transactions with custom payloads, complex ABI encoding) had sparse examples.

---

## What Could Improve the Hackathon Experience

1. **More wallet integration examples** - End-to-end examples showing HashPack/Blade integration with complex contract calls
2. **Testnet faucet reliability** - Sometimes the faucet was slow or had limits
3. **Mirror Node documentation** - More examples for querying contract state and resolving addresses
4. **HIP-1215 examples** - Working code samples for scheduled transaction patterns in DeFi contexts

---

## What Worked Especially Well

1. **Hardhat + Hedera JSON-RPC Relay** - Seamless deployment experience, felt like Ethereum
2. **Mirror Node API** - Excellent for querying balances, transactions, and contract state
3. **Fixed Gas Fees** - Made cost estimation trivial and reliable
4. **Fast Finality** - 3-5 second confirmation times made testing smooth
5. **Discord Community** - Quick responses from Hedera team members
6. **Hashio RPC** - Reliable testnet endpoint with good uptime

---

## Hedera Testnet Account ID

**Account ID:** `0.0.5964482`

This account was used for:
- Contract deployments (OptionsVault, OptionToken)
- Test transactions (deposits, option writes)
- Development and testing throughout the hackathon

---

## Mainnet Wallet Addresses (for Apex NFT)

`0.0.XXXXXX` (Team member 1)

---

## Discord Handles

`your_discord_handle`

---

## LinkedIn Profile URLs

`https://linkedin.com/in/your-profile`

---

## Thoughts on Building on Hedera

**What Worked Well:**
- The **fixed fee model** is a game-changer for DeFi applications. Users know exactly what transactions cost, enabling better UX.
- **Fast finality** (3-5 seconds) makes the platform feel responsive and production-ready.
- **HIP-1215 scheduled transactions** eliminate the need for keeper infrastructure, reducing operational complexity and costs.
- The **Mirror Node** provides excellent queryability for building rich frontends.
- **Hashio JSON-RPC** made the Ethereum tooling (Hardhat, ethers.js) work seamlessly.

**Challenges:**
- Wallet integration required understanding both EVM and Hedera native transaction formats.
- Some SDK methods weren't fully implemented in wallet connectors (e.g., `freezeWithSigner`).
- Debugging contract reverts was harder than on Ethereum due to different error formats.

**Suggestions:**
- More complete wallet integration SDKs with complex contract call examples
- Better error messages from HSCS for debugging
- More DeFi-specific documentation (oracles, scheduled transactions, etc.)

**Overall:** Hedera's unique features (HIP-1215, fixed fees, fair ordering) make it exceptionally well-suited for financial applications. We're excited to continue building after the hackathon.

---

## Bounty Submission

Submitting for relevant bounties at: https://go.hellofuturehackathon.dev/submit-bounty
