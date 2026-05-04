"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { Loader2, Send, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useConfig } from "wagmi";
import { isValidWalletAddress } from "@/lib/utils";
import { BLOCK_EXPLORER_URL } from "@/lib/constants";
import { executePluginFunction } from "@/plugins/client-executor";

export default function Home() {
  const [messages, setMessages] = useState<
    { id: string; role: string; content: React.ReactNode }[]
  >([
    {
      id: crypto.randomUUID(),
      role: "agent",
      content:
        "Hello! I can help you interact with the Rootstock testnet. What would you like to do?",
    },
  ]);

  const { address, isConnected } = useAppKitAccount();
  const config = useConfig();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{
    functionName: string;
    args: Record<string, unknown>;
  } | null>(null);

  const isSendDisabled = useMemo(
    () => isLoading || !!pendingTransfer || !input.trim(),
    [isLoading, pendingTransfer, input]
  );

  function safeJsonString(value: unknown, maxLen: number): string {
    try {
      const s = JSON.stringify(value, null, 2) ?? "";
      return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
    } catch {
      return "";
    }
  }

  function validateAddressArgsOrThrow(
    functionName: string,
    args: Record<string, unknown> | undefined
  ): void {
    if (!args) return;

    const addressKeys = new Set([
      "address",
      "to",
      "from",
      "recipient",
      "receiver",
      "spender",
      "owner",
      "wallet",
      "walletAddress",
    ]);

    for (const [key, value] of Object.entries(args)) {
      const looksLikeAddressKey = addressKeys.has(key) || key.toLowerCase().endsWith("address");
      if (!looksLikeAddressKey) continue;
      if (typeof value !== "string" || !isValidWalletAddress(value)) {
        throw new Error(`Invalid wallet address for ${functionName}`);
      }
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { id: crypto.randomUUID(), role: "user", content: input };
    setInput("");
    setIsLoading(true);

    const processingMessage = {
      id: crypto.randomUUID(),
      role: "bot" as const,
      content: "Processing your request...",
    };

    const newMessages = [...messages, userMessage, processingMessage];

    if (!isConnected) {
      setMessages([
        ...newMessages.slice(0, -1),
        {
          id: crypto.randomUUID(),
          role: "bot",
          content: "Please connect your wallet to perform this action.",
        },
      ]);
      setIsLoading(false);
      return;
    }

    setMessages(newMessages);

    try {
      // Build history from the messages we are actually showing (minus the temporary processing bubble).
      const historySource = [...messages, userMessage];
      const messageHistory = historySource.map((msg) => ({
        role: msg.role === "bot" || msg.role === "agent" ? "assistant" : "user",
        content: typeof msg.content === "string" ? msg.content : "",
      }));

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          question: userMessage.content,
          address,
          messageHistory: messageHistory,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const data = await response.json();

      if (data?.functionCall) {
        const functionData = data.functionCall;

        try {
          const pluginContext = {
            address,
            isConnected,
            config,
          };

          const args = functionData.arguments as Record<string, unknown> | undefined;
          validateAddressArgsOrThrow(functionData.name, args);

          if (functionData.name === "transfer") {
            // Require explicit user confirmation before executing transfers.
            setPendingTransfer({
              functionName: functionData.name,
              args: (functionData.arguments || {}) as Record<string, unknown>,
            });
            // Avoid overwriting chat state if anything changes while confirmation is pending.
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== processingMessage.id),
              {
                id: crypto.randomUUID(),
                role: "bot",
                content: "Transfer requested. Please confirm to proceed.",
              },
            ]);
            setIsLoading(false);
            return;
          }

          const result = await executePluginFunction(
            functionData.name,
            functionData.arguments,
            pluginContext
          );

          if (result.success) {
            let displayContent: React.ReactNode;

            if (result.display && result.display.kind !== "none") {
              if (result.display.kind === "tx") {
                const txHash = result.display.transactionHash;
                const explorerUrl =
                  result.display.explorerUrl || `${BLOCK_EXPLORER_URL}${txHash}`;
                displayContent = (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    Transaction: {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
                    <ExternalLink size={16} />
                  </a>
                );
              } else if (result.display.kind === "balance") {
                displayContent = (
                  <div className="w-full">
                    <div className="mt-2">
                      Balance: {String(result.display.displayValue)} {result.display.symbol}
                    </div>
                  </div>
                );
              } else if (result.display.kind === "markdown") {
                displayContent = (
                  <div className="markdown-content space-y-4">
                    <ReactMarkdown>{result.display.markdown}</ReactMarkdown>
                  </div>
                );
              } else {
                displayContent = (
                  <div className="markdown-content space-y-4">
                    <ReactMarkdown>Operation completed successfully.</ReactMarkdown>
                  </div>
                );
              }
            } else if (result.data !== undefined) {
              // Treat plugin-provided data as untrusted: render only as a capped JSON blob.
              displayContent = (
                <pre className="text-xs overflow-auto rounded-md border p-3 bg-muted">
                  <code>{safeJsonString(result.data, 20_000)}</code>
                </pre>
              );
            } else {
              displayContent = (
                <div className="markdown-content space-y-4">
                  <ReactMarkdown>Operation completed successfully.</ReactMarkdown>
                </div>
              );
            }

            setMessages([
              ...newMessages.slice(0, -1),
              {
                id: crypto.randomUUID(),
                role: "bot",
                content: displayContent,
              },
            ]);
          } else {
            throw new Error(result.error || "Plugin execution failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to execute function";
          setMessages([
            ...newMessages.slice(0, -1),
            {
              id: crypto.randomUUID(),
              role: "bot",
              content: (
                <div className="text-red-500">
                  Error: {errorMessage}
                </div>
              ),
            },
          ]);
        }
      } else {
        setMessages([
          ...newMessages.slice(0, -1),
          {
            id: crypto.randomUUID(),
            role: "bot",
            content: (
              <div className="markdown-content space-y-4">
                <ReactMarkdown>
                  {data.analysis || "No information available for this query."}
                </ReactMarkdown>
              </div>
            ),
          },
        ]);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Operation failed";
      setMessages([
        ...newMessages.slice(0, -1),
        {
          id: crypto.randomUUID(),
          role: "bot",
          content: `Error: ${errMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between app-background">
      <div className="w-full max-w-4xl grow flex flex-col items-center justify-around gap-6 px-4">
        <Image
          src={"/img/rsk.png"}
          alt="Rootstock Logo"
          width={300}
          height={100}
          priority
        />
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rootstock AI Agent</CardTitle>
            <ConnectButton />
          </CardHeader>
          <CardContent>
            <div
              className="space-y-4 mb-4 h-[400px] overflow-y-auto p-2 border rounded-md"
              ref={containerRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map(({ id, role, content }) => (
                <div
                  key={id}
                  className={`flex ${role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                      }`}
                  >
                    <div className="whitespace-pre-wrap">{content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ask about Rootstock or perform actions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
                aria-label="Message input"
              />
              <Button onClick={handleSend} disabled={isSendDisabled} aria-label="Send message" aria-busy={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {pendingTransfer && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingTransfer(null)}
                  aria-label="Cancel transfer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!pendingTransfer) return;
                    setIsLoading(true);
                    try {
                      const pluginContext = { address, isConnected, config };
                      const result = await executePluginFunction(
                        pendingTransfer.functionName,
                        pendingTransfer.args,
                        pluginContext
                      );
                      if (!result.success) throw new Error(result.error || "Transfer failed");

                      const dataObj = (result.data ?? {}) as Record<string, unknown>;
                      const txHash =
                        (typeof dataObj["transactionHash"] === "string" ? (dataObj["transactionHash"] as string) : "") ||
                        (result.display?.kind === "tx" ? result.display.transactionHash : "");
                      const explorerUrl =
                        (typeof dataObj["explorerUrl"] === "string" ? (dataObj["explorerUrl"] as string) : undefined) ||
                        (result.display?.kind === "tx" ? result.display.explorerUrl : undefined);

                      setMessages((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          role: "bot",
                          content: (
                            <a
                              href={explorerUrl || `${BLOCK_EXPLORER_URL}${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                            >
                              Transaction: {`${String(txHash).slice(0, 6)}...${String(txHash).slice(-4)}`}
                              <ExternalLink size={16} />
                            </a>
                          ),
                        },
                      ]);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Transfer failed";
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          role: "bot",
                          content: <div className="text-red-500">Error: {msg}</div>,
                        },
                      ]);
                    } finally {
                      setPendingTransfer(null);
                      setIsLoading(false);
                    }
                  }}
                  aria-label="Confirm transfer"
                >
                  Confirm transfer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
