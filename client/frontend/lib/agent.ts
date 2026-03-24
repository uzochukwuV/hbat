/**
 * AI Agent API Client
 * Communicates with the backend agent server
 */

import { config } from "./config";
import type { AgentChatRequest, AgentChatResponse } from "@/types";

class AgentClient {
  private baseUrl: string;

  constructor(baseUrl: string = config.agentApiUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a message to the AI agent
   */
  async chat(request: AgentChatRequest): Promise<AgentChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `Agent API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Clear conversation history
   */
  async clearHistory(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error("Failed to clear conversation history");
    }
  }

  /**
   * Get current prices from Pyth
   */
  async getPrices(): Promise<Record<string, number>> {
    const response = await fetch(`${this.baseUrl}/api/prices`);

    if (!response.ok) {
      throw new Error("Failed to fetch prices");
    }

    const data = await response.json();
    return data.prices;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/api/health`);

    if (!response.ok) {
      throw new Error("Agent API is not healthy");
    }

    return response.json();
  }
}

// Singleton instance
export const agentClient = new AgentClient();
