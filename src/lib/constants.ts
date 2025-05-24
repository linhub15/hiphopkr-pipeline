export const APP_CONSTANTS = {
	reddit: {
		subreddit_url: new URL("https://www.reddit.com/r/khiphop/new.json"),
		allowed_flairs: ["Music Video", "Album", "News", "Audio"],
		fetch_limit: 100,
	},
	spotify: {
		token_url: "https://accounts.spotify.com/api/token",
		api_url: "https://api.spotify.com/v1",
	},
};
