import { Webview } from "jsr:@webview/webview";
import { config } from "./config.ts";
import { loadStagedPosts, savePostsToStage } from "../lib/data_store.ts";
import { createWordPressPost } from "../lib/wordpress_client.ts";
import type { ProcessedRedditPost } from "../lib/reddit_client.ts";
import { runPipeline as runMainPipelineInternal } from "./main.ts"; // Import the pipeline function

const html = `
  <html>
  <head>
    <title>Reddit to WordPress Pipeline</title>
    <style>
      body { font-family: sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
      h1, h2 { color: #333; }
      button { 
        padding: 10px 15px; 
        margin-bottom: 10px; 
        margin-right: 5px;
        background-color: #007bff; 
        color: white; 
        border: none; 
        border-radius: 5px; 
        cursor: pointer; 
      }
      button:hover { background-color: #0056b3; }
      #stagedPostsArea { 
        margin-top: 20px; 
        border: 1px solid #ccc; 
        padding: 10px; 
        min-height: 200px; 
        background-color: #fff;
        border-radius: 5px;
      }
      .post-item { 
        margin-bottom: 8px; 
        padding: 8px; 
        border-bottom: 1px solid #eee; 
        display: flex;
        align-items: center;
      }
      .post-item:last-child { border-bottom: none; }
      .post-item input[type="checkbox"] { margin-right: 10px; }
      #statusBar { margin-top: 15px; padding: 10px; background-color: #e9ecef; border-radius: 5px; }
    </style>
  </head>
  <body>
    <h1>Reddit to WordPress Pipeline Control</h1>
    
    <button onclick="handleRunPipeline()">Run Reddit Fetch Pipeline</button>
    <button onclick="refreshPostsUI()">Refresh Staged Posts</button>
    <button onclick="handlePublishAction()">Publish Selected Posts</button>

    <h2>Staged Posts</h2>
    <div id="stagedPostsArea">
      <p>Click "Refresh Staged Posts" to load.</p>
    </div>
    
    <div id="statusBar">Status: Idle</div>

    <script>
      const statusBar = document.getElementById('statusBar');

      function updateStatus(message, isError = false) {
        statusBar.textContent = \`Status: \${message}\`;
        statusBar.style.color = isError ? 'red' : 'black';
      }

      async function handleRunPipeline() {
        updateStatus('Starting pipeline execution...');
        try {
          // Directly call the bound Deno function
          const result = await runMainPipeline(); 
          updateStatus(\`Pipeline: \${result}\`);
          if (result.includes('successfully')) {
            refreshPostsUI(); // Auto-refresh on success
          }
        } catch (e) {
          const error = e as Error;
          console.error('Error running pipeline:', error);
          updateStatus(\`Error running pipeline: \${error.message || String(error)}\`, true);
        }
      }

      async function refreshPostsUI() {
        updateStatus('Loading staged posts...');
        try {
          // Directly call the bound Deno function
          const posts = await getStagedPosts(); 
          const area = document.getElementById('stagedPostsArea');
          area.innerHTML = ''; // Clear previous posts
          if (posts && posts.length > 0) {
            posts.forEach(post => {
              const postDiv = document.createElement('div');
              postDiv.className = 'post-item';
              // Sanitize post content if it's directly from an external source and rendered as HTML
              // For now, assuming title, featureType, artist are safe.
              postDiv.innerHTML = \`
                <input type="checkbox" data-post-id="\${post.id}" />
                <div>
                  <strong>\${post.title}</strong><br>
                  <small>Type: \${post.featureType || 'N/A'} \${post.artist ? ' - Artist: ' + post.artist : ''}</small>
                </div>
              \`;
              area.appendChild(postDiv);
            });
            updateStatus(\`Loaded \${posts.length} staged posts.\`);
          } else {
            area.innerHTML = '<p>No posts in staging area.</p>';
            updateStatus('No posts in staging area.');
          }
        } catch (e) {
          const error = e as Error;
          console.error('Error loading staged posts:', error);
          updateStatus(\`Error loading staged posts: \${error.message || String(error)}\`, true);
        }
      }

      async function handlePublishAction() {
        const selectedPostIds = [];
        document.querySelectorAll('#stagedPostsArea input[type="checkbox"]:checked').forEach(checkbox => {
          selectedPostIds.push((checkbox as HTMLInputElement).dataset.postId);
        });

        if (selectedPostIds.length === 0) {
          updateStatus('No posts selected for publishing.', true);
          return;
        }

        updateStatus(\`Publishing \${selectedPostIds.length} post(s)...\`);
        try {
          // Directly call the bound Deno function
          const result = await publishPosts(selectedPostIds); 
          updateStatus(result.message);
          refreshPostsUI(); // Refresh the list
        } catch (e) {
          const error = e as Error;
          console.error('Error publishing posts:', error);
          updateStatus(\`Error publishing posts: \${error.message || String(error)}\`, true);
        }
      }

      // Initial load of staged posts when the GUI starts
      function tryInitialLoad() {
        // Check if a bound function (e.g., getStagedPosts) is available
        if (typeof getStagedPosts === 'function') { 
          console.log('WebView bridge (bound functions) ready, loading initial posts.');
          refreshPostsUI();
        } else {
          console.log('WebView bridge (bound functions) not ready, retrying initial load in 100ms...');
          setTimeout(tryInitialLoad, 100);
        }
      }
      window.onload = tryInitialLoad;

    </script>
  </body>
  </html>
`;

