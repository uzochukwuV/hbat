/**
 * Hedera Options Vault — Agent API Server
 *
 * Exposes the AI agent via REST API for frontend integration.
 * All write operations return unsigned transactions for user wallet signing.
 *
 * Start: npm run agent:api
 */

import express, { Request, Response } from "express";
import cors from "cors";
import { OptionsAgentSession } from "./agent";

const app = express();
app.use(cors());
app.use(express.json());

// ── Session Management ───────────────────────────────────────────────────────

// In production, use Redis or similar for session storage
const sessions = new Map<string, OptionsAgentSession>();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

async function getOrCreateSession(sessionId: string): Promise<OptionsAgentSession> {
  if (!sessions.has(sessionId)) {
    const session = new OptionsAgentSession();
    await session.init();
    sessions.set(sessionId, session);

    // Auto-cleanup after timeout
    setTimeout(() => {
      sessions.delete(sessionId);
    }, SESSION_TIMEOUT_MS);
  }
  return sessions.get(sessionId)!;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

interface UnsignedTx {
  to: string;
  value: string;
  data: string;
  gasLimit: number;
}

/**
 * Extract unsigned transaction from agent response.
 * Agent wraps transactions in ```unsigned-tx code blocks.
 */
function extractUnsignedTx(response: string): UnsignedTx | null {
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

/**
 * Clean agent response for display (remove raw tx JSON if present).
 */
function cleanResponseForDisplay(response: string): string {
  // Keep everything except the raw JSON in unsigned-tx blocks
  return response.replace(
    /```unsigned-tx\n[\s\S]*?\n```/g,
    "[Transaction ready for signing]"
  );
}

// ── API Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Send a message to the AI agent and get a response.
 *
 * Request body:
 *   - message: string (required) - User's message
 *   - sessionId: string (required) - Unique session identifier
 *   - userAddress: string (optional) - User's wallet address for context
 *
 * Response:
 *   - message: string - Agent's response (cleaned for display)
 *   - rawMessage: string - Full agent response
 *   - unsignedTx: object | null - Transaction to sign, if any
 *   - timestamp: number
 */
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId, userAddress } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'message' field" });
    }

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'sessionId' field" });
    }

    const session = await getOrCreateSession(sessionId);

    // Inject user wallet context if provided
    const contextMessage = userAddress
      ? `[User wallet: ${userAddress}] ${message}`
      : message;

    const rawResponse = await session.chat(contextMessage);

    // Parse for unsigned transactions
    const unsignedTx = extractUnsignedTx(rawResponse);
    const cleanedResponse = cleanResponseForDisplay(rawResponse);

    res.json({
      message: cleanedResponse,
      rawMessage: rawResponse,
      unsignedTx,
      hasTransaction: unsignedTx !== null,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "An unexpected error occurred",
    });
  }
});

/**
 * POST /api/clear
 * Clear conversation history for a session.
 */
app.post("/api/clear", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const session = sessions.get(sessionId);
    if (session) {
      session.clearHistory();
    }

    res.json({ success: true, message: "Conversation cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear session" });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    activeSessions: sessions.size,
    timestamp: Date.now(),
  });
});

/**
 * GET /api/prices
 * Fetch current prices from Pyth Hermes (convenience endpoint).
 */
app.get("/api/prices", async (_req: Request, res: Response) => {
  try {
    const HERMES_URL = "https://hermes.pyth.network";
    const FEEDS = {
      HBAR: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
      BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    };

    const feedIds = Object.values(FEEDS).map((id) => `ids[]=${id}`).join("&");
    const url = `${HERMES_URL}/v2/updates/price/latest?${feedIds}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      parsed: { id: string; price: { price: string; expo: number } }[];
    };

    const prices: Record<string, number> = {};
    for (const item of data.parsed) {
      const symbol = Object.entries(FEEDS).find(([, id]) => id === item.id)?.[0];
      if (symbol) {
        const price = Number(item.price.price) * Math.pow(10, item.price.expo);
        prices[symbol] = price;
      }
    }

    res.json({ prices, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// ── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║        HEDERA OPTIONS VAULT  —  Agent API                ║
╚══════════════════════════════════════════════════════════╝

Server running on http://localhost:${PORT}

Endpoints:
  POST /api/chat    - Send message to AI agent
  POST /api/clear   - Clear conversation history
  GET  /api/health  - Health check
  GET  /api/prices  - Live Pyth prices

Environment:
  Network: ${process.env.HEDERA_NETWORK || "testnet"}
  Vault:   ${process.env.OPTIONS_VAULT_ADDRESS || "from deployment"}
`);
});

export default app;
