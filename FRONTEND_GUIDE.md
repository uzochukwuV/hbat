# Frontend Development Guide

## Table of Contents
1. [Deploying the AI Agent API](#deploying-the-ai-agent-api)
2. [Architecture Overview](#architecture-overview)
3. [User Flows](#user-flows)
4. [UI Components](#ui-components)
5. [Wallet Integration](#wallet-integration)
6. [UX Best Practices](#ux-best-practices)

---

## Deploying the AI Agent API

### Step 1: Create the API Server

Create `agent/src/server.ts`:

```typescript
import express from "express";
import cors from "cors";
import { OptionsAgentSession } from "./agent";

const app = express();
app.use(cors());
app.use(express.json());

// Store sessions per user (in production, use Redis)
const sessions = new Map<string, OptionsAgentSession>();

async function getOrCreateSession(sessionId: string): Promise<OptionsAgentSession> {
  if (!sessions.has(sessionId)) {
    const session = new OptionsAgentSession();
    await session.init();
    sessions.set(sessionId, session);
  }
  return sessions.get(sessionId)!;
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId, userAddress } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: "Missing message or sessionId" });
    }

    const session = await getOrCreateSession(sessionId);

    // Inject user context if provided
    const contextMessage = userAddress
      ? `[User wallet: ${userAddress}] ${message}`
      : message;

    const response = await session.chat(contextMessage);

    // Parse for unsigned transactions
    const unsignedTx = extractUnsignedTx(response);

    res.json({
      message: response,
      unsignedTx,  // If present, frontend should prompt wallet signing
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Health check
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// Extract unsigned tx from agent response
function extractUnsignedTx(response: string): object | null {
  const match = response.match(/```unsigned-tx\n([\s\S]*?)\n```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Agent API running on http://localhost:${PORT}`);
});
```

### Step 2: Add dependencies

```bash
npm install express cors
npm install -D @types/express @types/cors
```

### Step 3: Add npm script

In `package.json`:
```json
{
  "scripts": {
    "agent:api": "node -r ts-node/register agent/src/server.ts"
  }
}
```

### Step 4: Deploy Options

| Platform | Command | Notes |
|----------|---------|-------|
| Local | `npm run agent:api` | Development |
| Railway | `railway up` | Add `railway.json` |
| Render | Push to GitHub | Add `render.yaml` |
| Vercel | Edge functions | Serverless |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Chat Panel  │  │  Portfolio   │  │  Transaction Modal   │  │
│  │              │  │  Dashboard   │  │  (Sign & Submit)     │  │
│  │  AI Agent    │  │              │  │                      │  │
│  │  Interface   │  │  Positions   │  │  Wallet Connection   │  │
│  │              │  │  Collateral  │  │  HashPack/MetaMask   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
├─────────┴─────────────────┴──────────────────────┴──────────────┤
│                         API Layer                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  POST /api/chat     → AI Agent (returns unsigned tx)     │   │
│  │  GET  /api/prices   → Pyth Hermes (live prices)         │   │
│  │  GET  /api/account  → Mirror Node (balances)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HEDERA NETWORK                           │
├─────────────────────────────────────────────────────────────────┤
│  OptionsVault.sol        OptionToken.sol        Pyth Oracle     │
│  (Write/Exercise)        (ERC-721 NFTs)         (Price Feeds)   │
│                                                                  │
│  HIP-1215 Auto-Expiry    Mirror Node           JSON-RPC         │
│  (Schedule Service)      (Account queries)     (HashIO)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: First-Time User Onboarding

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LANDING PAGE                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   "Trade Options on Hedera with AI"                         │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [Connect Wallet]  HashPack | MetaMask | Blade      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   • No keeper bots — auto-settlement via HIP-1215           │
│   • $0.0001 transaction fees                                │
│   • AI-powered trading assistant                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. WALLET CONNECTED                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Welcome! Your HBAR Balance: 1,250.45 HBAR                 │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  💬 "What would you like to do today?"              │   │
│   │                                                      │   │
│   │  Quick Actions:                                      │   │
│   │  [Deposit Collateral]  [Write Option]  [View Prices] │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Writing a Covered Call (Primary Use Case)

```
USER: "I want to write a covered call on HBAR"

┌─────────────────────────────────────────────────────────────┐
│ AI AGENT RESPONSE                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Current HBAR Price: $0.0932                             │
│                                                              │
│  To write a covered call, I need a few details:             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Strike Price:  [$0.10]  [$0.12]  [$0.15]  [Custom] │   │
│  │  Expiry:        [7 days] [14 days] [30 days]        │   │
│  │  Size:          [1,000]  [5,000]  [10,000] HBAR     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Or just tell me: "Write a 7-day $0.10 call for 5000 HBAR"  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

USER: "Write a 7-day $0.10 call for 5000 HBAR"

┌─────────────────────────────────────────────────────────────┐
│ AI BUILDS TRANSACTION                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📝 Covered Call Quote                                       │
│  ────────────────────────────────────────────────────────   │
│  Strike:        $0.1000 (+7.3% OTM)                         │
│  Expiry:        7 days (Mar 28, 2026)                       │
│  Size:          5,000 HBAR                                  │
│  IV:            80%                                          │
│  ────────────────────────────────────────────────────────   │
│  Premium:       12.45 HBAR ($1.16)                          │
│  Collateral:    5,000 HBAR (locked until expiry)            │
│  ────────────────────────────────────────────────────────   │
│                                                              │
│  Greeks:                                                     │
│    Δ Delta:   0.3245  │  Γ Gamma:  0.0821                   │
│    ν Vega:    0.0234  │  θ Theta: -0.0089                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         [Sign Transaction with HashPack]             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Transaction Signing Modal

```
┌─────────────────────────────────────────────────────────────┐
│ SIGN TRANSACTION                                     [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️  Review carefully before signing                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Action:     Write Covered Call                      │   │
│  │  Contract:   0x34A3...d303 (OptionsVault)           │   │
│  │                                                      │   │
│  │  You will:                                           │   │
│  │    • Lock 5,000 HBAR as collateral                  │   │
│  │    • Receive ~12.45 HBAR premium                    │   │
│  │    • Pay ~0.15 HBAR (Pyth fee + gas)               │   │
│  │                                                      │   │
│  │  Auto-Settlement:                                    │   │
│  │    ✅ HIP-1215 scheduled for Mar 28, 2026 00:00    │   │
│  │    No action needed at expiry                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│           [Cancel]              [Sign & Submit]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Component Structure

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx         # Main AI chat interface
│   │   ├── MessageBubble.tsx     # Individual message
│   │   ├── QuickActions.tsx      # Preset action buttons
│   │   └── TransactionCard.tsx   # Embedded tx preview
│   │
│   ├── portfolio/
│   │   ├── Dashboard.tsx         # Overview stats
│   │   ├── PositionsList.tsx     # Active options
│   │   ├── PositionCard.tsx      # Single position detail
│   │   └── CollateralPanel.tsx   # Deposit/withdraw
│   │
│   ├── modals/
│   │   ├── SignTransaction.tsx   # Tx signing modal
│   │   ├── WalletConnect.tsx     # Wallet selection
│   │   └── OptionDetails.tsx     # Full position view
│   │
│   ├── common/
│   │   ├── PriceDisplay.tsx      # Live price with sparkline
│   │   ├── GreeksDisplay.tsx     # Formatted Greeks
│   │   ├── ExpiryCountdown.tsx   # Time until expiry
│   │   └── WalletButton.tsx      # Connect/disconnect
│   │
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── MobileNav.tsx
│
├── hooks/
│   ├── useWallet.ts              # Wallet connection
│   ├── useAgent.ts               # AI chat state
│   ├── usePrices.ts              # Live Pyth prices
│   ├── usePositions.ts           # User's options
│   └── useTransaction.ts         # Tx submission
│
├── lib/
│   ├── hedera.ts                 # Hedera SDK wrapper
│   ├── pyth.ts                   # Pyth API client
│   └── agent.ts                  # Agent API client
│
└── types/
    ├── option.ts
    ├── transaction.ts
    └── wallet.ts
```

### Key Component: ChatPanel

```tsx
// components/chat/ChatPanel.tsx
import { useState } from "react";
import { useAgent } from "@/hooks/useAgent";
import { useWallet } from "@/hooks/useWallet";
import { SignTransaction } from "@/components/modals/SignTransaction";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, pendingTx, isLoading } = useAgent();
  const { address, signAndSubmit } = useWallet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage(input, address);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Quick Actions */}
      <QuickActions onSelect={(action) => sendMessage(action, address)} />

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about options..."
            className="flex-1 rounded-lg border px-4 py-2"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Send
          </button>
        </div>
      </form>

      {/* Transaction Modal */}
      {pendingTx && (
        <SignTransaction
          tx={pendingTx}
          onSign={() => signAndSubmit(pendingTx)}
          onCancel={() => clearPendingTx()}
        />
      )}
    </div>
  );
}
```

---

## Wallet Integration

### HashPack (Recommended for Hedera)

```typescript
// hooks/useWallet.ts
import { HashConnect } from "hashconnect";
import { ethers } from "ethers";

export function useWallet() {
  const [hashconnect] = useState(() => new HashConnect());
  const [pairingData, setPairingData] = useState<any>(null);

  const connect = async () => {
    const initData = await hashconnect.init({
      name: "Hedera Options Vault",
      description: "AI-Powered Options Trading",
      icon: "https://yourapp.com/icon.png",
    });

    hashconnect.pairingEvent.on((data) => {
      setPairingData(data);
    });

    await hashconnect.connect();
  };

  const signAndSubmit = async (unsignedTx: UnsignedTx) => {
    if (!pairingData) throw new Error("Wallet not connected");

    const provider = hashconnect.getProvider(
      "testnet",
      pairingData.topic,
      pairingData.accountIds[0]
    );
    const signer = hashconnect.getSigner(provider);

    // Build transaction
    const tx = {
      to: unsignedTx.to,
      value: unsignedTx.value,
      data: unsignedTx.data,
      gasLimit: unsignedTx.gasLimit,
    };

    const txResponse = await signer.sendTransaction(tx);
    const receipt = await txResponse.wait();

    return receipt;
  };

  return {
    address: pairingData?.accountIds?.[0],
    connect,
    signAndSubmit,
    isConnected: !!pairingData,
  };
}
```

---

## UX Best Practices

### 1. Progressive Disclosure

Don't overwhelm new users. Show complexity gradually:

```
Level 1: "Write a call option" → Quick preset buttons
Level 2: AI suggests parameters based on market
Level 3: User can customize everything
Level 4: Show Greeks for advanced traders
```

### 2. Transaction Safety

Always show clear summaries before signing:

```
✅ DO:
  - Show exact amounts being locked
  - Show expected premium received
  - Show auto-settlement date
  - Explain what happens at expiry

❌ DON'T:
  - Show raw hex data
  - Skip confirmation steps
  - Use technical jargon without explanation
```

### 3. Real-Time Feedback

```tsx
// Show live updates
<PriceDisplay
  symbol="HBAR"
  showSparkline
  updateInterval={5000}  // 5 seconds
/>

// Show transaction status
<TransactionStatus
  hash={txHash}
  stages={["Submitted", "Confirming", "Confirmed"]}
  currentStage={stage}
/>
```

### 4. Error Handling

```tsx
// Friendly error messages
const ERROR_MESSAGES = {
  "insufficient_collateral": "You need more HBAR deposited to write this option.",
  "expiry_too_soon": "Expiry must be at least 1 hour from now.",
  "wallet_rejected": "Transaction was cancelled in your wallet.",
  "network_error": "Couldn't connect to Hedera. Please try again.",
};

// Always offer next steps
<ErrorCard
  message={friendlyMessage}
  action={
    error === "insufficient_collateral"
      ? <Button onClick={openDepositModal}>Deposit More HBAR</Button>
      : <Button onClick={retry}>Try Again</Button>
  }
/>
```

### 5. Mobile-First Design

```
┌─────────────────────┐
│  MOBILE LAYOUT      │
├─────────────────────┤
│  [≡]  Options Vault │  ← Header with hamburger
├─────────────────────┤
│                     │
│  Chat occupies      │
│  full screen        │
│                     │
│  Portfolio in       │
│  bottom sheet       │
│                     │
├─────────────────────┤
│  [💬] [📊] [👤]    │  ← Bottom nav
└─────────────────────┘
```

### 6. Onboarding Checklist

Show progress for new users:

```
Your Setup Progress:
━━━━━━━━━━━━━━━━━━━━━━━━ 66%

✅ Connect wallet
✅ Deposit collateral
⬜ Write your first option
⬜ Understand auto-settlement
```

---

## Quick Start Commands

```bash
# 1. Start the agent API
npm run agent:api

# 2. In another terminal, start frontend
cd frontend && npm run dev

# 3. Open http://localhost:3000
```

## Environment Variables (Frontend)

```env
NEXT_PUBLIC_AGENT_API_URL=http://localhost:3001
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_VAULT_ADDRESS=0x34A39e7c6C91b3FD71Ca3B863Aa126402d21b303
NEXT_PUBLIC_PYTH_HERMES_URL=https://hermes.pyth.network
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| AI Chat | Natural language interface to all features |
| Portfolio | View positions, collateral, history |
| Transaction Modal | Review and sign with wallet |
| Price Feeds | Real-time Pyth prices |
| Auto-Settlement | HIP-1215 status and countdown |

The key UX principle: **Users should never need to understand smart contracts**. The AI agent abstracts all complexity, and the frontend just needs to:

1. Send natural language to the agent
2. Display responses (including transaction cards)
3. Prompt wallet signing when needed
4. Show confirmation and status
