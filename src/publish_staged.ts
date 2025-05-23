import { config } from "./config.ts";
import { loadStagedPosts, savePostsToStage } from "../lib/data_store.ts";
import { createWordPressPost } from "../lib/wordpress_client.ts";
import type { ProcessedRedditPost } from "../lib/reddit_client.ts";
import { Input } from "cliffy";

async function main() {
  console.log("Starting Staged Post Publisher...");

  let stagedPosts = loadStagedPosts();

  if (stagedPosts.length === 0) {
    console.log("No posts currently in the staging area.");
    return;
  }

  const postsToPublish: ProcessedRedditPost[] = [];
  const remainingStagedPosts: ProcessedRedditPost[] = [...stagedPosts];

  while (true) {
    console.log("\n--- Staged Posts ---");
    if (remainingStagedPosts.length === 0) {
      console.log("No more posts in the staging area to select.");
      break;
    }
    remainingStagedPosts.forEach((post, index) => {
      console.log(
        `[${index + 1}] ${post.title} (${post.featureType || "N/A"})${
          post.artist ? ` - ${post.artist}` : ""
        }`,
      );
    });
    console.log("--------------------\n");

    const choice: string = await Input.prompt({
      message:
        "Enter number of post to publish (e.g., 1), 'all', or 'done' to finish selecting:",
      default: "done",
    });

    if (choice.toLowerCase() === "done") {
      break;
    }

    if (choice.toLowerCase() === "all") {
      postsToPublish.push(...remainingStagedPosts);
      remainingStagedPosts.length = 0; // Clear the array
      console.log("All posts selected for publishing.");
      break;
    }

    const postIndex = Number.parseInt(choice) - 1;
    if (
      !Number.isNaN(postIndex) &&
      postIndex >= 0 &&
      postIndex < remainingStagedPosts.length
    ) {
      const selectedPost = remainingStagedPosts.splice(postIndex, 1)[0];
      postsToPublish.push(selectedPost);
      console.log(`Selected for publishing: "${selectedPost.title}"`);
    } else {
      console.log("Invalid selection. Please try again.");
    }
  }

  if (postsToPublish.length === 0) {
    console.log("\nNo posts selected for publishing.");
  } else {
    console.log(`\n--- Publishing ${postsToPublish.length} Post(s) ---`);
    const authTokenBase64 = btoa(
      `${config.wordpress.username}:${config.wordpress.password}`,
    );

    for (const post of postsToPublish) {
      console.log(`Publishing: "${post.title}"...`);
      const success = await createWordPressPost(post, authTokenBase64);
      if (success) {
        console.log(`Successfully published: "${post.title}"`);
        // Remove from original stagedPosts array by ID
        stagedPosts = stagedPosts.filter((p) => p.id !== post.id);
      } else {
        console.error(
          `Failed to publish: "${post.title}". It will remain in the staging area.`,
        );
        // If it failed, ensure it's back in remainingStagedPosts if it was part of an 'all' selection
        // or if we want to offer a retry mechanism later. For now, it stays out of the current publish batch
        // but remains in the overall stagedPosts if not successfully removed.
      }
    }
  }

  // Save the updated staged posts list (with successfully published posts removed)
  await savePostsToStage(stagedPosts);
  console.log("\nStaging area updated.");
  console.log("Staged Post Publisher finished.");
}

if (import.meta.main) {
  main().catch(console.error);
}
