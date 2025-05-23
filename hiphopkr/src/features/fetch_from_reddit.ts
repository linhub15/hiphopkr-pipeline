import { APP_CONSTANTS } from "@/lib/constants";
import { listRedditPostIds, saveRedditPost } from "@/lib/db";
import { enrichWithMusicData } from "@/lib/music_enrichment";
import { extractNewsContent } from "@/lib/news_content_extractor";
import {
	fetchRedditPosts,
	type ProcessedRedditPost,
} from "@/lib/reddit_client";
import type { RedditPost } from "@/lib/reddit_post.type";

export async function fetchFromReddit() {
	const processedPostIds = await listRedditPostIds();

	const posts = await pullFromReddit();

	const postsToProcess = filterPostsToProcess(processedPostIds, posts);

	for (const post of postsToProcess) {
		const enriched = await enrichPost(post);

		const redditPost: RedditPost = {
			id: enriched.id,
			title: enriched.title,
			reddit_link: enriched.redditLink,
			flair: enriched.flair || "",
			posted_at: enriched.posted_utc,
			created_at: Date.now(),
			data: JSON.stringify(enriched),
		};

		await saveRedditPost(redditPost);
	}
}

async function pullFromReddit() {
	const redditPosts = await fetchRedditPosts(
		APP_CONSTANTS.reddit.subreddit_url,
		APP_CONSTANTS.reddit.fetch_limit,
	);

	console.info(`Fetched ${redditPosts.length} posts from Reddit.`);

	return redditPosts;
}

function filterPostsToProcess(
	processedPostIds: Set<string>,
	redditPosts: ProcessedRedditPost[],
) {
	const postsToProcess: ProcessedRedditPost[] = [];
	for (const post of redditPosts) {
		if (processedPostIds.has(post.id)) {
			continue;
		}
		postsToProcess.push(post);
	}

	if (postsToProcess.length === 0) {
		console.info(
			"No new posts to process after filtering already processed ones.",
		);
	}

	return postsToProcess;
}

async function enrichPost(post: ProcessedRedditPost) {
	if (
		post.featureType &&
		["track", "album", "ep", "mv"].includes(post.featureType)
	) {
		return await enrichWithMusicData(post);
	}

	if (post.featureType === "news" || post.featureType === "rumor") {
		return await extractNewsContent(post);
	}

	return post;
}