async function runMainPipeline(): Promise<string> {
  try {
    console.log("GUI: Triggering main pipeline directly...");
    await runMainPipelineInternal(); // Call the imported function
    console.log("GUI: Main pipeline completed successfully (called directly).");
    return "Pipeline completed successfully.";
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GUI: Error running main pipeline directly:", error);
    return `Error running pipeline: ${error.message}`;
  }
}

async function getStagedPosts(): Promise<ProcessedRedditPost[]> {
  try {
    console.log("GUI: Loading staged posts...");
    // Assumes gui.ts is run from project root, so config paths are relative to it.
    const posts = await loadStagedPosts();
    console.log(`GUI: Loaded ${posts.length} staged posts.`);
    return posts;
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GUI: Error loading staged posts:", error);
    return [];
  }
}

async function publishPosts(postIds: string[]): Promise<{ message: string }> {
  if (!postIds || postIds.length === 0) {
    return { message: "No post IDs provided for publishing." };
  }
  console.log(`GUI: Received request to publish posts: ${postIds.join(", ")}`);

  const stagedPosts = await loadStagedPosts(); // Assumes CWD is project root
  const postsToPublish: ProcessedRedditPost[] = [];
  const remainingStagedPostsAfterSelection = [...stagedPosts];

  for (const id of postIds) {
    const postIndex = remainingStagedPostsAfterSelection.findIndex((p) =>
      p.id === id
    );
    if (postIndex > -1) {
      postsToPublish.push(
        remainingStagedPostsAfterSelection.splice(postIndex, 1)[0],
      );
    }
  }

  if (postsToPublish.length === 0) {
    return { message: "Selected posts not found or already processed." };
  }

  const authTokenBase64 = btoa(
    `${config.wordpress.username}:${config.wordpress.password}`,
  );

  let successCount = 0;
  let failureCount = 0;
  const successfullyPublishedIds: string[] = [];

  for (const post of postsToPublish) {
    console.log(`GUI: Publishing "\${post.title}"...`);
    try {
      const success = await createWordPressPost(post, authTokenBase64); // Assumes CWD is project root for any path resolutions within
      if (success) {
        console.log(`GUI: Successfully published "${post.title}".`);
        successfullyPublishedIds.push(post.id);
        successCount++;
      } else {
        console.error(
          `GUI: Failed to publish "${post.title}". It will remain staged.`,
        );
        failureCount++;
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.error(`GUI: Error during publishing of "${post.title}":`, error);
      failureCount++;
    }
  }

  // Filter out successfully published posts from the original full list
  const finalStagedPosts = stagedPosts.filter((p) =>
    !successfullyPublishedIds.includes(p.id)
  );
  await savePostsToStage(finalStagedPosts); // Assumes CWD is project root
  console.log("GUI: Staging area updated after publishing attempt.");

  return {
    message:
      `Publishing complete. ${successCount} succeeded, ${failureCount} failed.`,
  };
}

const webview = new Webview();

webview.bind("runMainPipeline", runMainPipeline);
webview.bind("getStagedPosts", getStagedPosts);
webview.bind("publishPosts", publishPosts);

webview.navigate(`data:text/html,${encodeURIComponent(html)}`);
webview.title = "Khiphop Pipeline Manager";
webview.run();

console.log("GUI application started. Close window to exit.");
