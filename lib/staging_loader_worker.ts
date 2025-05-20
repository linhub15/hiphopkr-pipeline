/// <reference lib="deno.worker" />

// lib/staging_loader_worker.ts
declare let self: DedicatedWorkerGlobalScope;

import type { ProcessedRedditPost } from "./reddit_client.ts";
import type { WorkerInputMessage, WorkerOutputMessage } from "./worker_messages.ts";

self.onmessage = async (event: MessageEvent<WorkerInputMessage>) => {
  const { filePath } = event.data;
  try {
    const fileContent = await Deno.readTextFile(filePath);

    if (fileContent.trim() === "") {
      const message: WorkerOutputMessage = { status: "success", posts: [] };
      self.postMessage(message);
      return;
    }

    const posts: ProcessedRedditPost[] = JSON.parse(fileContent);
    
    const successMessage: WorkerOutputMessage = { status: "success", posts };
    self.postMessage(successMessage);

  } catch (error) {
    let errorMessage = "An unknown error occurred in the worker";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    if (error instanceof Deno.errors.NotFound) {
      const notFoundMessage: WorkerOutputMessage = { status: "success", posts: [] };
      self.postMessage(notFoundMessage);
    } else {
      console.error(`[Worker] Error reading or parsing file (${filePath}).`);
      const generalErrorMessage: WorkerOutputMessage = { status: "error", error: errorMessage };
      self.postMessage(generalErrorMessage);
    }
  } finally {
    // self.close(); // Consider if worker should be long-lived or closed after each task
  }
};
