import { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { z } from "zod";

type ToolArgumentMap = Record<string, unknown>;

interface BaseTool {
  definition: ChatCompletionTool;
  argsSchema: z.ZodType<ToolArgumentMap>;
}

export interface ServerTool extends BaseTool {
  type: "server";
  handler: (args: ToolArgumentMap) => Promise<unknown>;
}

export interface ClientTool extends BaseTool {
  type: "client";
}

export type Tool = ServerTool | ClientTool;

export interface ToolPluginManifest {
  id: string;
  enabled: boolean;
  loadTools: () => Promise<Tool[]>;
}
