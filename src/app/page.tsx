"use client";

// TypeScript declaration for window.ethereum (MetaMask)
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

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
import { useConfig, useAccount, useChainId, useSwitchChain, useConnections } from "wagmi";
import {
  getBalance,
  getChainId,
  readContract,
  sendTransaction,
  writeContract,
} from "@wagmi/core";
import { checksumAddress, erc20Abi, isAddress, parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { findToken, isValidWalletAddress } from "@/lib/utils";
import { BLOCK_EXPLORER_URL } from "@/lib/constants";
import { rootstockTestnet } from "@/config/chains";
import { fetchPortfolioData, type PortfolioData } from "@/lib/portfolio";
import { getContractAddress } from "@/lib/contracts";
import LendingPoolABI from "@/lib/abis/LendingPool.json";
import MockUSDT0ABI from "@/lib/abis/MockUSDT0.json";

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
  const { address: wagmiAddress, connector } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const { switchChain } = useSwitchChain();
  const connections = useConnections();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to get actual chain from MetaMask (not wagmi's cached state)
  const getMetaMaskChainId = async (): Promise<number> => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        return parseInt(chainIdHex as string, 16);
      } catch (e) {
        console.error("Failed to get chain from MetaMask:", e);
      }
    }
    return getChainId(config);
  };

  const ensureRootstockTestnet = async (): Promise<void> => {
    // Get the ACTUAL chain from MetaMask, not wagmi's cached state
    let actualChainId = await getMetaMaskChainId();
    console.log(`📍 Actual MetaMask chain ID: ${actualChainId}, Required: ${rootstockTestnet.id}`);
    
    if (actualChainId === rootstockTestnet.id) {
      console.log("✅ Already on Rootstock Testnet");
      return;
    }

    const networkName = actualChainId === 11155111 ? "Sepolia" : `Chain ${actualChainId}`;
    console.log(`🚨 MetaMask is on ${networkName} (${actualChainId}), switching to Rootstock Testnet...`);

    // Use window.ethereum directly to switch/add network
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // First, try to switch to Rootstock Testnet
        console.log("Requesting network switch via MetaMask...");
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${rootstockTestnet.id.toString(16)}` }], // 0x1f = 31
        });
        
        // Verify the switch worked
        await new Promise(resolve => setTimeout(resolve, 1000));
        actualChainId = await getMetaMaskChainId();
        
        if (actualChainId === rootstockTestnet.id) {
          console.log("✅ Successfully switched to Rootstock Testnet!");
          return;
        }
      } catch (switchError: any) {
        // Error 4902 means the chain is not added to MetaMask
        if (switchError.code === 4902) {
          console.log("Rootstock Testnet not found in MetaMask, adding it...");
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${rootstockTestnet.id.toString(16)}`, // 0x1f = 31
                chainName: rootstockTestnet.name,
                nativeCurrency: {
                  name: rootstockTestnet.nativeCurrency.name,
                  symbol: rootstockTestnet.nativeCurrency.symbol,
                  decimals: rootstockTestnet.nativeCurrency.decimals,
                },
                rpcUrls: rootstockTestnet.rpcUrls.default.http,
                blockExplorerUrls: [rootstockTestnet.blockExplorers.default.url],
              }],
            });
            
            // After adding, verify we're on the right chain
            await new Promise(resolve => setTimeout(resolve, 1000));
            actualChainId = await getMetaMaskChainId();
            
            if (actualChainId === rootstockTestnet.id) {
              console.log("✅ Added and switched to Rootstock Testnet!");
              return;
            }
          } catch (addError: any) {
            if (addError.code === 4001) {
              throw new Error(
                `🚨 You REJECTED adding Rootstock Testnet!\n\n` +
                `You must approve adding the network to send tRBTC.\n\n` +
                `Please try again and click "Approve" when MetaMask asks to add Rootstock Testnet.`
              );
            }
            throw new Error(
              `🚨 Failed to add Rootstock Testnet to MetaMask: ${addError.message}\n\n` +
              `Please add it manually:\n` +
              `• Network Name: ${rootstockTestnet.name}\n` +
              `• RPC URL: ${rootstockTestnet.rpcUrls.default.http[0]}\n` +
              `• Chain ID: ${rootstockTestnet.id}\n` +
              `• Currency Symbol: ${rootstockTestnet.nativeCurrency.symbol}`
            );
          }
        } else if (switchError.code === 4001) {
          throw new Error(
            `🚨 You REJECTED switching to Rootstock Testnet!\n\n` +
            `❌ CANNOT send tRBTC while on ${networkName}!\n\n` +
            `You MUST approve the network switch to send tRBTC.\n` +
            `Please try again and click "Switch network" when prompted.`
          );
        } else {
          throw new Error(
            `🚨 Failed to switch network: ${switchError.message}\n\n` +
            `Please manually switch to Rootstock Testnet in MetaMask.`
          );
        }
      }
    }
    
    // Final check - if still wrong network, block the transaction
    actualChainId = await getMetaMaskChainId();
    if (actualChainId !== rootstockTestnet.id) {
      throw new Error(
        `🚨🚨🚨 STILL ON WRONG NETWORK! 🚨🚨🚨\n\n` +
        `MetaMask is on ${actualChainId === 11155111 ? "Sepolia" : `Chain ${actualChainId}`} (ID: ${actualChainId})\n\n` +
        `❌ Transaction will show "Sepolia ETH" instead of "tRBTC" on wrong network!\n\n` +
        `MANUAL FIX REQUIRED:\n` +
        `1. Open MetaMask extension\n` +
        `2. Click the network dropdown at the TOP of MetaMask\n` +
        `3. Select "Rootstock Testnet"\n` +
        `4. If not listed, click "Add Network" and enter:\n` +
        `   • Network Name: Rootstock Testnet\n` +
        `   • RPC URL: ${rootstockTestnet.rpcUrls.default.http[0]}\n` +
        `   • Chain ID: ${rootstockTestnet.id}\n` +
        `   • Currency Symbol: tRBTC\n` +
        `5. Then try sending again`
      );
    }
  };

  const handleTransfer = async (data: {
    token1: string;
    address: string;
    amount: number;
  }) => {
    console.log("Data:", data);
    try {
      // Ensure we're on Rootstock testnet before proceeding
      await ensureRootstockTestnet();

      const tokenAddress =
        data.token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(data.token1);

      if (!tokenAddress) throw new Error("Token not found");

      // Validate recipient address using viem's isAddress validator
      if (!data.address || !isAddress(data.address)) {
        throw new Error(
          `Invalid recipient address: "${data.address || 'undefined'}"\n\n` +
          `Please provide a valid Ethereum address starting with "0x" followed by 40 hexadecimal characters.`
        );
      }
      const validatedRecipient = checksumAddress(data.address as `0x${string}`);

      // ABSOLUTE FINAL CHECK - Get chain directly from MetaMask
      const finalChainId = await getMetaMaskChainId();
      console.log(`🔍 FINAL CHECK (from MetaMask): Chain ID ${finalChainId}, required: ${rootstockTestnet.id}`);
      
      if (finalChainId !== rootstockTestnet.id) {
        const currentNetwork = finalChainId === 11155111 ? "Sepolia" : `Chain ${finalChainId}`;
        console.error(`🚨 BLOCKING TRANSACTION: MetaMask is on ${currentNetwork}, need Rootstock Testnet`);
        throw new Error(
          `🚨🚨🚨 TRANSACTION BLOCKED 🚨🚨🚨\n\n` +
          `MetaMask is STILL on ${currentNetwork} (Chain ID: ${finalChainId})\n\n` +
          `❌ This is why you see "Sepolia ETH" instead of "tRBTC"!\n\n` +
          `The transaction REQUIRES Rootstock Testnet (Chain ID: ${rootstockTestnet.id})\n\n` +
          `FIX:\n` +
          `1. Open MetaMask\n` +
          `2. Click network dropdown at TOP\n` +
          `3. Switch to "Rootstock Testnet"\n` +
          `4. Then try again`
        );
      }
      
      console.log(`✅ MetaMask confirmed on Rootstock Testnet (${finalChainId}), sending transaction...`);

      let transactionHash: string;
      if (tokenAddress === "trbtc") {
        // Get the account from wagmi
        const account = wagmiAddress || address;
        if (!account) {
          throw new Error("No account connected");
        }
        
        transactionHash = await sendTransaction(config, {
          account: account as `0x${string}`,
          to: validatedRecipient,
          value: parseEther(data.amount.toString()),
        });
      } else {
        // Validate token contract address
        if (!isAddress(tokenAddress)) {
          throw new Error(`Invalid token contract address: "${tokenAddress}"`);
        }
        const validatedTokenAddress = checksumAddress(tokenAddress as `0x${string}`);
        
        transactionHash = await writeContract(config, {
          abi: erc20Abi,
          address: validatedTokenAddress,
          functionName: "transfer",
          args: [validatedRecipient, BigInt(data.amount)],
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
      // Ensure we're on Rootstock testnet before checking balance
      await ensureRootstockTestnet();

      // Handle null/undefined data - default to empty object
      const safeData = data || {};

      // Default to tRBTC if no token specified
      const tokenSymbol = safeData.token1?.toLowerCase() || "trbtc";
      
      const tokenAdd =
        tokenSymbol === "trbtc"
          ? "trbtc"
          : await findToken(tokenSymbol);

      if (!tokenAdd && tokenSymbol !== "trbtc") {
        throw new Error(`Token "${safeData.token1 || tokenSymbol}" not found`);
      }

      // Use provided address or default to user's address
      const acc = (safeData.address && isAddress(safeData.address)) ? safeData.address : address;
      
      if (!acc) {
        throw new Error("No address provided and wallet not connected");
      }

      let balance;

      if (tokenAdd === "trbtc") {
        const queryBalance = await getBalance(config, {
          address: acc,
        });

        balance = {
          displayValue: formatEther(queryBalance.value),
          symbol: "tRBTC",
        };
      } else {
        // Validate and checksum the token address
        if (!isAddress(tokenAdd)) {
          throw new Error(`Invalid token address: "${tokenAdd}"`);
        }
        const validatedTokenAddress = checksumAddress(tokenAdd as `0x${string}`);
        
        // Fetch token decimals for proper formatting (production best practice)
        const tokenDecimals = await readContract(config, {
          abi: erc20Abi,
          address: validatedTokenAddress,
          functionName: "decimals",
        }) as number;
        
        const queryBalance = await readContract(config, {
          abi: erc20Abi,
          address: validatedTokenAddress,
          functionName: "balanceOf",
          args: [acc],
        }) as bigint;
        
        balance = {
          displayValue: formatUnits(queryBalance, tokenDecimals),
          symbol: tokenSymbol.toUpperCase(),
        };
      }

      return balance;
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      throw error;
    }
  };

  const handlePortfolio = async () => {
    try {
      // Ensure we're on Rootstock testnet
      await ensureRootstockTestnet();

      const account = wagmiAddress || address;
      if (!account) {
        throw new Error("No account connected");
      }

      const actualChainId = await getMetaMaskChainId();
      const portfolioData = await fetchPortfolioData(
        config,
        account as `0x${string}`,
        actualChainId
      );

      if (!portfolioData) {
        throw new Error("Failed to fetch portfolio data");
      }

      return portfolioData;
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
      throw error;
    }
  };

  const handleDeposit = async (data: { amount: number }) => {
    try {
      // Validate amount
      if (!data.amount || data.amount <= 0) {
        throw new Error("Deposit amount must be greater than 0");
      }

      if (data.amount > 1000000) {
        throw new Error("Deposit amount is too large. Maximum is 1,000,000 tRBTC");
      }

      // Ensure we're on Rootstock testnet
      await ensureRootstockTestnet();

      const account = wagmiAddress || address;
      if (!account) {
        throw new Error("No account connected");
      }

      // Verify we're on the correct network
      const actualChainId = await getMetaMaskChainId();
      if (actualChainId !== rootstockTestnet.id) {
        throw new Error("Must be on Rootstock Testnet to deposit collateral");
      }

      // Get contract address
      const lendingPoolAddress = getContractAddress(actualChainId, "LENDING_POOL");

      // Parse amount to wei (18 decimals)
      // Use toFixed to avoid scientific notation for very small numbers
      // tRBTC has 18 decimals, so we need to handle up to 18 decimal places
      const amountString = data.amount.toFixed(18).replace(/\.?0+$/, '');
      const amountWei = parseEther(amountString);

      console.log(`Depositing ${data.amount} tRBTC (${amountWei.toString()} wei) to LendingPool at ${lendingPoolAddress}`);

      // Call depositRBTC() - it's a payable function, so we send value with the transaction
      const transactionHash = await writeContract(config, {
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: "depositRBTC",
        args: [],
        value: amountWei,
        account: account as `0x${string}`,
      });

      console.log("Deposit transaction hash:", transactionHash);

      return transactionHash;
    } catch (error: any) {
      console.error("Deposit failed:", error);
      
      // Provide user-friendly error messages
      if (error?.message?.includes("insufficient funds") || error?.message?.includes("balance")) {
        throw new Error(`Insufficient tRBTC balance. You need at least ${data.amount} tRBTC to deposit.`);
      }
      
      if (error?.message?.includes("user rejected") || error?.code === 4001) {
        throw new Error("Deposit transaction was rejected. Please approve the transaction in MetaMask.");
      }

      if (error?.message?.includes("ZERO_DEPOSIT")) {
        throw new Error("Deposit amount must be greater than 0");
      }

      throw new Error(error?.message || `Deposit failed: ${error?.toString() || "Unknown error"}`);
    }
  };

  const handleWithdraw = async (data: { amount: number }) => {
    try {
      // Validate amount
      if (!data.amount || data.amount <= 0) {
        throw new Error("Withdrawal amount must be greater than 0");
      }

      // Ensure we're on Rootstock testnet
      await ensureRootstockTestnet();

      const account = wagmiAddress || address;
      if (!account) {
        throw new Error("No account connected");
      }

      // Verify we're on the correct network
      const actualChainId = await getMetaMaskChainId();
      if (actualChainId !== rootstockTestnet.id) {
        throw new Error("Must be on Rootstock Testnet to withdraw collateral");
      }

      // Get contract address
      const lendingPoolAddress = getContractAddress(actualChainId, "LENDING_POOL");

      // Parse amount to wei (18 decimals) - handle small numbers
      const amountString = data.amount.toFixed(18).replace(/\.?0+$/, '');
      const amountWei = parseEther(amountString);

      console.log(`Withdrawing ${data.amount} tRBTC (${amountWei.toString()} wei) from LendingPool`);

      // Call withdrawRBTC(uint256 amountWei)
      const transactionHash = await writeContract(config, {
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: "withdrawRBTC",
        args: [amountWei],
        account: account as `0x${string}`,
      });

      console.log("Withdraw transaction hash:", transactionHash);
      return transactionHash;
    } catch (error: any) {
      console.error("Withdraw failed:", error);
      
      if (error?.message?.includes("INSUFFICIENT_COLLATERAL_BAL") || error?.message?.includes("insufficient")) {
        throw new Error(`Insufficient collateral. You don't have enough tRBTC deposited to withdraw ${data.amount} tRBTC.`);
      }
      
      if (error?.message?.includes("HF_LT_1") || error?.message?.includes("health factor")) {
        throw new Error(`Cannot withdraw: This would make your health factor drop below 1.0. Reduce your debt or withdraw less collateral.`);
      }
      
      if (error?.message?.includes("user rejected") || error?.code === 4001) {
        throw new Error("Withdrawal transaction was rejected. Please approve the transaction in MetaMask.");
      }

      throw new Error(error?.message || `Withdrawal failed: ${error?.toString() || "Unknown error"}`);
    }
  };

  const handleBorrow = async (data: { amount: number }) => {
    try {
      // Validate amount
      if (!data.amount || data.amount <= 0) {
        throw new Error("Borrow amount must be greater than 0");
      }

      // Ensure we're on Rootstock testnet
      await ensureRootstockTestnet();

      const account = wagmiAddress || address;
      if (!account) {
        throw new Error("No account connected");
      }

      // Verify we're on the correct network
      const actualChainId = await getMetaMaskChainId();
      if (actualChainId !== rootstockTestnet.id) {
        throw new Error("Must be on Rootstock Testnet to borrow");
      }

      // Get contract addresses
      const lendingPoolAddress = getContractAddress(actualChainId, "LENDING_POOL");

      // Pre-check: Fetch portfolio to validate max borrowable
      const portfolioData = await fetchPortfolioData(
        config,
        account as `0x${string}`,
        actualChainId
      );

      if (!portfolioData || !portfolioData.hasPosition) {
        throw new Error("You need to deposit collateral first before you can borrow.");
      }

      // USDT0 has 6 decimals, parse amount accordingly
      const amountString = data.amount.toFixed(6).replace(/\.?0+$/, '');
      const amountUSDT0 = parseUnits(amountString, 6);

      // Calculate USD value of borrow amount (assuming USDT0 = $1, but we should check)
      // For now, we'll use the max borrowable USD value from portfolio
      const maxBorrowableUSD = parseFloat(portfolioData.maxBorrowableUSD);
      const borrowAmountUSD = data.amount; // Assuming USDT0 ≈ $1

      if (borrowAmountUSD > maxBorrowableUSD) {
        throw new Error(
          `Cannot borrow $${borrowAmountUSD.toFixed(6)} worth of USDT0. ` +
          `Your max borrowable is $${maxBorrowableUSD.toFixed(6)} based on your collateral. ` +
          `You have ${portfolioData.collateralRBTC} tRBTC collateral worth $${portfolioData.collateralUSD}. ` +
          `Try borrowing less or deposit more collateral.`
        );
      }

      console.log(`Borrowing ${data.amount} USDT0 (${amountUSDT0.toString()} smallest units) from LendingPool`);
      console.log(`Max borrowable: $${maxBorrowableUSD}, Requested: $${borrowAmountUSD}`);

      // Call borrowUSDT0(uint256 amount)
      const transactionHash = await writeContract(config, {
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: "borrowUSDT0",
        args: [amountUSDT0],
        account: account as `0x${string}`,
      });

      console.log("Borrow transaction hash:", transactionHash);
      return transactionHash;
    } catch (error: any) {
      console.error("Borrow failed:", error);
      
      // Don't wrap our custom error messages
      if (error?.message && (
        error.message.includes("Cannot borrow") ||
        error.message.includes("max borrowable") ||
        error.message.includes("need to deposit")
      )) {
        throw error;
      }
      
      if (error?.message?.includes("INSUFFICIENT_COLLATERAL") || error?.message?.includes("insufficient")) {
        throw new Error(
          `❌ Insufficient collateral! ` +
          `You tried to borrow ${data.amount} USDT0, but you don't have enough collateral. ` +
          `Check your portfolio to see your max borrowable amount. ` +
          `You may need to deposit more tRBTC collateral first.`
        );
      }
      
      if (error?.message?.includes("user rejected") || error?.code === 4001) {
        throw new Error("Borrow transaction was rejected. Please approve the transaction in MetaMask.");
      }

      throw new Error(error?.message || `Borrow failed: ${error?.toString() || "Unknown error"}`);
    }
  };

  const handleRepay = async (data: { amount: number }) => {
    try {
      // Validate amount
      if (!data.amount || data.amount <= 0) {
        throw new Error("Repay amount must be greater than 0");
      }

      // Ensure we're on Rootstock testnet
      await ensureRootstockTestnet();

      const account = wagmiAddress || address;
      if (!account) {
        throw new Error("No account connected");
      }

      // Verify we're on the correct network
      const actualChainId = await getMetaMaskChainId();
      if (actualChainId !== rootstockTestnet.id) {
        throw new Error("Must be on Rootstock Testnet to repay debt");
      }

      // Get contract addresses
      const lendingPoolAddress = getContractAddress(actualChainId, "LENDING_POOL");
      const usdt0Address = getContractAddress(actualChainId, "MOCK_USDT0");

      // USDT0 has 6 decimals, parse amount accordingly
      const amountString = data.amount.toFixed(6).replace(/\.?0+$/, '');
      const amountUSDT0 = parseUnits(amountString, 6);

      console.log(`Repaying ${data.amount} USDT0 (${amountUSDT0.toString()} smallest units) to LendingPool`);

      // First, check and approve if needed
      try {
        const currentAllowance = await readContract(config, {
          address: usdt0Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account as `0x${string}`, lendingPoolAddress],
        });

        if (currentAllowance < amountUSDT0) {
          console.log("Approving USDT0 spending...");
          // Approve the lending pool to spend USDT0
          const approveHash = await writeContract(config, {
            address: usdt0Address,
            abi: erc20Abi,
            functionName: "approve",
            args: [lendingPoolAddress, amountUSDT0],
            account: account as `0x${string}`,
          });
          console.log("Approve transaction hash:", approveHash);
          
          // Wait a bit for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (approveError) {
        console.error("Approval check/action failed:", approveError);
        // Continue anyway - maybe already approved
      }

      // Call repayUSDT0(uint256 amount)
      const transactionHash = await writeContract(config, {
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: "repayUSDT0",
        args: [amountUSDT0],
        account: account as `0x${string}`,
      });

      console.log("Repay transaction hash:", transactionHash);
      return transactionHash;
    } catch (error: any) {
      console.error("Repay failed:", error);
      
      if (error?.message?.includes("NO_DEBT") || error?.message?.includes("no debt")) {
        throw new Error("You don't have any debt to repay.");
      }
      
      if (error?.message?.includes("insufficient allowance") || error?.message?.includes("allowance")) {
        throw new Error("Insufficient USDT0 allowance. Please approve the LendingPool to spend your USDT0 first.");
      }
      
      if (error?.message?.includes("insufficient balance") || error?.message?.includes("balance")) {
        throw new Error(`Insufficient USDT0 balance. You need at least ${data.amount} USDT0 to repay.`);
      }
      
      if (error?.message?.includes("user rejected") || error?.code === 4001) {
        throw new Error("Repay transaction was rejected. Please approve the transaction in MetaMask.");
      }

      throw new Error(error?.message || `Repay failed: ${error?.toString() || "Unknown error"}`);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setInput("");
    setIsLoading(true);

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
      setIsLoading(false);
      return;
    }

    setMessages(newMessages);

    try {
      // Fetch portfolio data if wallet is connected
      let portfolioData: PortfolioData | null = null;
      let portfolioAlert: string | null = null;
      
      if (isConnected && address) {
        try {
          const actualChainId = await getMetaMaskChainId();
          if (actualChainId === rootstockTestnet.id) {
            portfolioData = await fetchPortfolioData(
              config,
              address as `0x${string}`,
              actualChainId
            );
            
            // Generate proactive alerts based on portfolio health, collateral ratios, and repayment suggestions
            if (portfolioData && portfolioData.hasPosition) {
              const collUSD = parseFloat(portfolioData.collateralUSD);
              const debtUSD = parseFloat(portfolioData.debtUSD);
              const ltvRatio = portfolioData.ltvRatio;
              
              // Critical: Health factor below 1.0 (liquidation risk)
              if (!portfolioData.isHealthy) {
                const repaySuggestion = debtUSD > 0 
                  ? ` Consider repaying at least $${(debtUSD - collUSD * 0.7).toFixed(2)} to restore safety.`
                  : "";
                portfolioAlert = `🚨 CRITICAL: Your health factor is below 1.0! Your position is at risk of liquidation. Your LTV ratio is ${ltvRatio.toFixed(1)}% (max safe: 70%).${repaySuggestion} Consider adding collateral or repaying debt immediately.`;
              } 
              // Warning: Health factor below 1.5 (approaching risk)
              else if (portfolioData.isAtRisk) {
                const repaySuggestion = debtUSD > 0 && ltvRatio > 50
                  ? ` Your LTV ratio is ${ltvRatio.toFixed(1)}% - consider repaying $${(debtUSD * 0.2).toFixed(2)} to improve your position.`
                  : "";
                portfolioAlert = `⚠️ WARNING: Your health factor is below 1.5. Your position is approaching risk levels.${repaySuggestion} Consider adding more collateral or reducing debt.`;
              }
              // Info: High LTV ratio (above 50% but still safe)
              else if (ltvRatio > 50 && ltvRatio < 70) {
                portfolioAlert = `💡 INFO: Your collateral ratio (LTV: ${ltvRatio.toFixed(1)}%) is getting high. Consider repaying some debt to improve your safety margin. You're currently using ${ltvRatio.toFixed(1)}% of your ${70}% max borrowing capacity.`;
              }
              // Repayment suggestion: If debt exists and position is healthy
              else if (debtUSD > 0 && portfolioData.isHealthy && ltvRatio < 50) {
                portfolioAlert = `✅ Your position is healthy (LTV: ${ltvRatio.toFixed(1)}%). You can repay debt anytime to improve your health factor or free up borrowing capacity.`;
              }
            }
          }
        } catch (error) {
          console.log("Could not fetch portfolio data:", error);
          // Continue without portfolio data
        }
      }

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
          data: portfolioData, // Send portfolio data to AI
          portfolioAlert: portfolioAlert, // Send any proactive alerts
          question: input,
          address: address || "",
          messageHistory: messageHistory,
        }),
      });

      const data = await response.json();

      console.log("AI response:", data);

      // Check for errors
      if (data.error) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error;
        throw new Error(errorMsg);
      }

      if (data?.functionCall) {
        const functionData = data.functionCall;

        switch (functionData.name) {
          case "transfer":
            if (!isValidWalletAddress(functionData?.arguments?.address)) {
              throw new Error("Invalid wallet address");
            }
            
            // Check if we need to switch networks and inform the user
            const currentChain = getChainId(config);
            if (currentChain !== rootstockTestnet.id) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: `⚠️ Switching to Rootstock Testnet... Please approve the network switch prompt in MetaMask to send tRBTC (not Sepolia ETH).`,
                },
              ]);
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

          case "portfolio":
            const portfolio = await handlePortfolio();
            
            // Generate proactive alert based on portfolio health
            const generateProactiveAlert = (p: PortfolioData): { text: string; type: 'critical' | 'warning' | 'info' | 'success' } | null => {
              if (!p.hasPosition) return null;
              
              const collUSD = parseFloat(p.collateralUSD);
              const debtUSD = parseFloat(p.debtUSD);
              const ltvRatio = p.ltvRatio;
              
              if (!p.isHealthy) {
                const repayAmount = debtUSD - collUSD * 0.7;
                return {
                  text: `🚨 CRITICAL: Your health factor is below 1.0! Your position is at risk of liquidation. LTV: ${ltvRatio.toFixed(1)}% (max safe: 70%). Consider repaying at least $${repayAmount > 0 ? repayAmount.toFixed(4) : '0'} or adding more collateral immediately.`,
                  type: 'critical'
                };
              } else if (p.isAtRisk) {
                const repayAmount = debtUSD * 0.2;
                return {
                  text: `⚠️ WARNING: Your health factor is below 1.5. LTV: ${ltvRatio.toFixed(1)}%. Consider repaying $${repayAmount.toFixed(4)} to improve your position.`,
                  type: 'warning'
                };
              } else if (ltvRatio > 50 && ltvRatio < 70) {
                return {
                  text: `💡 INFO: Your LTV ratio (${ltvRatio.toFixed(1)}%) is getting high. You're using ${ltvRatio.toFixed(1)}% of your 70% max borrowing capacity. Consider repaying some debt.`,
                  type: 'info'
                };
              } else if (debtUSD > 0) {
                return {
                  text: `✅ Your position is healthy! LTV: ${ltvRatio.toFixed(1)}%. Collateralization: ${p.collateralizationRatio.toFixed(0)}%. You can repay debt anytime to free up borrowing capacity.`,
                  type: 'success'
                };
              }
              return null;
            };
            
            const proactiveAlert = generateProactiveAlert(portfolio);
            
            // Show helpful message if portfolio is empty
            if (!portfolio.hasPosition) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: (
                    <div className="w-full space-y-3">
                      <div className="font-semibold text-lg mb-3">📊 Your Portfolio</div>
                      
                      <div className="bg-muted/50 p-4 rounded-lg border-2 border-dashed">
                        <div className="text-center space-y-2">
                          <div className="text-2xl mb-2">📭</div>
                          <div className="font-semibold">No Active Position</div>
                          <div className="text-sm text-muted-foreground">
                            You don't have any collateral deposited or debt yet.
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Collateral (tRBTC)</div>
                          <div className="text-lg font-semibold">0</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Debt (USDT0)</div>
                          <div className="text-lg font-semibold">0</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Collateral Value (USD)</div>
                          <div className="text-lg font-semibold">$0</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Debt Value (USD)</div>
                          <div className="text-lg font-semibold">$0</div>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Max Borrowable:</span>
                          <span className="font-semibold">$0</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Health Factor:</span>
                          <span className="font-semibold text-green-500">∞ (No Debt)</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="text-sm font-semibold mb-1">💡 Get Started:</div>
                        <div className="text-xs text-muted-foreground">
                          To start using the lending pool, deposit tRBTC as collateral. Once you have collateral, you can borrow USDT0 against it. Ask me to "deposit tRBTC" when ready!
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]);
            } else {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: (
                    <div className="w-full space-y-2">
                      <div className="font-semibold text-lg mb-3">📊 Your Portfolio</div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Collateral (tRBTC)</div>
                          <div className="text-lg font-semibold">{portfolio.collateralRBTC}</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Debt (USDT0)</div>
                          <div className="text-lg font-semibold">{portfolio.debtUSDT0}</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Collateral Value (USD)</div>
                          <div className="text-lg font-semibold">${portfolio.collateralUSD}</div>
                        </div>
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Debt Value (USD)</div>
                          <div className="text-lg font-semibold">${portfolio.debtUSD}</div>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Max Borrowable:</span>
                          <span className="font-semibold">${portfolio.maxBorrowableUSD}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Health Factor:</span>
                          <span className={`font-semibold ${
                            portfolio.healthFactor >= 999999 
                              ? "text-green-500" 
                              : portfolio.isHealthy 
                                ? portfolio.isAtRisk 
                                  ? "text-yellow-500" 
                                  : "text-green-500"
                                : "text-red-500"
                          }`}>
                            {portfolio.healthFactor >= 999999 
                              ? "∞ (No Debt)" 
                              : portfolio.healthFactor.toFixed(2)}
                          </span>
                        </div>
                        
                        {/* LTV Ratio Display */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm">LTV Ratio:</span>
                          <span className={`font-semibold ${
                            portfolio.ltvRatio > 70 
                              ? "text-red-500" 
                              : portfolio.ltvRatio > 50 
                                ? "text-yellow-500" 
                                : "text-green-500"
                          }`}>
                            {portfolio.ltvRatio.toFixed(2)}%
                          </span>
                        </div>
                        
                        {/* Proactive Alert Box */}
                        {proactiveAlert && (
                          <div className={`mt-3 p-3 rounded-lg border text-sm ${
                            proactiveAlert.type === 'critical' 
                              ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400" 
                              : proactiveAlert.type === 'warning'
                                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
                                : proactiveAlert.type === 'info'
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
                                  : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                          }`}>
                            <div className="font-semibold mb-1">
                              {proactiveAlert.type === 'critical' ? '🚨 Proactive Alert' : 
                               proactiveAlert.type === 'warning' ? '⚠️ Proactive Alert' :
                               proactiveAlert.type === 'info' ? '💡 Proactive Alert' : '✅ Position Status'}
                            </div>
                            <div className="text-xs">{proactiveAlert.text}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
              ]);
            }
            break;

          case "deposit":
            if (!functionData?.arguments?.amount) {
              throw new Error("Deposit amount is required");
            }

            // Check if we need to switch networks and inform the user
            const currentChainForDeposit = await getMetaMaskChainId();
            if (currentChainForDeposit !== rootstockTestnet.id) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: `⚠️ Switching to Rootstock Testnet... Please approve the network switch prompt in MetaMask to deposit tRBTC collateral.`,
                },
              ]);
            }

            const depositHash = await handleDeposit(functionData.arguments);
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="w-full space-y-2">
                    <div className="text-green-600 dark:text-green-400 font-semibold">
                      ✅ Deposit Successful!
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Deposited {functionData.arguments.amount} tRBTC as collateral
                    </div>
                    <a
                      href={`${BLOCK_EXPLORER_URL}${depositHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm"
                    >
                      View Transaction:{" "}
                      {`${depositHash.slice(0, 6)}...${depositHash.slice(-4)}`}
                      <ExternalLink size={14} />
                    </a>
                    <div className="text-xs text-muted-foreground mt-2">
                      💡 You can now borrow USDT0 against your collateral or check your updated portfolio.
                    </div>
                  </div>
                ),
              },
            ]);
            break;

          case "withdraw":
            if (!functionData?.arguments?.amount) {
              throw new Error("Withdrawal amount is required");
            }

            const currentChainForWithdraw = await getMetaMaskChainId();
            if (currentChainForWithdraw !== rootstockTestnet.id) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: `⚠️ Switching to Rootstock Testnet... Please approve the network switch prompt in MetaMask to withdraw tRBTC collateral.`,
                },
              ]);
            }

            const withdrawHash = await handleWithdraw(functionData.arguments);
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="w-full space-y-2">
                    <div className="text-green-600 dark:text-green-400 font-semibold">
                      ✅ Withdrawal Successful!
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Withdrew {functionData.arguments.amount} tRBTC from collateral
                    </div>
                    <a
                      href={`${BLOCK_EXPLORER_URL}${withdrawHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm"
                    >
                      View Transaction:{" "}
                      {`${withdrawHash.slice(0, 6)}...${withdrawHash.slice(-4)}`}
                      <ExternalLink size={14} />
                    </a>
                    <div className="text-xs text-muted-foreground mt-2">
                      💡 Check your updated portfolio to see your new collateral balance.
                    </div>
                  </div>
                ),
              },
            ]);
            break;

          case "borrow":
            if (!functionData?.arguments?.amount) {
              throw new Error("Borrow amount is required");
            }

            const currentChainForBorrow = await getMetaMaskChainId();
            if (currentChainForBorrow !== rootstockTestnet.id) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: `⚠️ Switching to Rootstock Testnet... Please approve the network switch prompt in MetaMask to borrow USDT0.`,
                },
              ]);
            }

            const borrowHash = await handleBorrow(functionData.arguments);
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="w-full space-y-2">
                    <div className="text-green-600 dark:text-green-400 font-semibold">
                      ✅ Borrow Successful!
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Borrowed {functionData.arguments.amount} USDT0 against your collateral
                    </div>
                    <a
                      href={`${BLOCK_EXPLORER_URL}${borrowHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm"
                    >
                      View Transaction:{" "}
                      {`${borrowHash.slice(0, 6)}...${borrowHash.slice(-4)}`}
                      <ExternalLink size={14} />
                    </a>
                    <div className="text-xs text-muted-foreground mt-2">
                      ⚠️ You now have debt. Monitor your health factor and repay when ready.
                    </div>
                  </div>
                ),
              },
            ]);
            break;

          case "repay":
            if (!functionData?.arguments?.amount) {
              throw new Error("Repay amount is required");
            }

            const currentChainForRepay = await getMetaMaskChainId();
            if (currentChainForRepay !== rootstockTestnet.id) {
              setMessages([
                ...newMessages.slice(0, -1),
                {
                  role: "bot",
                  content: `⚠️ Switching to Rootstock Testnet... Please approve the network switch prompt in MetaMask to repay USDT0 debt.`,
                },
              ]);
            }

            const repayHash = await handleRepay(functionData.arguments);
            setMessages([
              ...newMessages.slice(0, -1),
              {
                role: "bot",
                content: (
                  <div className="w-full space-y-2">
                    <div className="text-green-600 dark:text-green-400 font-semibold">
                      ✅ Repayment Successful!
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Repaid {functionData.arguments.amount} USDT0 debt
                    </div>
                    <a
                      href={`${BLOCK_EXPLORER_URL}${repayHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm"
                    >
                      View Transaction:{" "}
                      {`${repayHash.slice(0, 6)}...${repayHash.slice(-4)}`}
                      <ExternalLink size={14} />
                    </a>
                    <div className="text-xs text-muted-foreground mt-2">
                      ✅ Your health factor has improved! Check your updated portfolio.
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
    } catch (error: any) {
      const errorMessage = error?.message || 
                          (error?.response?.data?.error || error?.response?.data?.details) ||
                          "Operation failed";
      
      setMessages([
        ...newMessages.slice(0, -1),
        {
          role: "bot",
          content: `Error: ${errorMessage}`,
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
    <main
      style={{
        backgroundImage: "url(/img/bg.png)",
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
