// main.ts
import { config } from "./config.ts";
import { fetchRedditPosts, type ProcessedRedditPost } from "./reddit_client.ts";
import { loadProcessedPostIds, saveProcessedPostId } from "./data_store.ts"; // Updated import
import { enrichWithMusicData } from "./music_enrichment.ts";
import { extractNewsContent } from "./news_content_extractor.ts";
import { generateSynopsis } from "./gpt_client.ts";
import { createWordPressDraft } from "./wordpress_client.ts";
import { writeDebugMarkdownFile } from "./debug_writer.ts"; // Added import
import { cron } from "https://deno.land/x/deno_cron@v1.0.0/cron.ts";

async function runPipeline() {
  console.log(`[${new Date().toISOString()}] Starting Khiphop Pipeline...`);

  // 1. Load IDs of already processed posts from local JSON file
  const processedPostIds = await loadProcessedPostIds();
  console.log(`Loaded ${processedPostIds.size} already processed post ID(s) from ${config.jsonStore.processedPostsPath}.`);

  // 2. Pull data from Reddit
  console.log("Fetching posts from Reddit...");
  const redditPosts = await fetchRedditPosts(config.reddit.subredditUrl, config.reddit.limit);
  if (redditPosts.length === 0) {
    console.log("No posts found on Reddit for this period.");
    console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
    return;
  }
  console.log(`Workspaceed ${redditPosts.length} posts from Reddit.`);

  const postsToProcess: ProcessedRedditPost[] = [];
  for (const post of redditPosts) {
    if (processedPostIds.has(post.id)) { // Check against loaded IDs
      // console.log(`Skipping already processed post: ${post.id} - ${post.title}`);
      continue;
    }
    postsToProcess.push(post);
  }

  if (postsToProcess.length === 0) {
    console.log("No new posts to process after filtering already processed ones.");
    console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
    return;
  }
  console.log(`Processing ${postsToProcess.length} new posts.`);

  // This array will hold the fully enriched posts for this run
  // It's not persisted as a whole, but individual IDs are.
  const processedInThisRun: ProcessedRedditPost[] = [];

  for (let post of postsToProcess) {
    console.log(`\nProcessing post ID: ${post.id} - Title: ${post.title}`);

    // 3. Enrich music releases or extract news text
    if (['track', 'album', 'ep', 'mv'].includes(post.featureType!)) {
      console.log("Enriching with music data...");
      post = await enrichWithMusicData(post);
    } else if (post.featureType === 'news' || post.featureType === 'rumor') {
      console.log("Extracting news content...");
      post = await extractNewsContent(post);
    }

    // 4. (Optional) Generate synopsis with GPT
    if (config.openai.apiKey && (post.description || (post.artist && post.trackOrAlbumTitle))) {
      console.log("Generating synopsis...");
      post = await generateSynopsis(post);
    }

    // New Debug Step: Generate Markdown File
    if (config.debug.generateMarkdownFiles) {
      await writeDebugMarkdownFile(post);
    }

    // 5. Create WordPress draft FOR THIS POST
    // Add a check: only create WP post if essential data (title, content) is present
    let wpDraftCreated = false;
    if ((post.artist && post.trackOrAlbumTitle) || // Music posts
        (post.featureType === 'news' && post.description && post.description.length > 20) || // News posts
        (post.featureType === 'rumor' && post.description && post.description.length > 20) || // Rumor posts
        (post.featureType === 'other' && post.title && post.sourceUrl) // Other link posts
       ) {
      console.log(`Creating WP draft for: ${post.title}`);
      const draft = await createWordPressDraft(post);
      if (draft) {
        wpDraftCreated = true;
      }
    } else {
      console.warn(`Skipping WordPress draft for "${post.title}" (ID: ${post.id}) due to missing critical information for its type.`);
    }

    // 6. Mark post as processed by saving its ID (if WP draft was successful or not deemed critical)
    // You might choose to only save ID if WP draft creation was successful,
    // or save it anyway to prevent re-processing the enrichment steps.
    // For now, let's save it if it went through the main processing steps.
    await saveProcessedPostId(post.id);
    console.log(`Post ID ${post.id} marked as processed.`);
    processedInThisRun.push(post); // Add to in-memory list for this run's summary
  }

  // Optional: Log summary of what was done in this run
  if (processedInThisRun.length > 0) {
    console.log(`\nSummary of this run: ${processedInThisRun.length} posts were processed and their IDs saved.`);
    // If you wanted to save the full enriched data for posts processed *in this run*:
    // await saveEnrichedPostData(processedInThisRun); // Implement this in data_store.ts if needed
  } else {
    console.log("\nNo new posts were fully processed in this run.");
  }

  console.log(`[${new Date().toISOString()}] Khiphop Pipeline run finished.`);
}

// --- Main Execution & Scheduling ---
if (import.meta.main) {
  console.log("Khiphop Pipeline Scheduler Started.");
  console.log(`Persistence: Using local JSON file at ${config.jsonStore.processedPostsPath}`);
  console.log(`Will run based on cron: "${config.cronSchedule}" (System time)`);

  runPipeline().catch(err => console.error("Initial pipeline run failed:", err));

  cron(config.cronSchedule, () => {
    runPipeline().catch(err => console.error("Scheduled pipeline run failed:", err));
  });
}