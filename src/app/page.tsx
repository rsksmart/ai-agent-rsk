"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { Loader2, Send, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useConfig } from "wagmi";
import {
  getBalance,
  readContract,
  sendTransaction,
  writeContract,
} from "@wagmi/core";
import { checksumAddress, erc20Abi, isAddress, parseEther } from "viem";
import { findToken, isValidWalletAddress } from "@/lib/utils";
import { BLOCK_EXPLORER_URL } from "@/lib/contants";

export default function Home() {
  const [messages, setMessages] = useState<
    { role: string; content: React.ReactNode }[]
  >([
    {
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

  const handleTransfer = async (data: {
    token1: string;
    address: string;
    amount: number;
  }) => {
    console.log("Data:", data);
    try {
      const tokenAddress =
        data.token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(data.token1);

      if (!tokenAddress) throw new Error("Token not found");

      let transactionHash: string;
      if (tokenAddress === "trbtc") {
        transactionHash = await sendTransaction(config, {
          to: data.address as `0x${string}`,
          value: parseEther(data.amount.toString()),
        });
      } else {
        transactionHash = await writeContract(config, {
          abi: erc20Abi,
          address: tokenAddress as `0x${string}`,
          functionName: "transfer",
          args: [data.address as `0x${string}`, BigInt(data.amount)],
        });
      }

      return transactionHash;
    } catch (error) {
      console.error("Transfer failed:", error);
      throw error;
    }
  };

  const handleBalance = async (data: any) => {
    try {
      const tokenAdd =
        data.token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(data.token1);

      if (!tokenAdd && data.token1.toLowerCase() !== "trbtc") {
        throw new Error("Token not found");
      }

      const acc = isAddress(data.address) ? data.address : address;

      let balance;

      if (tokenAdd === "trbtc") {
        const queryBalance = await getBalance(config, {
          address: acc,
        });

        balance = {
          displayValue: Number(queryBalance.value) / 10e18,
          symbol: "tRBTC",
        };
      } else {
        const queryBalance = await readContract(config, {
          abi: erc20Abi,
          address: checksumAddress(tokenAdd as `0x${string}`) as `0x${string}`,
          functionName: "balanceOf",
          args: [acc],
        });
        balance = {
          displayValue: Number(queryBalance) / 10e18,

          symbol: data.token1,
        };
      }

      return balance;
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setInput("");

    const processingMessage = {
      role: "bot" as const,
      content: "Processing your request...",
    };

    const newMessages = [...messages, userMessage, processingMessage];

    if (!isConnected) {
      setMessages([
        ...newMessages.slice(0, -1),
        {
          role: "bot",
          content: "Please connect your wallet to perform this action.",
        },
      ]);
      return;
    }

    setMessages(newMessages);

    try {
      // Extract text-only message history for API
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : "Content not available as string",
      }));

      // Process all requests through the AI endpoint
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          question: input,
          address,
          messageHistory: messageHistory,
        }),
      });

      const data = await response.json();

      console.log("AI response:", data);

      if (data?.functionCall) {
        const functionData = data.functionCall;

        switch (functionData.name) {
          case "transfer":
            if (!isValidWalletAddress(functionData?.arguments?.address)) {
              throw new Error("Invalid wallet address");
            }
            const transactionHash = await handleTransfer(
              functionData.arguments
            );
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <a
                    href={`${BLOCK_EXPLORER_URL}${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    Transaction:{" "}
                    {`${transactionHash.slice(0, 6)}...${transactionHash.slice(
                      -4
                    )}`}
                    <ExternalLink size={16} />
                  </a>
                ),
              },
            ]);
            break;

          case "balance":
            const balance = await handleBalance(functionData.arguments);
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="w-full">
                    <div className="mt-2">
                      Balance: {balance.displayValue} {balance.symbol}
                    </div>
                  </div>
                ),
              },
            ]);
            break;

          default:
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="markdown-content space-y-4">
                    <ReactMarkdown>
                      {data.analysis ||
                        "No information available for this query."}
                    </ReactMarkdown>
                  </div>
                ),
              },
            ]);
        }
      } else {
        // Regular AI response (strategy or information)
        setMessages([
          ...newMessages.slice(0, -1),
          {
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
      setMessages([
        ...newMessages.slice(0, -1),
        {
          role: "bot",
          content: `Error: ${
            error instanceof Error ? error.message : "Operation failed"
          }`,
        },
      ]);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main
      style={{
        backgroundImage: "url(/img/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      className="flex min-h-screen flex-col items-center justify-between"
    >
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
            >
              {messages.map(({ role, content }, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
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
              />
              <Button onClick={handleSend} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
