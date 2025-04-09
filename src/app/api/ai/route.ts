import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY as string,
});

export async function POST(req: Request) {
  try {
    const {
      type,
      data,
      question,
      address,
      messageHistory = [],
    } = await req.json();

    const prompt = createChatPrompt(data, question, address);

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
      model: "llama3-70b-8192",
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
            description: "Check token balance for an address",
            parameters: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description:
                    "Wallet address to check (defaults to user's wallet if empty)",
                },
                token1: {
                  type: "string",
                  description:
                    "Token symbol to check balance for (e.g., TRBTC, DOC, RIF)",
                },
              },
              required: ["token1"],
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
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

function getSystemPrompt() {
  return `You are Rootstock AI Agent, a personal DeFi assistant for the Rootstock testnet ecosystem.
  
  IMPORTANT TESTNET DETAILS:
  - We are operating on Rootstock TESTNET, not mainnet
  - The native token is TRBTC (Testnet RBTC), not RBTC
  - Always use TRBTC when referring to the native token
  - All balances and transactions are using testnet tokens with no real value
  
  RESPONSE GUIDELINES:
  - Be extremely concise - no more than 2 short paragraphs total
  - Be conversational and professional - like a financial advisor
  - Always provide a personalized response that directly addresses the query
  - If portfolio is empty, briefly suggest 1-2 Rootstock options
  
  FORMATTING:
  - Keep responses under 300 characters whenever possible
  - Use bold (**text**) for important terms
  - No lists, no lengthy explanations
  - One short greeting line, then 1-2 concise sentences for the answer
  
  CONTENT:
  - Rootstock testnet ecosystem: TRBTC (native), tRIF, tDOC, etc.
  - For transfers/balances: respond naturally without mentioning functions
  - For strategies: give only brief, specific insights
  
  BE EXTREMELY BRIEF. Your responses should be scannable in 5 seconds or less.`;
}

function createChatPrompt(userContext: any, question: string, address: string) {
  return `I need your help with the following DeFi request for my Rootstock testnet wallet (${address}):
  
  USER QUESTION: "${question}"
  
  My portfolio data: ${JSON.stringify(
    userContext,
    null,
    2
  )} the amount is in wei so you need to convert it to the correct token amount by dividing by 10e18.
  
  IMPORTANT: We are on the TESTNET environment. The native token is tRBTC (not RBTC). All tokens are testnet versions (tRBTC, tRIF, tDOC) with no real value.
  
  Please provide a helpful, personalized response that directly addresses my question. If I'm asking about sending tokens or checking balances, please handle that appropriately. If my portfolio is empty, don't just tell me I have no tokens - suggest what I could explore in the Rootstock testnet ecosystem.

  When I ask to send RBTC, you should interpret this as tRBTC (testnet RBTC). Always use tRBTC in your function calls and responses.

  If needed, you can USE FUNCTIONS like **transfer** or **balance** to help me with my request. WHENEVER ASKED TO SEND TOKENS, PLEASE USE THE **transfer** FUNCTION. WHENEVER ASKED TO CHECK BALANCES, PLEASE USE THE **balance** FUNCTION.
  
  Be conversational and friendly - like a professional financial advisor would be, not like a generic chatbot. Avoid technical language about functions or API calls - speak to me naturally about my options.`;
}
