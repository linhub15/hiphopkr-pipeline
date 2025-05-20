// data_store.ts
import { config } from "../src/config.ts";
import type { ProcessedRedditPost } from "./reddit_client.ts"; // Un-commented and used
// import type { WorkerOutputMessage, WorkerInputMessage } from "./worker_messages.ts"; // No longer needed

const PROCESSED_IDS_PATH = config.jsonStore.processedPostsPath;
const STAGING_PATH = config.jsonStore.stagingPath; // Added staging path

/**
 * Loads the set of processed Reddit post IDs from a local JSON file.
 * @returns A Promise resolving to a Set of strings (post IDs).
 */
export async function loadProcessedPostIds(): Promise<Set<string>> {
  try {
    const fileContent = await Deno.readTextFile(PROCESSED_IDS_PATH);
    const idsArray: string[] = JSON.parse(fileContent);
    return new Set(idsArray);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // File doesn't exist, which is fine on the first run
      return new Set();
    }
    console.error(
      `Error reading processed post IDs file (${PROCESSED_IDS_PATH}):`,
      error,
    );
    return new Set(); // Return empty set on other errors to avoid breaking the pipeline
  }
}

/**
 * Saves a new processed Reddit post ID to the local JSON file.
 * It reads the existing IDs, adds the new one, and writes the whole set back.
 * @param postId The ID of the Reddit post that has been processed.
 */
export async function saveProcessedPostId(postId: string): Promise<void> {
  const existingIds = await loadProcessedPostIds();
  if (existingIds.has(postId)) {
    // Already exists, no need to save again, though this check should ideally be before calling save.
    return;
  }
  existingIds.add(postId);
  try {
    const idsArray = Array.from(existingIds);
    await Deno.writeTextFile(
      PROCESSED_IDS_PATH,
      JSON.stringify(idsArray, null, 2),
    );
    // console.log(`Saved post ID ${postId} to ${PROCESSED_IDS_PATH}`);
  } catch (error) {
    console.error(
      `Error writing processed post ID to file (${PROCESSED_IDS_PATH}):`,
      error,
    );
  }
}

/**
 * Loads staged posts from the staging JSON file directly.
 * @returns An array of ProcessedRedditPost.
 */
export function loadStagedPosts(): ProcessedRedditPost[] {
  console.log(
    "[data_store] loadStagedPosts: Starting to load staged posts directly.",
  );
  try {
    const fileContent = Deno.readTextFileSync(STAGING_PATH);
    if (fileContent.trim() === "") {
      console.log(
        "[data_store] loadStagedPosts: Staging file is empty. Successfully loaded 0 posts.",
      );
      return []; // Handle empty file
    }
    const posts = JSON.parse(fileContent) as ProcessedRedditPost[];
    console.log(
      `[data_store] loadStagedPosts: Successfully loaded and parsed ${posts.length} staged posts.`,
    );
    return posts;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(
        `[data_store] loadStagedPosts: Staging file (${STAGING_PATH}) not found. Returning empty array.`,
      );
      return []; // File doesn't exist, return empty array
    }
    console.error(
      `[data_store] loadStagedPosts: Error reading or parsing staged posts file (${STAGING_PATH}):`,
      error,
    );
    return []; // Return empty array on other errors
  }
}

/**
 * Saves an array of posts to the staging JSON file.
 * This will overwrite the existing staging file.
 * @param posts The array of ProcessedRedditPost to save.
 */
export async function savePostsToStage(
  posts: ProcessedRedditPost[],
): Promise<void> {
  try {
    await Deno.writeTextFile(STAGING_PATH, JSON.stringify(posts, null, 2));
    // console.log(`Saved ${posts.length} posts to staging area: ${STAGING_PATH}`); // Re-commented, was likely intentional user log
  } catch (error) {
    console.error(
      `Error writing posts to staging file (${STAGING_PATH}):`,
      error,
    );
  }
}

/**
 * Adds a single post to the staging area.
 * It reads existing staged posts, adds the new one, and writes them back.
 * @param post The ProcessedRedditPost to add to the stage.
 */
export async function addPostToStage(post: ProcessedRedditPost): Promise<void> {
  const stagedPosts = loadStagedPosts(); // Removed await

  if (stagedPosts.some((p) => p.id === post.id)) {
    // console.log(`Post ${post.id} already in staging area. Skipping.`); // Re-commented, was likely intentional user log
    return;
  }
  stagedPosts.push(post);
  await savePostsToStage(stagedPosts);
}

/**
 * (Optional) If you want to store the full enriched post data locally.
 * For now, we are only storing IDs for deduplication.
 */
// export async function saveEnrichedPostData(posts: ProcessedRedditPost[]): Promise<void> {
//   const filePath = "./enriched_data_log.json"; // Or a different file per run
//   try {
//     await Deno.writeTextFile(filePath, JSON.stringify(posts, null, 2));
//     console.log(`Full enriched data saved to ${filePath}`);
//   } catch (error) {
//     console.error(`Error saving full enriched data:`, error);
//   }
// }
