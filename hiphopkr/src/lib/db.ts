import Database from "@tauri-apps/plugin-sql";
import type { RedditPost } from "./reddit_post.type";
import type { Config } from "./config.type";

const DB_PATH = "sqlite:test.db";

export async function initDb() {
	const db = await Database.load(DB_PATH);

	await db.execute(
		`
CREATE TABLE IF NOT EXISTS reddit_posts (
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
		"SELECT wordpress_username, wordpress_password, wordpress_endpoint, spotify_client_id, spotify_client_secret FROM config WHERE id = 1",
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
		INSERT OR REPLACE INTO config (wordpress_username, wordpress_password, wordpress_endpoint, spotify_client_id, spotify_client_secret)
		VALUES (?, ?, ?, ?, ?)
		`,
		[
			config.wordpress_username,
			config.wordpress_password,
			config.wordpress_endpoint,
			config.spotify_client_id,
			config.spotify_client_secret,
		],
	);
	await db.close();
}

export async function listRedditPostIds(): Promise<Set<string>> {
	const db = await Database.load(DB_PATH);
	const result = await db.select<{ id: string }[]>(
		"SELECT id FROM reddit_posts",
	);
	await db.close();

	const ids = new Set(result.map((row) => row.id));
	return ids;
}

export async function saveRedditPost(post: RedditPost) {
	const db = await Database.load(DB_PATH);
	await db.execute(
		`
		INSERT INTO reddit_posts (id, title, reddit_link, flair, posted_at, created_at, data)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
		[
			post.id,
			post.title,
			post.reddit_link,
			post.flair,
			post.posted_at,
			post.created_at,
			post.data,
		],
	);
	await db.close();
}
