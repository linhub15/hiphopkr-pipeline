import { fetch } from "@tauri-apps/plugin-http";
import { APP_CONSTANTS } from "./constants.ts";
import { getConfig } from "./db.ts";
import type { ProcessedRedditPost } from "./reddit_client.ts";

interface SpotifyTrack {
	id: string;
	name: string;
	album: {
		id: string;
		name: string;
		release_date: string;
		images: { url: string }[];
		album_type: string;
	};
	artists: { name: string }[];
	external_urls: { spotify: string };
}

interface SpotifyAlbum {
	id: string;
	name: string;
	release_date: string;
	images: { url: string }[];
	artists: { name: string }[];
	external_urls: { spotify: string };
	label?: string; // Often contains producer info or label
	copyrights?: { text: string; type: string }[]; // Can contain producer info
}

let spotifyAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;

async function getSpotifyToken(): Promise<string | null> {
	const config = await getConfig();

	if (spotifyAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
		return spotifyAccessToken;
	}

	try {
		const response = await fetch(APP_CONSTANTS.spotify.token_url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa(
					`${config?.spotify_client_id}:${config?.spotify_client_secret}`,
				)}`,
			},
			body: "grant_type=client_credentials",
		});

		if (!response.ok) {
			throw new Error(
				`Spotify token error: ${response.status} ${await response.text()}`,
			);
		}
		const data = await response.json();
		spotifyAccessToken = data.access_token;
		tokenExpiryTime = Date.now() + (data.expires_in - 300) * 1000; // Refresh 5 mins before expiry
		return spotifyAccessToken;
	} catch (error) {
		console.error("Error getting Spotify token:", error);
		spotifyAccessToken = null;
		return null;
	}
}

async function searchSpotify(
	query: string,
	type: "track" | "album",
	token: string,
): Promise<SpotifyApi.SearchResponse> {
	const url = `${APP_CONSTANTS.spotify.api_url}/search?q=${encodeURIComponent(
		query,
	)}&type=${type}&limit=5&market=KR`; // Prioritize Korean market
	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!response.ok) {
			throw new Error(
				`Spotify search error: ${response.status} ${await response.text()}`,
			);
		}
		return (await response.json()) as SpotifyApi.SearchResponse; // Added type assertion
	} catch (error) {
		console.error(`Error searching Spotify for ${type} "${query}":`, error);
		return { tracks: { items: [] }, albums: { items: [] } }; // Return a default structure on error
	}
}

// Fetch detailed album data to get more info like label/copyrights for producers
async function getSpotifyAlbumDetails(
	albumId: string,
	token: string,
): Promise<SpotifyAlbum | null> {
	const url = `${APP_CONSTANTS.spotify.api_url}/albums/${albumId}?market=KR`;
	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!response.ok) {
			throw new Error(
				`Spotify album details error: ${response.status} ${await response.text()}`,
			);
		}
		return (await response.json()) as SpotifyAlbum;
	} catch (error) {
		console.error(
			`Error fetching Spotify album details for ID "${albumId}":`,
			error,
		);
		return null;
	}
}

function extractProducers(albumData: SpotifyAlbum): string[] {
	const producers = new Set<string>();
	// Spotify rarely has a direct "producer" field.
	// It's often embedded in copyright strings or sometimes label.
	// Example: (P) 2023 Stone Music Entertainment, Genie Music under license to XYZ Records, produced by John Doe
	// This requires careful regex and pattern matching based on observed data.
	const producerKeywords = ["produced by", "producer:", "프로듀서:", "제작:"];

	if (albumData.copyrights) {
		for (const copyright of albumData.copyrights) {
			for (const keyword of producerKeywords) {
				if (copyright.text.toLowerCase().includes(keyword)) {
					const parts = copyright.text.split(new RegExp(keyword, "i"));
					if (parts.length > 1) {
						// Take the part after the keyword, split by common delimiters like ',', '&', 'and'
						const potentialProducers = parts[1]
							.split(/,|\s+and\s+|\s*&\s*/)[0]
							.trim(); // Get first one for simplicity
						if (potentialProducers && potentialProducers.length < 50) {
							// Basic sanity check
							producers.add(potentialProducers.replace(/\.$/, "").trim()); // Remove trailing period
						}
					}
				}
			}
		}
	}
	// Sometimes in label if it's self-produced or small label
	if (albumData.label) {
		for (const keyword of producerKeywords) {
			if (albumData.label.toLowerCase().includes(keyword)) {
				const parts = albumData.label.split(new RegExp(keyword, "i"));
				if (parts.length > 1) {
					const potentialProducers = parts[1]
						.split(/,|\s+and\s+|\s*&\s*/)[0]
						.trim();
					if (potentialProducers && potentialProducers.length < 50) {
						producers.add(potentialProducers.replace(/\.$/, "").trim());
					}
				}
			}
		}
	}
	return Array.from(producers);
}

export async function enrichWithMusicData(
	post: ProcessedRedditPost,
): Promise<ProcessedRedditPost> {
	const token = await getSpotifyToken();

	if (!token) return post;

	// Determine search query and type
	let query = "";
	let searchType: "track" | "album" = "track";

	if (post.artist && post.trackOrAlbumTitle) {
		query = `${post.artist} ${post.trackOrAlbumTitle}`;
		if (post.featureType === "album" || post.featureType === "ep") {
			searchType = "album";
		}
	} else if (post.title) {
		// Fallback to title parsing - this is less reliable
		// Simple regex to find Artist - Title patterns, can be improved
		const match = post.title.match(/([^-]+)-([^[(]+)/);
		if (match?.[1] && match[2]) {
			post.artist = match[1].trim();
			post.trackOrAlbumTitle = match[2].trim();
			query = `${post.artist} ${post.trackOrAlbumTitle}`;
			// Guess type based on keywords in title - very basic
			if (
				post.title.toLowerCase().includes("album") ||
				post.title.toLowerCase().includes("ep")
			) {
				searchType = "album";
			}
		} else {
			return post; // Not enough info to search
		}
	}

	if (!query) return post;

	const searchResults = await searchSpotify(query, searchType, token);

	if (
		searchType === "track" &&
		searchResults.tracks &&
		searchResults.tracks.items.length > 0
	) {
		const track = searchResults.tracks.items[0] as SpotifyTrack; // Assuming first result is best
		post.artist = track.artists.map((a) => a.name).join(", ");
		post.trackOrAlbumTitle = track.name;
		post.releaseDate = track.album.release_date;
		post.albumCoverUrl = track.album.images?.[0]?.url;
		post.spotifyLink = track.external_urls.spotify;
		post.featureType = track.album.album_type === "album" ? "album" : "track"; // Or map more granularly

		// Fetch full album details for producers for this track's album
		const albumDetails = await getSpotifyAlbumDetails(track.album.id, token);
		if (albumDetails) {
			post.producers = extractProducers(albumDetails);
			if (!post.albumCoverUrl) {
				post.albumCoverUrl = albumDetails.images?.[0]?.url; // Fallback if track album art missing
			}
		}
	} else if (
		searchType === "album" &&
		searchResults.albums &&
		searchResults.albums.items.length > 0
	) {
		const album = searchResults.albums.items[0] as SpotifyAlbum; // Assuming first result is best
		post.artist = album.artists.map((a) => a.name).join(", ");
		post.trackOrAlbumTitle = album.name;
		post.releaseDate = album.release_date;
		post.albumCoverUrl = album.images?.[0]?.url;
		post.spotifyLink = album.external_urls.spotify;
		post.featureType = "album"; // Or map more granularly
		post.producers = extractProducers(album);
		post.spotifyData =
			(await getSpotifyAlbumDetails(album.id, token)) ?? undefined;
	}

	return post;
}

// Define Spotify API response types (simplified)
// You might want to use a library or more detailed types for Spotify API
namespace SpotifyApi {
	export interface Image {
		url: string;
		height?: number;
		width?: number;
	}

	export interface ExternalUrls {
		spotify: string;
	}

	export interface Artist {
		name: string;
		external_urls: ExternalUrls;
		id: string;
	}

	export interface AlbumBase {
		id: string;
		name: string;
		album_type: string;
		release_date: string;
		images: Image[];
		external_urls: ExternalUrls;
		artists: Artist[];
	}

	export interface Track extends AlbumBase {
		// Track object often includes album info
		album: AlbumBase;
		popularity?: number;
	}

	export interface Album extends AlbumBase {
		label?: string;
		copyrights?: { text: string; type: string }[];
	}

	export interface SearchResponse {
		tracks?: { items: Track[] };
		albums?: { items: Album[] };
	}
}
