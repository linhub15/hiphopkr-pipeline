import Database from "@tauri-apps/plugin-sql";
import type { RedditPost } from "./reddit_post.type";
import type { Config } from "./config.type";

const DB_PATH = "sqlite:test.db";
const reddit_posts = "reddit_posts";

export async function initDb() {
	const db = await Database.load(DB_PATH);

	await db.execute(
		`
CREATE TABLE IF NOT EXISTS ${reddit_posts} (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	reddit_link TEXT NOT NULL,
	flair TEXT NOT NULL,
	posted_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	data TEXT NOT NULL
);`,
	);
	await db.execute(
		`
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY,
	wordpress_username TEXT NOT NULL,
	wordpress_password TEXT NOT NULL,
	wordpress_endpoint TEXT NOT NULL,
	spotify_client_id TEXT NOT NULL,
	spotify_client_secret TEXT NOT NULL
);`,
	);

	await db.close();
}

export async function getConfig() {
	const db = await Database.load(DB_PATH);
	const result = await db.select<
		{
			wordpress_username: string;
			wordpress_password: string;
			wordpress_endpoint: string;
			spotify_client_id: string;
			spotify_client_secret: string;
		}[]
	>(
		"SELECT wordpress_username, wordpress_password, wordpress_endpoint, spotify_client_id, spotify_client_secret FROM config",
	);
	await db.close();

	if (result.length === 0) {
		return null;
	}

	return result[0];
}

export async function setConfig(config: Config) {
	const db = await Database.load(DB_PATH);
	await db.execute(
		`
		INSERT INTO config (
			id,
			wordpress_username,
			wordpress_password,
			wordpress_endpoint,
			spotify_client_id,
			spotify_client_secret
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
		  id = 1,
			wordpress_username = excluded.wordpress_username,
			wordpress_password = excluded.wordpress_password,
			wordpress_endpoint = excluded.wordpress_endpoint,
			spotify_client_id = excluded.spotify_client_id,
			spotify_client_secret = excluded.spotify_client_secret
		`,
		[
			1,
			config.wordpress_username,
			config.wordpress_password,
			config.wordpress_endpoint,
			config.spotify_client_id,
			config.spotify_client_secret,
		],
	);
	await db.close();
}

export async function listRedditPosts(): Promise<RedditPost[]> {
	const db = await Database.load(DB_PATH);
	const result = await db.select<
		{
			id: string;
			title: string;
			reddit_link: string;
			flair: string;
			posted_at: number;
			created_at: number;
			data: string;
		}[]
	>(`SELECT * FROM ${reddit_posts} order by posted_at desc`);
	await db.close();

	const posts: RedditPost[] = result.map((row) => ({
		id: row.id,
		title: row.title,
		reddit_link: row.reddit_link,
		flair: row.flair,
		posted_at: new Date(row.posted_at),
		created_at: new Date(row.created_at),
		data: JSON.parse(row.data),
	}));

	return posts;
}

export async function listRedditPostsById(
	ids: string[],
): Promise<RedditPost[]> {
	const db = await Database.load(DB_PATH);
	const result = await db.select<
		{
			id: string;
			title: string;
			reddit_link: string;
			flair: string;
			posted_at: number;
			created_at: number;
			data: string;
		}[]
	>(
		`SELECT * FROM ${reddit_posts} WHERE id IN (${ids.map(() => "?").join(",")})`,
		ids,
	);
	await db.close();

	const posts: RedditPost[] = result.map((row) => ({
		id: row.id,
		title: row.title,
		reddit_link: row.reddit_link,
		flair: row.flair,
		posted_at: new Date(row.posted_at),
		created_at: new Date(row.created_at),
		data: JSON.parse(row.data),
	}));

	return posts;
}

export async function listRedditPostIds(): Promise<Set<string>> {
	const db = await Database.load(DB_PATH);
	const result = await db.select<{ id: string }[]>(
		`SELECT id FROM ${reddit_posts}`,
	);
	await db.close();

	const ids = new Set(result.map((row) => row.id));
	console.info(`selected ${ids.size} ids from db.`);
	return ids;
}

export async function saveRedditPost(post: RedditPost) {
	console.info("listRedditPosts", { post });

	const db = await Database.load(DB_PATH);
	await db.execute(
		`
		INSERT INTO ${reddit_posts}
		(
			id,
			title,
			reddit_link,
			flair,
			posted_at,
			created_at,
			data
		)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
		[
			post.id,
			post.title,
			post.reddit_link,
			post.flair,
			post.posted_at.valueOf(),
			post.created_at.valueOf(),
			post.data ? JSON.stringify(post.data) : {},
		],
	);
	await db.close();
}
