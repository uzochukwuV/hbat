"use client";

/**
 * useAgent Hook
 * Manages AI agent chat interface and state
 */

import { useState, useCallback, useEffect } from "react";
import { agentClient } from "@/lib/agent";
import { generateSessionId, saveSessionId, getSessionId } from "@/lib/utils";
import type { AgentMessage, AgentChatResponse, UnsignedTransaction } from "@/types";

export function useAgent(userAddress?: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<UnsignedTransaction | null>(null);

  /**
   * Initialize session
   */
  useEffect(() => {
    const existingSessionId = getSessionId();
    if (existingSessionId) {
      setSessionId(existingSessionId);
    } else {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      saveSessionId(newSessionId);
    }
  }, []);

  /**
   * Send message to AI agent
   */
  const sendMessage = useCallback(
    async (message: string): Promise<AgentChatResponse> => {
      if (!sessionId) {
        throw new Error("Session not initialized");
      }

      setIsLoading(true);
      setError(null);

      // Add user message to chat
      const userMessage: AgentMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await agentClient.chat({
          message,
          sessionId,
          userAddress,
        });

        // Add agent response to chat
        const agentMessage: AgentMessage = {
          role: "agent",
          content: response.message,
          timestamp: response.timestamp,
        };
        setMessages((prev) => [...prev, agentMessage]);

        // Store pending transaction if present
        if (response.hasTransaction && response.unsignedTx) {
          setPendingTransaction(response.unsignedTx);
        }

        return response;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to communicate with AI agent";
        setError(errorMsg);

        // Add error message to chat
        const errorMessage: AgentMessage = {
          role: "agent",
          content: `Error: ${errorMsg}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, userAddress]
  );

  /**
   * Clear conversation history
   */
  const clearHistory = useCallback(async () => {
    if (!sessionId) return;

    try {
      await agentClient.clearHistory(sessionId);
      setMessages([]);
      setPendingTransaction(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to clear history");
    }
  }, [sessionId]);

  /**
   * Clear pending transaction
   */
  const clearPendingTransaction = useCallback(() => {
    setPendingTransaction(null);
  }, []);

  /**
   * Reset session (new session ID)
   */
  const resetSession = useCallback(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    saveSessionId(newSessionId);
    setMessages([]);
    setPendingTransaction(null);
    setError(null);
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    error,
    pendingTransaction,
    sendMessage,
    clearHistory,
    clearPendingTransaction,
    resetSession,
  };
}
