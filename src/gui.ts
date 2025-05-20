import { Webview } from "jsr:@webview/webview";
import { config, getConfig, saveConfig } from "./config.ts";
import { loadStagedPosts, savePostsToStage } from "../lib/data_store.ts";
import { createWordPressPost } from "../lib/wordpress_client.ts";
import type { ProcessedRedditPost } from "../lib/reddit_client.ts";
import { runPipeline as runFetchAndStageProcess } from "./fetch_service.ts"; // Import the pipeline function

const html = `
  <html>
  <head>
    <title>Reddit to WordPress Pipeline</title>
    <style>
      body { font-family: sans-serif; margin: 0; background-color: #f4f4f4; color: #333; display: flex; flex-direction: column; height: 100vh; }
      #appContainer { display: flex; flex-direction: column; flex-grow: 1; }
      #navBar { display: flex; background-color: #333; padding: 0 10px; }
      .nav-button {
        padding: 10px 15px;
        margin: 5px 2px;
        background-color: #555;
        color: white;
        border: none;
        border-radius: 3px 3px 0 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .nav-button:hover { background-color: #777; }
      .nav-button.active-nav { background-color: #007bff; color: white; }
      .nav-button svg { width: 16px; height: 16px; fill: currentColor; }

      #contentArea { padding: 20px; flex-grow: 1; overflow-y: auto; }
      #mainAppView, #configView { /* Common styles for views if any, specific display handled by JS */ }
      
      h1, h2 { color: #333; margin-top: 0; }
      button { /* General button styles - keep or refine */
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
      
      .config-form-area { /* Style for the config form itself, now within #configView */
        padding: 15px; 
        background-color: #fff; 
        border: 1px solid #ccc; 
        border-radius: 5px;
      }
      .config-form-area label { display: block; margin-bottom: 5px; font-weight: bold; }
      .config-form-area input[type="text"], .config-form-area input[type="password"] { width: 95%; padding: 8px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div id="appContainer">
      <nav id="navBar">
        <button id="showMainAppBtn" class="nav-button active-nav">Home</button>
        <button id="showConfigBtn" class="nav-button">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.14,12.74a2,2,0,0,0-2.48,0L15.2,14.21a2,2,0,0,0,0,2.82l1.47,1.47a2,2,0,0,0,2.82,0l1.47-1.47a2,2,0,0,0,0-2.82ZM12,10.11a2,2,0,0,0-1.41.59L9.17,12.11a2,2,0,0,0,0,2.82l1.42,1.42a2,2,0,0,0,2.82,0l1.41-1.41a2,2,0,0,0,0-2.82ZM22,10.5A10.5,10.5,0,1,0,11.5,21,10.5,10.5,0,0,0,22,10.5Zm-2,0a8.5,8.5,0,1,1-8.5-8.5A8.5,8.5,0,0,1,20,10.5Z"/></svg>
          Config
        </button>
      </nav>
      <div id="contentArea">
        <div id="mainAppView">
          <h1>Reddit to WordPress Pipeline Control</h1>
          <button onclick="window.handleFetchAction()">Fetch New Posts</button>
          <button onclick="window.refreshPostsUI()">Refresh Staged View</button>
          <button onclick="window.handlePublishDraftsAction()">Publish Selected as Drafts</button>
          <h2>Staged Posts</h2>
          <div id="stagedPostsArea">
            <p>Click "Refresh Staged Posts" to load.</p>
          </div>
          <div id="statusBar">Status: Idle</div>
        </div>

        <div id="configView" style="display: none;">
          <div class="config-form-area">
            <h2>Setup Configuration</h2>
            <p>Please provide the necessary API keys and credentials. These will be saved to a <code>.env</code> file in the project root.</p>
            <label for="spotifyClientId">Spotify Client ID:</label>
            <input type="text" id="spotifyClientId" name="spotifyClientId" />
            <label for="spotifyClientSecret">Spotify Client Secret:</label>
            <input type="text" id="spotifyClientSecret" name="spotifyClientSecret" />
            <label for="wordpressEndpoint">WordPress Endpoint URL:</label>
            <input type="text" id="wordpressEndpoint" name="wordpressEndpoint" />
            <label for="wordpressUsername">WordPress Username:</label>
            <input type="text" id="wordpressUsername" name="wordpressUsername" />
            <label for="wordpressPassword">WordPress Password:</label>
            <input type="password" id="wordpressPassword" name="wordpressPassword" />
            <label for="openaiApiKey">OpenAI API Key (Optional):</label>
            <input type="text" id="openaiApiKey" name="openaiApiKey" />
            <button onclick="window.saveConfiguration()">Save Configuration</button>
            <div id="configSaveStatus"></div>
          </div>
        </div>
      </div>
    </div>

    <script>
      // const statusBar = document.getElementById('statusBar'); // We will get it inside updateStatus

      window.showMainAppView = function() {
        document.getElementById('mainAppView').style.display = 'block';
        document.getElementById('configView').style.display = 'none';
        document.getElementById('showMainAppBtn').classList.add('active-nav');
        document.getElementById('showConfigBtn').classList.remove('active-nav');
      }

      window.showConfigView = function() {
        document.getElementById('mainAppView').style.display = 'none';
        document.getElementById('configView').style.display = 'block';
        document.getElementById('showMainAppBtn').classList.remove('active-nav');
        document.getElementById('showConfigBtn').classList.add('active-nav');
      }

      window.updateStatus = function(message, isError = false) {
        console.log(\`updateStatus called with: "\${message}", isError: \${isError}\`);
        const statusBarEl = document.getElementById('statusBar');
        if (statusBarEl) {
          statusBarEl.textContent = \`Status: \${message}\`;
          statusBarEl.style.color = isError ? 'red' : 'black';
          console.log(\`statusBar textContent set to: "Status: \${message}"\`);
        } else {
          console.error("statusBar element not found!");
        }
      }

      window.handleFetchAction = async function() {
        console.log('handleFetchAction called');
        window.updateStatus('Starting to fetch new posts...');
        try {
          console.log('Calling bound Deno function: fetchAndStagePosts...');
          const result = await window.fetchAndStagePosts(); 
          console.log('fetchAndStagePosts returned:', result);
          window.updateStatus(\`Fetch: \${result}\`);
          if (result && typeof result === 'string' && result.includes('successfully')) {
            window.refreshPostsUI(); // Refresh after successful fetch
          }
        } catch (e) {
          console.error('Error in handleFetchAction:', e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          window.updateStatus(\`Error fetching posts: \${errorMessage}\`, true);
        }
      }

      window.refreshPostsUI = async function() {
        window.updateStatus('Loading staged posts...');
        try {
          console.log('Calling bound Deno function: getStagedPosts...');
          const posts = await window.getStagedPosts(); 
          console.log('getStagedPosts returned:', posts ? posts.length : 'null/undefined');
          const area = document.getElementById('stagedPostsArea');
          if (!area) {
            console.error("stagedPostsArea element not found!");
            window.updateStatus("Error: UI area for posts not found.", true);
            return;
          }
          area.innerHTML = ''; // Clear previous posts
          if (posts && posts.length > 0) {
            posts.forEach(post => {
              const postDiv = document.createElement('div');
              postDiv.className = 'post-item';
              postDiv.innerHTML = \`
                <input type="checkbox" data-post-id="\${post.id}" />
                <div>
                  <strong>\${post.title}</strong><br>
                  <small>Type: \${post.featureType || 'N/A'} \${post.artist ? ' - Artist: ' + post.artist : ''}</small>
                </div>
              \`;
              area.appendChild(postDiv);

              const checkbox = postDiv.querySelector('input[type="checkbox"]');
              const titleElement = postDiv.querySelector('strong');

              if (checkbox && titleElement) {
                titleElement.style.cursor = 'pointer'; // Add visual cue
                titleElement.addEventListener('click', () => {
                  checkbox.checked = !checkbox.checked;
                });
              }
            });
            window.updateStatus(\`Loaded \${posts.length} staged posts.\`);
          } else {
            area.innerHTML = '<p>No posts in staging area.</p>';
            window.updateStatus('No posts in staging area.');
          }
        } catch (e) {
          console.error('Error in refreshPostsUI:', e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          window.updateStatus(\`Error loading staged posts: \${errorMessage}\`, true);
        }
      }

      window.handlePublishDraftsAction = async function() {
        console.log('handlePublishDraftsAction called');
        const selectedPostIds = [];
        document.querySelectorAll('#stagedPostsArea input[type="checkbox"]:checked').forEach(checkbox => {
          selectedPostIds.push(checkbox.dataset.postId); 
        });

        if (selectedPostIds.length === 0) {
          window.updateStatus('No posts selected for publishing.', true);
          return;
        }

        window.updateStatus(\`Publishing \${selectedPostIds.length} post(s) as drafts...\`);
        try {
          console.log('Calling bound Deno function: publishStagedPostsAsDrafts with IDs:', selectedPostIds);
          const result = await window.publishStagedPostsAsDrafts(selectedPostIds); 
          console.log('publishStagedPostsAsDrafts returned:', result);
          const resultMessage = typeof result === 'string' ? result : (result && result.message) || "Publish action complete.";
          window.updateStatus(resultMessage);
          window.refreshPostsUI(); // Refresh the list
        } catch (e) {
          console.error('Error in handlePublishDraftsAction:', e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          window.updateStatus(\`Error publishing drafts: \${errorMessage}\`, true);
        }
      }

      function tryInitialLoad() {
        // Ensure all critical Deno-bound functions for initialization are ready
        if (typeof window.getStagedPosts === 'function' && 
            typeof window.checkInitialConfig === 'function' &&
            typeof window.getAllConfigValues === 'function') { 
          console.log('WebView bridge (bound functions) ready for initial load.');
          window.checkInitialConfig(); 
        } else {
          console.log('WebView bridge (bound functions) not fully ready, retrying initial load in 100ms...');
          setTimeout(tryInitialLoad, 100);
        }
      }

      window.saveConfiguration = async function() {
        const configData = {
          SPOTIFY_CLIENT_ID: document.getElementById('spotifyClientId')['value'],
          SPOTIFY_CLIENT_SECRET: document.getElementById('spotifyClientSecret')['value'],
          WORDPRESS_ENDPOINT: document.getElementById('wordpressEndpoint')['value'],
          WORDPRESS_USERNAME: document.getElementById('wordpressUsername')['value'],
          WORDPRESS_PASSWORD: document.getElementById('wordpressPassword')['value'],
          OPENAI_API_KEY: document.getElementById('openaiApiKey')['value'],
        };
        const configSaveStatus = document.getElementById('configSaveStatus');
        try {
          configSaveStatus.textContent = 'Saving...';
          const saveToEnvResult = await window.saveConfig(configData);
          configSaveStatus.textContent = saveToEnvResult.message;

          if (saveToEnvResult.success) {            
            configSaveStatus.style.color = 'green';
            window.showMainAppView(); 
            window.updateStatus('Configuration saved. Values active immediately.');
          } else {
            configSaveStatus.style.color = 'red';
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          configSaveStatus.textContent = \`Error saving: \${err.message}\`;
          configSaveStatus.style.color = 'red';
        }
      };

      window.checkInitialConfig = async function() {
        console.log("Checking initial configuration by fetching directly from backend (synchronously)...");
        let configValues = {};
        let source = '';

        try {
            configValues = await window.getAllConfigValues();
            source = 'Deno backend (direct load)';
            console.log("Fetched configuration directly from Deno backend:", configValues);
        } catch (e) {
            console.error("Error fetching config from Deno backend:", e);
        }
        
        const missingKeys = [];
        const essentialKeys = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'WORDPRESS_ENDPOINT', 'WORDPRESS_USERNAME', 'WORDPRESS_PASSWORD'];
        for (const key of essentialKeys) {
            if (!configValues[key]) { 
                missingKeys.push(key);
            }
        }

        document.getElementById('spotifyClientId')['value'] = configValues.SPOTIFY_CLIENT_ID || '';
        document.getElementById('spotifyClientSecret')['value'] = configValues.SPOTIFY_CLIENT_SECRET || '';
        document.getElementById('wordpressEndpoint')['value'] = configValues.WORDPRESS_ENDPOINT || '';
        document.getElementById('wordpressUsername')['value'] = configValues.WORDPRESS_USERNAME || '';
        document.getElementById('wordpressPassword')['value'] = configValues.WORDPRESS_PASSWORD || '';
        document.getElementById('openaiApiKey')['value'] = configValues.OPENAI_API_KEY || '';

        if (missingKeys.length > 0 && source !== 'None (all sources failed)') {
            console.log("Missing essential config keys based on current source:", missingKeys);
            window.updateStatus(\`Missing configuration: \${missingKeys.join(', ')}. Please fill out the form.\`, true);
            window.showConfigView();
        } else if (source === 'None (all sources failed)') {
            window.showConfigView();
        } else {
            console.log("Configuration seems OK based on current source.");
            window.showMainAppView();
            if (typeof window.refreshPostsUI === 'function') {
                window.refreshPostsUI(); 
            } else {
                console.error('window.refreshPostsUI is NOT a function in checkInitialConfig');
            }
        }
      };

      document.addEventListener('DOMContentLoaded', () => {
        const mainBtn = document.getElementById('showMainAppBtn');
        const configBtn = document.getElementById('showConfigBtn');

        if(mainBtn) mainBtn.addEventListener('click', window.showMainAppView);
        if(configBtn) configBtn.addEventListener('click', window.showConfigView);
        
        tryInitialLoad(); // Call initial load sequence after DOM is ready
      });

    </script>
  </body>
  </html>
`;

