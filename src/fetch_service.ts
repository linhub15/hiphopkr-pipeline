import { config } from "../src/config.ts";
import {
  fetchRedditPosts,
  type ProcessedRedditPost,
} from "../lib/reddit_client.ts";
import {
  addPostToStage, // Added import for staging
  loadProcessedPostIds,
  saveProcessedPostId,
} from "../lib/data_store.ts";
import { enrichWithMusicData } from "../lib/music_enrichment.ts";
import { extractNewsContent } from "../lib/news_content_extractor.ts";
import { generateSynopsis } from "../lib/gpt_client.ts";
import { writeDebugMarkdownFile } from "../lib/debug_writer.ts";

export async function runPipeline() {
  console.log(`[${new Date().toISOString()}] Starting Khiphop Pipeline...`);

  // 1. Load IDs of already processed posts from local JSON file
  const processedPostIds = await loadProcessedPostIds();
  console.log(
    `Loaded ${processedPostIds.size} already processed post ID(s) from ${config.jsonStore.processedPostsPath}.`,
  );

  // 2. Pull data from Reddit
  console.log("Fetching posts from Reddit...");
  const redditPosts = await fetchRedditPosts(
    new URL(config.reddit.subredditUrl),
    config.reddit.limit,
  );
  if (redditPosts.length === 0) {
    console.log("No posts found on Reddit for this period.");
    console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
    return;
  }
  console.log(`Fetched ${redditPosts.length} posts from Reddit.`); // Corrected log message

  const postsToProcess: ProcessedRedditPost[] = [];
  for (const post of redditPosts) {
    if (processedPostIds.has(post.id)) {
      continue;
    }
    postsToProcess.push(post);
  }

  if (postsToProcess.length === 0) {
    console.log(
      "No new posts to process after filtering already processed ones.",
    );
    console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
    return;
  }
  console.log(`Processing ${postsToProcess.length} new posts.`);

  const processedInThisRun: ProcessedRedditPost[] = [];

  for (let post of postsToProcess) {
    console.log(`\nProcessing post ID: ${post.id} - Title: ${post.title}`);

    // 3. Enrich music releases or extract news text
    if (post.featureType && ["track", "album", "ep", "mv"].includes(post.featureType)) {
      console.log("Enriching with music data...");
      post = await enrichWithMusicData(post);
    } else if (post.featureType === "news" || post.featureType === "rumor") {
      console.log("Extracting news content...");
      post = await extractNewsContent(post);
    }

    // 4. (Optional) Generate synopsis with GPT
    if (
      config.openai.apiKey &&
      (post.description || (post.artist && post.trackOrAlbumTitle))
    ) {
      console.log("Generating synopsis...");
      post = await generateSynopsis(post);
    }

    // New Debug Step: Generate Markdown File
    if (config.debug.generateMarkdownFiles) {
      await writeDebugMarkdownFile(post);
    }

    // 5. Add to Staging Area instead of direct WordPress posting
    // Check if post has essential data before staging
    if (
      (post.artist && post.trackOrAlbumTitle) || // Music posts
      (post.featureType === "news" && post.description &&
        post.description.length > 20) || // News posts
      (post.featureType === "rumor" && post.description &&
        post.description.length > 20) || // Rumor posts
      (post.featureType === "other" && post.title && post.sourceUrl) // Other link posts
    ) {
      console.log(`Adding post to staging area: ${post.title}`);
      await addPostToStage(post);
      // We still mark as processed to avoid re-enriching,
      // actual publishing will be a separate step.
      await saveProcessedPostId(post.id);
    } else {
      console.warn(
        `Skipping staging for "${post.title}" (ID: ${post.id}) due to missing critical information.`,
      );
      // Optionally, still mark as processed if you don't want to retry enrichment,
      // or leave it to be picked up again if criteria might be met later (e.g. manual edit).
      // For now, we'll mark it as processed to avoid loops if data is inherently missing.
      await saveProcessedPostId(post.id);
    }

    // The following block for direct WP posting and subsequent saveProcessedPostId is removed.
    // The saveProcessedPostId is now handled within the staging logic.

    // console.log(`Post ID ${post.id} marked as processed.`); // Moved or handled within staging logic
    processedInThisRun.push(post);
  }

  if (processedInThisRun.length > 0) {
    console.log(
      `\nSummary of this run: ${processedInThisRun.length} posts were processed and considered for staging.`,
    );
    console.log(
      `Staged posts can be found at: ${config.jsonStore.stagingPath}`,
    );
  } else {
    console.log("\nNo new posts were processed in this run.");
  }

  console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
}

// --- Main Execution & Scheduling ---
if (import.meta.main) {
  console.log("Khiphop Pipeline Started.");
  console.log(
    `Persistence: Processed IDs at ${config.jsonStore.processedPostsPath}`,
  );
  console.log(
    `Staging Area: Posts ready for review at ${config.jsonStore.stagingPath}`,
  );

  runPipeline().catch((err) => console.error("Pipeline run failed:", err));
}
