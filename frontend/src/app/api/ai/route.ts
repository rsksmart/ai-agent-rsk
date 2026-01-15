import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

// Check if API key is set
if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY is not set in environment variables");
}

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY as string,
});

export async function POST(req: Request) {
  try {
    // Check API key first
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ 
        error: "GROQ_API_KEY is not configured. Please set it in your environment variables." 
      }, { status: 500 });
    }

    const {
      type,
      data,
      portfolioAlert,
      question,
      address,
      messageHistory = [],
    } = await req.json();

    // Validate required fields
    if (!question) {
      return NextResponse.json({ 
        error: "Question is required" 
      }, { status: 400 });
    }

    const prompt = createChatPrompt(data, portfolioAlert, question, address);

    const limitedHistory = messageHistory.slice(-10);

    const messages = [
      {
        role: "system",
        content: getSystemPrompt(),
      },
    ];

    if (limitedHistory && limitedHistory.length > 0) {
      limitedHistory.forEach((msg: { role: string; content: string }) => {
        messages.push({
          role: msg.role === "bot" ? "assistant" : "user",
          content: typeof msg.content === "string" ? msg.content : "User input",
        });
      });
    }

    messages.push({
      role: "user",
      content: prompt,
    });

    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2024,
      messages: messages as any,
      temperature: 0.7,
      tools: [
        {
          type: "function",
          function: {
            name: "transfer",
            description:
              "Transfer tokens from the user's wallet to another address",
            parameters: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Recipient wallet address",
                },
                token1: {
                  type: "string",
                  description:
                    "Token symbol to transfer (e.g., TRBTC, DOC, RIF)",
                },
                amount: {
                  type: "number",
                  description: "Amount of tokens to transfer",
                },
              },
              required: ["address", "token1", "amount"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "balance",
            description: "Check token balance for an address. If no token is specified, checks tRBTC (native token) balance.",
            parameters: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description:
                    "Wallet address to check balance for. If not provided, checks the user's own wallet balance.",
                },
                token1: {
                  type: "string",
                  description:
                    "Token symbol to check balance for (e.g., tRBTC, DOC, RIF). Defaults to tRBTC if not specified.",
                },
              },
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "portfolio",
            description: "Get and display the user's current DeFi portfolio data from the LendingPool. ONLY use when user explicitly asks to SHOW, CHECK, SEE, or DISPLAY their portfolio, position, collateral, debt, or health factor. DO NOT use for capability questions like 'what can you do'.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "deposit",
            description: "Deposit tRBTC (native token) as collateral into the LendingPool. This allows the user to borrow against their collateral later.",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "Amount of tRBTC to deposit as collateral (e.g., 0.1, 1.5, 10)",
                },
              },
              required: ["amount"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "withdraw",
            description: "Withdraw tRBTC collateral from the LendingPool. The withdrawal must maintain health factor above 1.0.",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "Amount of tRBTC to withdraw from collateral (e.g., 0.1, 1.5, 10)",
                },
              },
              required: ["amount"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "borrow",
            description: "Borrow USDT0 against deposited tRBTC collateral. The borrow amount must not exceed max borrowable based on collateral.",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "Amount of USDT0 to borrow (e.g., 100, 500, 1000)",
                },
              },
              required: ["amount"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "repay",
            description: "Repay USDT0 debt to the LendingPool. This reduces the user's debt and improves their health factor.",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "Amount of USDT0 to repay (e.g., 100, 500, 1000). Can repay partial or full debt.",
                },
              },
              required: ["amount"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const aiMessage = response.choices[0].message;
    const toolCalls = aiMessage.tool_calls;

    // Handle function calls if present
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      return NextResponse.json({
        analysis: aiMessage.content || "Processing your request...",
        type,
        functionCall: {
          name: functionName,
          arguments: functionArgs,
        },
      });
    }

    // Regular response without function calls
    return NextResponse.json({
      analysis: aiMessage.content,
      type,
    });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    const errorMessage = error?.message || error?.toString() || "Unknown error";
    const errorDetails = error?.response?.data || error?.error || null;
    
    return NextResponse.json({ 
      error: "Analysis failed",
      details: errorMessage,
      ...(errorDetails && { apiError: errorDetails })
    }, { status: 500 });
  }
}

function getSystemPrompt() {
  return `You are Rootstock AI Agent, a personal DeFi assistant for the Rootstock testnet ecosystem.
  
  IMPORTANT TESTNET DETAILS:
  - We are operating on Rootstock TESTNET, not mainnet
  - The native token is TRBTC (Testnet RBTC), not RBTC
  - Always use TRBTC when referring to the native token
  - All balances and transactions are using testnet tokens with no real value
  
  YOUR CAPABILITIES:
  You can help users with:
  - **Portfolio Management**: Check DeFi lending positions, collateral, debt, health factor, and max borrowable amounts
  - **Token Transfers**: Send tRBTC or other tokens to any address
  - **Balance Checks**: Check token balances for any address
  - **DeFi Lending Actions**:
    * Deposit tRBTC as collateral
    * Withdraw tRBTC collateral (if health factor allows)
    * Borrow USDT0 against collateral
    * Repay USDT0 debt
  - **Proactive Alerts**: Warn users about low health factors and liquidation risks
  - **Financial Advice**: Provide insights about DeFi strategies and portfolio health
  
  RESPONSE GUIDELINES:
  - Be extremely concise - no more than 2 short paragraphs total
  - Be conversational and professional - like a financial advisor
  - Always provide a personalized response that directly addresses the query
  - If portfolio is empty, briefly suggest 1-2 Rootstock options
  - When asked "what can you do" or "what are your capabilities", briefly list your main features
  
  FORMATTING:
  - Keep responses under 300 characters whenever possible
  - Use bold (**text**) for important terms
  - No lists, no lengthy explanations
  - One short greeting line, then 1-2 concise sentences for the answer
  - Exception: When listing capabilities, you can use a brief bullet list
  
  CONTENT:
  - Rootstock testnet ecosystem: TRBTC (native), tRIF, tDOC, etc.
  - For transfers/balances: respond naturally without mentioning functions
  - For strategies: give only brief, specific insights
  
  BE EXTREMELY BRIEF. Your responses should be scannable in 5 seconds or less.`;
}

