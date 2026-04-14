[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/rsksmart/ai-agent-rsk/badge)](https://scorecard.dev/viewer/?uri=github.com/rsksmart/ai-agent-rsk)
[![CodeQL](https://github.com/rsksmart/rskj/workflows/CodeQL/badge.svg)](https://github.com/rsksmart/ai-agent-rsk/actions?query=workflow%3ACodeQL)

<img src="rootstock-logo.png" alt="RSK Logo" style="width:100%; height: auto;" />

# Conversational AI Agent on Rootstock Testnet

**⚠️ Warning: This is a prototype intended for hackathons, learning, and rapid prototyping. Use it at your own risk. It is not ready for production without further testing.**

This project demonstrates how to build a lightweight conversational AI agent that can interpret natural language and perform blockchain actions like checking token balances and sending tRBTC—all through a chat interface. It runs on the **Rootstock testnet** using [**Groq’s LLM API**](https://groq.com/), [**Reown AppKit**](https://reown.com/), and [**Wagmi**](https://wagmi.sh/), all wrapped in a [**Next.js app**](https://nextjs.org/) styled with [**Shadcn UI**](https://ui.shadcn.com/).

> 🔗 Inspired by [BitMate](https://github.com/Zero-Labs-Workspace/BitMate) – a hackathon project exploring the fusion of AI and DeFi on Rootstock.

## Features

- 🔐 Wallet connection via Reown AppKit (MetaMask, WalletConnect, embedded)
- 🧠 Natural language interface via Groq LLM API
- 💬 Conversational agent with memory and action routing
- ⚡ Send tRBTC and check token balances using plain English
- �️ **Modular Tool System** — Extensible architecture for adding new AI skills.
- 📊 **Transaction Summarization** — Automatically fetch and summarize wallet activity.
- 🔬 **Smart Contract Interpretation** — Interpret and interact with Rootstock contracts.
- �️ UI powered by Next.js App Router and Shadcn components

## Community-Driven Extensions

The Rootstock AI Agent is built on a collaborative, modular ecosystem. We foster innovation by allowing the community to contribute new "AI skills" or modules. Developers can easily extend the agent's capabilities to:
- Summarize complex transactions.
- Interpret and interact with smart contract data.
- Integrate with additional Rootstock DeFi protocols.

**Goal:** Foster innovation and expand the AI Agent into a collaborative, modular ecosystem that grows through community input.

### Add a new plugin tool

Server-side tool registration is manifest-driven. To add a community tool:

1. Create your tool module in `src/lib/ai/tools/` and export a `Tool`.
2. Define:
   - `type: "server"` (or `"client"` for frontend-executed actions)
   - `definition` (Groq function metadata)
   - `argsSchema` (zod validation for all tool arguments)
   - `handler` (required for server tools)
3. Register it through a manifest in `src/lib/ai/tools/plugins/`.
   - Add or update a `*.manifest.ts` file.
   - Include the manifest in `src/lib/ai/tools/plugins/index.ts`.
4. Run lint/type checks to ensure schema and type safety pass.

Validation and safety rules:
- Tool names must be unique across all manifests.
- Server tools must provide a handler (compile-time and runtime validated).
- Tool arguments are validated before execution.
- Only enabled and allowlisted manifests are loaded.

Minimal server tool example:

```ts
import { z } from "zod";
import { Tool } from "../types";

export const myTool: Tool = {
  type: "server",
  argsSchema: z.object({ address: z.string() }),
  definition: {
    type: "function",
    function: {
      name: "my_tool",
      description: "Example tool",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
  handler: async ({ address }) => ({ ok: true, address }),
};
```

## Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)
- A browser wallet like MetaMask connected to the [Rootstock Testnet](https://explorer.testnet.rootstock.io/)

Optional but recommended:

- [Bun](https://bun.sh/) (v1.1+) or [Yarn](https://yarnpkg.com/)

## Getting Started

1. **Clone the Repository**

   ```bash
   git clone https://github.com/rsksmart/ai-agent-rsk.git
   cd ai-agent-rsk
   ```

2. **Install Dependencies**

   ```bash
   npm install # or bun install or yarn install
   ```

3. **Configure Environment Variables**

   - Copy `.env.example` to `.env.local`
   - Fill in the following values:

     ```
     NEXT_PUBLIC_PROJECT_ID=
     NEXT_PUBLIC_RPC_MAINNET=
     NEXT_PUBLIC_RPC_TESTNET=
     NEXT_PUBLIC_GROQ_API_KEY=
     ```
   You can get the api keys this way:

   - ProjectId at [Reown Cloud](https://cloud.reown.com/)
   - RPCs at [Rootstock RPC API](https://dashboard.rpc.rootstock.io/dashboard)
   - Groq API Key at [Groq Console](https://console.groq.com/keys)

4. **Run the Dev Server**

   ```bash
   npm run dev # or bun dev or yarn dev
   ```

## Project Structure

- `app/page.tsx` — Main chat UI and wallet interface
- `src/lib/utils.ts` — Wallet address validation and token lookup
- `src/lib/constants.ts` — Block explorer URLs and other constants
- `src/lib/ai/tools/` — Modular AI skill definitions (client and server-side)
- `components/` — Reusable UI components and chat layout
- `app/api/ai` — Endpoint to call Groq LLM API and handle modular tools

## Contributors

- **flash** ([@flash](https://github.com/chrisarevalo11))

## Troubleshooting

- **Groq API Key Not Working**: Make sure it’s correctly set in `.env.local` and not rate-limited.
- **Wallet Connection Fails**: Check MetaMask is on the Rootstock Testnet.
- **Token Not Found**: Make sure the token is an ERC-20 on Rootstock Testnet.

## Contributing

We welcome community contributions! Feel free to fork the project and submit a pull request. Just make sure your changes are well-documented and scoped to the project's purpose.

## Support

If you run into any issues or have questions, please [open an issue](https://github.com/rsksmart/ai-agent-rsk/issues) on GitHub.

## Disclaimer

The software provided in this GitHub repository is offered “as is,” without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.

- **Testing**: The software has not undergone testing of any kind, and its functionality, accuracy, reliability, and suitability for any purpose are not guaranteed.
- **Use at Your Own Risk**: The user assumes all risks associated with the use of this software. The author(s) of this software shall not be held liable for any damages, including but not limited to direct, indirect, incidental, special, consequential, or punitive damages arising out of the use of or inability to use this software, even if advised of the possibility of such damages.
- **No Liability**: The author(s) of this software are not liable for any loss or damage, including without limitation, any loss of profits, business interruption, loss of information or data, or other pecuniary loss arising out of the use of or inability to use this software.
- **Sole Responsibility**: The user acknowledges that they are solely responsible for the outcome of the use of this software, including any decisions made or actions taken based on the software’s output or functionality.
- **No Endorsement**: Mention of any specific product, service, or organization does not constitute or imply endorsement by the author(s) of this software.
- **Modification and Distribution**: This software may be modified and distributed under the terms of the license provided with the software. By modifying or distributing this software, you agree to be bound by the terms of the license.
- **Assumption of Risk**: By using this software, the user acknowledges and agrees that they have read, understood, and accepted the terms of this disclaimer and assume all risks associated with the use of this software.