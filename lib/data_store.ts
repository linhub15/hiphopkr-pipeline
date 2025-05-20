// data_store.ts
import { config } from "../src/config.ts";
import { ProcessedRedditPost } from "./reddit_client.ts"; // If you decide to store full posts

const PROCESSED_IDS_PATH = config.jsonStore.processedPostsPath;

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
