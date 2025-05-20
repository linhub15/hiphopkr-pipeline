// lib/worker_messages.ts
import type { ProcessedRedditPost } from "./reddit_client.ts";

export interface WorkerInputMessage {
  filePath: string;
}

export interface WorkerOutputMessage {
  status: "success" | "error";
  posts?: ProcessedRedditPost[];
  error?: string;
}
