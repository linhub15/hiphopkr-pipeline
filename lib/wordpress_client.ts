// wordpress_client.ts
import { config } from "../src/config.ts";
import type { ProcessedRedditPost } from "./reddit_client.ts";

// Helper function to upload media (album cover) to WordPress
async function uploadMediaToWordPress(
  imageUrl: string,
  title: string,
  authToken: string,
): Promise<number | null> {
  if (!imageUrl) return null;

  try {
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(
        `Failed to download image from ${imageUrl}: ${imageResponse.status}`,
      );
      return null;
    }
    const imageBlob = await imageResponse.blob();
    const originalFileName =
      imageUrl.substring(imageUrl.lastIndexOf("/") + 1) ||
      `${title.replace(/\s+/g, "-")}-cover`;
    // Ensure a common extension if missing, or derive from blob.type
    const fileName = originalFileName.includes(".")
      ? originalFileName
      : `${originalFileName}.${imageBlob.type.split("/")[1] || "jpg"}`;

    const formData = new FormData();
    formData.append("file", imageBlob, fileName);
    formData.append("title", `${title} Album Cover`);
    formData.append("alt_text", `${title} - Cover Art`);
    // formData.append("caption", `Cover art for ${title}`); // Optional

    const mediaResponse = await fetch(
      `${config.wordpress.endpoint}/wp/v2/media`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authToken}`,
          // Content-Disposition and Content-Type are typically handled by FormData
        },
        body: formData,
      },
    );

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error(
        `Failed to upload media to WordPress: ${mediaResponse.status} - ${errorText}`,
      );
      return null;
    }
    const mediaData = await mediaResponse.json();
    return mediaData.id;
  } catch (error) {
    console.error("Error uploading media to WordPress:", error);
    return null;
  }
}

function generatePostContent(post: ProcessedRedditPost): string {
  // Basic HTML template. You can make this much more sophisticated.
  let content = "";

  if (
    post.albumCoverUrl && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    // Featured image will be set separately, but you can include it in content too
    // content += `<figure class="wp-block-image size-large"><img src="${post.albumCoverUrl}" alt="${post.trackOrAlbumTitle} by ${post.artist} - Cover Art"></figure>\n\n`;
  }

  if (
    post.artist && post.trackOrAlbumTitle && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    content += `<p><strong>Artist:</strong> ${post.artist}</p>\n`;
    content += `<p><strong>Title:</strong> ${post.trackOrAlbumTitle}</p>\n`;
  }
  if (
    post.releaseDate && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    content += `<p><strong>Release Date:</strong> ${post.releaseDate}</p>\n`;
  }
  if (
    post.producers && post.producers.length > 0 &&
    post.featureType !== "news" && post.featureType !== "rumor"
  ) {
    content += `<p><strong>Producer(s):</strong> ${
      post.producers.join(", ")
    }</p>\n\n`;
  }

  if (post.description) {
    content += `<h2>Synopsis</h2>\n<p>${
      post.description.replace(/\n/g, "<br>")
    }</p>\n\n`;
  }

  if (post.spotifyLink || post.appleMusicLink) {
    content += "<h2>Stream/Listen</h2>\n<ul>\n";
    if (post.spotifyLink) {
      content +=
        `  <li><a href="${post.spotifyLink}" target="_blank" rel="noopener noreferrer">Spotify</a></li>\n`;
    }
    if (post.appleMusicLink) { // Assuming you might add this later
      content +=
        `  <li><a href="${post.appleMusicLink}" target="_blank" rel="noopener noreferrer">Apple Music</a></li>\n`;
    }
    content += "</ul>\n\n";
  }

  content +=
    `<p><em>Source: <a href="${post.redditLink}" target="_blank" rel="noopener noreferrer">r/khiphop on Reddit</a>`;
  if (
    post.sourceUrl !== post.redditLink &&
    !post.sourceUrl.includes("i.redd.it") &&
    !post.sourceUrl.includes("v.redd.it")
  ) {
    content +=
      ` | <a href="${post.sourceUrl}" target="_blank" rel="noopener noreferrer">Original Source</a>`;
  }
  content += "</em></p>\n";

  // Add SEO keywords/tags based on flair, artist, title later via categories/tags
  return content;
}

// Function to create a post in WordPress
interface WordPressPostPayload {
  title: string;
  content: string;
  status: "publish" | "draft";
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  // Add other fields as needed based on WordPress REST API v2 Posts schema
}

export async function createWordPressPost(
  post: ProcessedRedditPost,
  authTokenBase64: string,
): Promise<boolean> {
  let featuredMediaId: number | null = null;
  if (post.albumCoverUrl) {
    featuredMediaId = await uploadMediaToWordPress(
      post.albumCoverUrl,
      post.trackOrAlbumTitle || post.title,
      authTokenBase64,
    );
  }

  const postStatus = config.wordpress.publishImmediately ? "publish" : "draft";

  const wpPost: WordPressPostPayload = {
    title: post.title, // Using the original Reddit title for now
    content: generatePostContent(post),
    status: postStatus,
  };

  if (featuredMediaId) {
    wpPost.featured_media = featuredMediaId;
  }

  try {
    const response = await fetch(
      `${config.wordpress.endpoint}/wp/v2/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authTokenBase64}`,
        },
        body: JSON.stringify(wpPost),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to create WordPress post: ${response.status} - ${errorText}`,
      );
      return false; // Ensure boolean return
    }

    const responseData = await response.json();
    console.log(
      `WordPress post created successfully (ID: ${responseData.id}, Status: ${responseData.status}): ${responseData.link}`,
    );
    return true;
  } catch (error) {
    console.error("Error creating WordPress post:", error);
    return false; // Ensure boolean return
  }
}