async function fetchAndStagePosts(): Promise<string> {
  try {
    console.log("GUI: Triggering fetch and stage process (main pipeline)...");
    await runFetchAndStageProcess(); // This is the imported main pipeline function
    console.log("GUI: Fetch and stage process completed successfully.");
    return "Fetch and stage process completed successfully.";
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GUI: Error during fetch and stage process:", error);
    return `Error in fetch and stage: ${error.message}`;
  }
}

function getStagedPosts(): ProcessedRedditPost[] {
  try {
    console.log("GUI: Loading staged posts...");
    const posts = loadStagedPosts();
    console.log(`GUI: Loaded ${posts.length} staged posts.`);
    return posts;
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GUI: Error loading staged posts:", error);
    return [];
  }
}

async function publishStagedPostsAsDrafts(
  postIds: string[],
): Promise<{ message: string }> {
  if (!postIds || postIds.length === 0) {
    return { message: "No post IDs provided for publishing." };
  }
  console.log(
    `GUI: Received request to publish posts as drafts: ${postIds.join(", ")}`,
  );

  const stagedPosts = loadStagedPosts(); // Assumes CWD is project root
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
    console.log(`GUI: Publishing "\${post.title}" as draft...`);
    try {
      const success = await createWordPressPost(post, authTokenBase64); // Assumes CWD is project root for any path resolutions within
      if (success) {
        console.log(`GUI: Successfully published "${post.title}" as draft.`);
        successfullyPublishedIds.push(post.id);
        successCount++;
      } else {
        console.error(
          `GUI: Failed to publish "${post.title}" as draft. It will remain staged.`,
        );
        failureCount++;
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.error(
        `GUI: Error during publishing of "${post.title}" as draft:`,
        error,
      );
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
      `Publishing drafts complete. ${successCount} succeeded, ${failureCount} failed.`,
  };
}

function loadConfig() {
  console.log("GUI: Loading configuration...");
  const configValues = getConfig();
  console.log("GUI: Configuration loaded:", configValues);
  return configValues;
}

function runGui() {
  const webview = new Webview(true);

  // Bind Deno functions to the webview
  webview.bind("getAllConfigValues", loadConfig);
  webview.bind("fetchAndStagePosts", fetchAndStagePosts);
  webview.bind("getStagedPosts", getStagedPosts);
  webview.bind("publishStagedPostsAsDrafts", publishStagedPostsAsDrafts);
  webview.bind("saveConfig", saveConfig);

  webview.navigate(`data:text/html,${encodeURIComponent(html)}`);
  webview.title = "Khiphop Pipeline Manager";
  webview.run();

  console.log("GUI application started. Close window to exit.");
}

// Start the GUI
runGui();