function createChatPrompt(userContext: any, portfolioAlert: string | null, question: string, address: string) {
  const portfolioSection = userContext 
    ? `My portfolio data from the LendingPool contract:
- Collateral (tRBTC): ${userContext.collateralRBTC}
- Debt (USDT0): ${userContext.debtUSDT0}
- Collateral Value (USD): $${userContext.collateralUSD}
- Debt Value (USD): $${userContext.debtUSD}
- Max Borrowable (USD): $${userContext.maxBorrowableUSD}
- Health Factor: ${userContext.healthFactor >= 999999 ? "∞ (No Debt)" : userContext.healthFactor.toFixed(2)}
- Position Status: ${userContext.isHealthy ? (userContext.isAtRisk ? "Healthy but at risk" : "Healthy") : "UNHEALTHY - At risk of liquidation"}
- Has Active Position: ${userContext.hasPosition ? "Yes" : "No"}`
    : "I don't have any portfolio data yet (no position in the LendingPool).";

  const alertSection = portfolioAlert 
    ? `\n\n⚠️ PROACTIVE ALERT: ${portfolioAlert}`
    : "";
  
  return `I need your help with the following DeFi request for my Rootstock testnet wallet${address ? ` (${address})` : ''}:
  
  USER QUESTION: "${question}"
  
  ${portfolioSection}${alertSection}
  
  IMPORTANT: We are on the TESTNET environment. The native token is tRBTC (not RBTC). All tokens are testnet versions (tRBTC, tRIF, tDOC) with no real value.
  
  Please provide a helpful, personalized response that directly addresses my question. 
  
  CRITICAL RULE - DO NOT USE FUNCTIONS FOR CAPABILITY QUESTIONS:
  If the user asks "what can you do", "what are your features", "what are your capabilities", "what all things can you do", "how can you help", or any similar question about YOUR ABILITIES, answer directly WITHOUT calling ANY functions. Do NOT call portfolio, balance, or any other function.
  
  For capability questions, answer: "I'm your Rootstock DeFi assistant! I can help you manage your lending portfolio, check balances, send tokens, and perform DeFi actions like depositing collateral, borrowing USDT0, and repaying debt. I also monitor your health factor and alert you about risks. What would you like to do?"
  
  - If I ask about my wallet address, tell me: ${address || "No wallet connected"}
  - If I'm asking about sending tokens or checking balances, please handle that appropriately using the available functions
  - If my portfolio is empty, don't just tell me I have no tokens - suggest what I could explore in the Rootstock testnet ecosystem
  - Answer simple questions directly and conversationally

  When I ask to send RBTC, you should interpret this as tRBTC (testnet RBTC). Always use tRBTC in your function calls and responses.

  ONLY USE FUNCTIONS when the user explicitly wants to:
  - Perform an action (send, deposit, withdraw, borrow, repay)
  - Check specific data (balance, portfolio)
  
  If needed, you can USE FUNCTIONS like **transfer**, **balance**, **portfolio**, **deposit**, **withdraw**, **borrow**, or **repay** to help me with my request. 
  - WHENEVER ASKED TO SEND TOKENS, PLEASE USE THE **transfer** FUNCTION
  - WHENEVER ASKED TO CHECK BALANCES, PLEASE USE THE **balance** FUNCTION
  - WHENEVER ASKED TO SHOW/CHECK/SEE/DISPLAY PORTFOLIO, LENDING POSITION, COLLATERAL, DEBT, HEALTH FACTOR, OR BORROWING CAPACITY (e.g., "show my portfolio", "check my position"), PLEASE USE THE **portfolio** FUNCTION. DO NOT use it for capability questions like "what can you do"
  - WHENEVER ASKED TO DEPOSIT tRBTC AS COLLATERAL, DEPOSIT COLLATERAL, ADD COLLATERAL, OR PUT tRBTC INTO THE LENDING POOL, PLEASE USE THE **deposit** FUNCTION with the amount specified
  - WHENEVER ASKED TO WITHDRAW tRBTC COLLATERAL, WITHDRAW COLLATERAL, OR REMOVE COLLATERAL, PLEASE USE THE **withdraw** FUNCTION with the amount specified
  - WHENEVER ASKED TO BORROW USDT0, BORROW AGAINST COLLATERAL, OR TAKE A LOAN, PLEASE USE THE **borrow** FUNCTION with the USDT0 amount specified
  - WHENEVER ASKED TO REPAY USDT0 DEBT, REPAY DEBT, PAY BACK LOAN, OR REDUCE DEBT, PLEASE USE THE **repay** FUNCTION with the USDT0 amount specified
  
  Be conversational and friendly - like a professional financial advisor would be, not like a generic chatbot. Avoid technical language about functions or API calls - speak to me naturally about my options.`;
}



