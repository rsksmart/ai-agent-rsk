## Updates from Original `ai-agent-rsk` Frontend

This folder is based on the official Rootstock **Conversational AI Agent on Rootstock Testnet** frontend and introduces additional DeFi lending and portfolio monitoring features. This document summarizes **what changed** compared to the original repository.

---

### 1. Core Features Added

- **DeFi Lending Integration**
  - Support for interacting with a LendingPool smart contract:
    - Deposit native tRBTC as collateral
    - Withdraw tRBTC collateral (with health factor checks)
    - Borrow USDT0 against collateral
    - Repay USDT0 debt

- **Portfolio Monitoring**
  - Fetches on-chain position data from `LendingPool.getAccountData`:
    - Collateral (tRBTC) and debt (USDT0)
    - Collateral and debt values in USD
    - Max borrowable USD
    - Health factor
  - Calculates:
    - **LTV ratio** (debt / collateral)
    - **Collateralization ratio** (collateral / debt)
  - Displays:
    - Color-coded health factor
    - Proactive alerts (critical, warning, info, success)

---

### 2. New Files

- `src/lib/portfolio.ts`
  - Wraps `LendingPool.getAccountData` and formats values for the UI
  - Computes health factor, LTV ratio, collateralization ratio
  - Provides a `PortfolioData` type for type-safe usage across the app

- `src/lib/contracts.ts`
  - Centralizes contract addresses per chain:
    - `LENDING_POOL`
    - `MOCK_USDT0`
    - `ORACLE`
  - Currently includes Rootstock Testnet (chain ID 31) and placeholders for mainnet

- `src/lib/abis/`
  - `LendingPool.json`
  - `MockUSDT0.json`
  - `UmbrellaOracleAdapter.json`
  - Used by Wagmi/Viem for contract interactions

---

### 3. Changes to Existing Files

#### `src/app/page.tsx`

- **Before**:
  - Basic chat UI
  - Supported:
    - Token transfers (`transfer`)
    - Balance checks (`balance`)
  - No concept of lending, collateral, or portfolio state

- **After**:
  - Enhanced chat UI with:
    - DeFi actions:
      - `deposit` tRBTC
      - `withdraw` tRBTC
      - `borrow` USDT0
      - `repay` USDT0
    - Portfolio view:
      - Shows collateral, debt, USD values, health factor, LTV
      - Empty state when user has no position
    - Proactive alerts based on portfolio health:
      - Critical (HF < 1.0)
      - Warning (HF < 1.5)
      - Info (LTV 50–70%)
      - Success (healthy with debt)
  - Stronger UX:
    - Detailed success messages with explorer links
    - Clear error messages for collateral, health factor, and allowances

#### `src/app/api/ai/route.ts`

- **Before**:
  - Groq LLM integration with:
    - `transfer` function
    - `balance` function
  - System prompt focused on token transfers and balance checks

- **After**:
  - Upgraded to Llama 3.3 70B model
  - Added new tools/functions:
    - `portfolio` – fetch and display LendingPool position
    - `deposit` – deposit tRBTC as collateral
    - `withdraw` – withdraw tRBTC collateral
    - `borrow` – borrow USDT0
    - `repay` – repay USDT0 debt
  - Enhanced system prompt:
    - Describes DeFi capabilities (portfolio, lending actions)
    - Defines when to call each function
    - Explains behavior for capability questions vs action requests
  - Sends portfolio data and proactive alerts to the LLM for context

#### `src/lib/utils.ts`

- Logic preserved from original:
  - `cn` for class names
  - `isValidWalletAddress` for address validation
  - `findToken` for ERC-20 lookup via Blockscout
  - Used by new DeFi flows as well

#### `src/lib/constants.ts`

- Typo fixed (`contants.ts` → `constants.ts`) and kept:
  - `BLOCK_EXPLORER_URL` for building transaction links

---

### 4. Network Handling & Safety Improvements

- Added robust network validation around DeFi actions:
  - Ensures wallet is on **Rootstock Testnet** before:
    - Depositing or withdrawing collateral
    - Borrowing or repaying USDT0
  - Uses `getMetaMaskChainId` to read MetaMask's actual chain ID (not just Wagmi cache)
  - When on the wrong network:
    - Prompts switch
    - Blocks risky actions with clear error messages

- Pre-transaction validation:
  - Borrow:
    - Checks requested amount against `maxBorrowableUSD` from portfolio
  - Withdraw:
    - Prevents actions that would drop health factor below 1.0
  - Repay:
    - Automatically checks and sets ERC20 allowance as needed

---

### 5. README.md Changes

- Started from the original `ai-agent-rsk` README
- Added sections:
  - **DeFi Lending Operations (New!)**
  - **Portfolio Monitoring (New!)**
  - **Natural Language Commands** for portfolio + lending
- Updated project structure to document:
  - `src/lib/portfolio.ts`
  - `src/lib/contracts.ts`
  - `src/lib/abis/`

---

### 6. What Remains the Same

- The overall app architecture:
  - Next.js App Router layout
  - Reown AppKit wallet connection
  - Groq LLM API integration
  - Shadcn UI components
- Original transfer and balance behaviors:
  - Still work as before
  - Now co-exist with lending/portfolio features
- Security and disclaimer sections in README

---

### 7. How to Review This in the PR

When opening the PR against the original `ai-agent-rsk` repo, reviewers should focus on:

- `src/app/page.tsx` – main UI + DeFi flows
- `src/app/api/ai/route.ts` – LLM tools and prompt logic
- `src/lib/portfolio.ts`, `src/lib/contracts.ts`, `src/lib/abis/*` – new integration layer
- `src/lib/utils.ts` – reused helpers
- `README.md` – updated docs describing new features

These are the **intended** changes; everything else is kept as close as possible to the original repository.

