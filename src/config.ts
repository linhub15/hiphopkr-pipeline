// config.ts
import { load } from "@std/dotenv";

await load({ export: true }); // Exports .env variables to Deno.env

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
    clientId: Deno.env.get("SPOTIFY_CLIENT_ID")!,
    clientSecret: Deno.env.get("SPOTIFY_CLIENT_SECRET")!,
    tokenUrl: "https://accounts.spotify.com/api/token",
    apiUrl: "https://api.spotify.com/v1",
  },
  wordpress: {
    endpoint: Deno.env.get("WORDPRESS_ENDPOINT")!,
    username: Deno.env.get("WORDPRESS_USERNAME")!,
    password: Deno.env.get("WORDPRESS_PASSWORD")!,
    publishImmediately: false, // Added publishImmediately
  },
  openai: {
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    apiUrl: "https://api.openai.com/v1/chat/completions",
  },
};

// Validate essential config
if (!config.spotify.clientId || !config.spotify.clientSecret) {
  console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env");
  Deno.exit(1);
}
if (
  !config.wordpress.endpoint || !config.wordpress.username ||
  !config.wordpress.password
) {
  console.error("Missing WordPress configuration in .env");
  Deno.exit(1);
}
