import type { ProcessedRedditPost } from "./reddit_client";

async function uploadMediaToWordPress(
	imageUrl: string,
	title: string,
	altText: string,
	authToken: string,
	wordpressEndpoint: string,
): Promise<number | null> {
	if (!imageUrl) return null;

	try {
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
		formData.append("title", title);
		formData.append("alt_text", altText);

		const mediaResponse = await fetch(`${wordpressEndpoint}/wp/v2/media`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${authToken}`,
				// Content-Disposition and Content-Type are typically handled by FormData
			},
			body: formData,
		});

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

interface WordPressPostPayload {
	title: string;
	content: string;
	status: "publish" | "draft";
	featured_media?: number;
	featuredImage?: { url: string; title: string; altText: string };
	categories?: number[];
}

export async function createWordPressPost(
	post: ProcessedRedditPost,
	authTokenBase64: string,
	wordpressEndpoint: string,
): Promise<boolean> {
	let featuredMediaId: number | null = null;
	if (post.albumCoverUrl) {
		console.info("uploading album cover");
		// featuredMediaId = await uploadMediaToWordPress(
		// 	post.albumCoverUrl,
		// 	post.trackOrAlbumTitle || post.title,
		// 	post.trackOrAlbumTitle || post.title,
		// 	authTokenBase64,
		// 	wordpressEndpoint,
		// );
	}

	let title = "";
	if (post.featureType === "album") {
		title = `${post.artist} Releases Album [${post.trackOrAlbumTitle}]`;
	} else if (post.featureType === "mv") {
		title = `${post.artist} Releases Music Video '${post.trackOrAlbumTitle}'`;
	} else if (post.featureType === "track") {
		title = `${post.artist} Releases Single '${post.trackOrAlbumTitle}'`;
	} else {
		title = post.title;
	}

	const wpPost: WordPressPostPayload = {
		title: title,
		content: JSON.stringify(post, null, 2),
		status: "draft",
		featured_media: featuredMediaId ?? undefined,
	};

	console.log({ wpPost });

	return true;
	// try {
	// 	const response = await fetch(`${wordpressEndpoint}/wp/v2/posts`, {
	// 		method: "POST",
	// 		headers: {
	// 			"Content-Type": "application/json",
	// 			Authorization: `Basic ${authTokenBase64}`,
	// 		},
	// 		body: JSON.stringify(wpPost),
	// 	});

	// 	if (!response.ok) {
	// 		const errorText = await response.text();
	// 		console.error(
	// 			`Wordpress: failed to create post: ${response.status} - ${errorText}`,
	// 		);
	// 		return false;
	// 	}

	// 	const responseData = await response.json();
	// 	console.info(
	// 		`WordPress: post created successfully (ID: ${responseData.id}, Status: ${responseData.status}): ${responseData.link}`,
	// 	);
	// 	return true;
	// } catch (error) {
	// 	console.error("Error creating WordPress post:", error);
	// 	return false;
	// }
}
