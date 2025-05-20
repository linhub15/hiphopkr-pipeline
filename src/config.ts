import { loadSync } from "@std/dotenv";

export const envPath = `${import.meta.dirname}/../.env`;

try {
  loadSync({ envPath: envPath, export: true });
} catch (e) {
  if (e instanceof Deno.errors.NotFound) {
    console.warn(
      `.env file not found at ${envPath}. Proceeding with defaults or environment variables if set elsewhere. GUI may prompt for setup.`,
    );
  } else {
    console.error(`Error loading .env file from ${envPath}:`, e);
  }
}

export const config = {
  reddit: {
    subredditUrl: "https://www.reddit.com/r/khiphop/new.json",
    limit: 100, // Number of posts to fetch
    cachePath: "./tmp/reddit_cache.json", // Path to store the cached Reddit JSON
    cacheDurationMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    allowedFlairs: ["Music Video", "Album", "News", "Audio"], // Added allowedFlairs
  },
  jsonStore: { // New section for local JSON file persistence
    processedPostsPath: "./processed_post_ids.json",
    stagingPath: "./staging_area.json", // Path for posts ready to be published
  },
  debug: { // New section for debugging features
    generateMarkdownFiles: true, // Set to true to enable .md file generation
    markdownDebugPath: "./debug_markdown_posts", // Directory to save .md files
  },
  spotify: {
    clientId: Deno.env.get("SPOTIFY_CLIENT_ID") || "",
    clientSecret: Deno.env.get("SPOTIFY_CLIENT_SECRET") || "",
    tokenUrl: "https://accounts.spotify.com/api/token",
    apiUrl: "https://api.spotify.com/v1",
  },
  wordpress: {
    endpoint: Deno.env.get("WORDPRESS_ENDPOINT") || "",
    username: Deno.env.get("WORDPRESS_USERNAME") || "",
    password: Deno.env.get("WORDPRESS_PASSWORD") || "",
    publishImmediately: false,
  },
  openai: {
    apiKey: Deno.env.get("OPENAI_API_KEY") || undefined,
    apiUrl: "https://api.openai.com/v1/chat/completions",
  },
};

export function saveConfig(
  data: Record<string, string>,
): { success: boolean; message: string } {
  const envContent = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  try {
    Deno.writeTextFileSync(envPath, envContent); // Use async version
    getConfig();
    return {
      success: true,
      message: "Configuration saved to .env. Reloaded in backend.",
    };
  } catch (e: unknown) {
    const error = e as Error;
    console.error("Error writing .env file:", error);
    return { success: false, message: `Failed to save .env: ${error.message}` };
  }
}

export function getConfig() {
  try {
    const values = loadSync({ envPath: envPath, export: true });
    return {
      SPOTIFY_CLIENT_ID: values.SPOTIFY_CLIENT_ID || "",
      SPOTIFY_CLIENT_SECRET: values.SPOTIFY_CLIENT_SECRET || "",
      WORDPRESS_ENDPOINT: values.WORDPRESS_ENDPOINT || "",
      WORDPRESS_USERNAME: values.WORDPRESS_USERNAME || "",
      WORDPRESS_PASSWORD: values.WORDPRESS_PASSWORD || "",
      OPENAI_API_KEY: values.OPENAI_API_KEY || undefined,
    };
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.warn(
        `.env file not found at ${envPath} during reload. Current Deno.env values persist.`,
      );
    } else {
      console.error(`Error reloading .env file from ${envPath}:`, e);
    }
  }
}