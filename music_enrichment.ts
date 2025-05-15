// music_enrichment.ts
import { config } from "./config.ts";
import { ProcessedRedditPost } from "./reddit_client.ts";

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
  // We need to fetch album details for producers for a track, or use album endpoint
}

interface SpotifyAlbum {
    id: string;
    name: string;
    release_date: string;
    images: { url: string }[];
    artists: { name: string }[];
    external_urls: { spotify: string };
    label?: string; // Often contains producer info or label
    copyrights?: { text: string, type: string }[]; // Can contain producer info
    // Spotify API doesn't have a direct "producers" field.
    // It's often in copyrights, description, or requires searching credits if available.
}


let spotifyAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return spotifyAccessToken;
  }

  try {
    const response = await fetch(config.spotify.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(config.spotify.clientId + ":" + config.spotify.clientSecret),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`Spotify token error: ${response.status} ${await response.text()}`);
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

async function searchSpotify(query: string, type: "track" | "album", token: string): Promise<any> {
  const url = `${config.spotify.apiUrl}/search?q=${encodeURIComponent(query)}&type=${type}&limit=5&market=KR`; // Prioritize Korean market
  try {
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Spotify search error: ${response.status} ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error searching Spotify for ${type} "${query}":`, error);
    return null;
  }
}

// Fetch detailed album data to get more info like label/copyrights for producers
async function getSpotifyAlbumDetails(albumId: string, token: string): Promise<SpotifyAlbum | null> {
    const url = `${config.spotify.apiUrl}/albums/${albumId}?market=KR`;
    try {
        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error(`Spotify album details error: ${response.status} ${await response.text()}`);
        }
        return await response.json() as SpotifyAlbum;
    } catch (error) {
        console.error(`Error fetching Spotify album details for ID "${albumId}":`, error);
        return null;
    }
}


// Placeholder for parsing producer names from label/copyrights
function extractProducers(albumData: SpotifyAlbum): string[] {
    const producers = new Set<string>();
    // Spotify rarely has a direct "producer" field.
    // It's often embedded in copyright strings or sometimes label.
    // Example: (P) 2023 Stone Music Entertainment, Genie Music under license to XYZ Records, produced by John Doe
    // This requires careful regex and pattern matching based on observed data.
    const producerKeywords = ['produced by', 'producer:', '프로듀서:', '제작:'];

    if (albumData.copyrights) {
        for (const copyright of albumData.copyrights) {
            for (const keyword of producerKeywords) {
                if (copyright.text.toLowerCase().includes(keyword)) {
                    const parts = copyright.text.split(new RegExp(keyword, 'i'));
                    if (parts.length > 1) {
                        // Take the part after the keyword, split by common delimiters like ',', '&', 'and'
                        const potentialProducers = parts[1].split(/,|\s+and\s+|\s*&\s*/)[0].trim(); // Get first one for simplicity
                        if (potentialProducers && potentialProducers.length < 50) { // Basic sanity check
                             producers.add(potentialProducers.replace(/\.$/, '').trim()); // Remove trailing period
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
                 const parts = albumData.label.split(new RegExp(keyword, 'i'));
                 if (parts.length > 1) {
                    const potentialProducers = parts[1].split(/,|\s+and\s+|\s*&\s*/)[0].trim();
                     if (potentialProducers && potentialProducers.length < 50) {
                        producers.add(potentialProducers.replace(/\.$/, '').trim());
                    }
                 }
            }
        }
    }
    return Array.from(producers);
}


export async function enrichWithMusicData(post: ProcessedRedditPost): Promise<ProcessedRedditPost> {
  if (!post.artist || !post.trackOrAlbumTitle ||
      !['track', 'album', 'ep', 'mv'].includes(post.featureType!)) {
    return post; // Not a music release or missing key info
  }

  const token = await getSpotifyToken();
  if (!token) return post;

  const searchType = (post.featureType === 'track' || post.featureType === 'mv') ? 'track' : 'album';
  // Try to make search query more specific
  let query = `${post.artist} ${post.trackOrAlbumTitle}`;
  if (post.featureType === 'album' || post.featureType === 'ep') {
      query += ` album`; // Help Spotify differentiate album searches
  }


  const searchResults = await searchSpotify(query, searchType, token);

  if (!searchResults) return post;


  let foundItem: SpotifyTrack | SpotifyAlbum | null = null;
  if (searchType === 'track' && searchResults.tracks && searchResults.tracks.items.length > 0) {
      // Add logic to pick the best match, e.g., exact title match, primary artist match
      foundItem = searchResults.tracks.items[0] as SpotifyTrack; // Simplistic: take first result
      if (foundItem) {
        post.spotifyLink = foundItem.external_urls.spotify;
        post.releaseDate = (foundItem as SpotifyTrack).album.release_date;
        post.albumCoverUrl = (foundItem as SpotifyTrack).album.images?.[0]?.url;

        // For track, get album details for producer info
        const albumDetails = await getSpotifyAlbumDetails((foundItem as SpotifyTrack).album.id, token);
        if (albumDetails) {
            post.producers = extractProducers(albumDetails);
            if (!post.albumCoverUrl) post.albumCoverUrl = albumDetails.images?.[0]?.url; // Fallback cover
            if (!post.releaseDate) post.releaseDate = albumDetails.release_date; // Fallback release date
        }
      }
  } else if (searchType === 'album' && searchResults.albums && searchResults.albums.items.length > 0) {
      foundItem = searchResults.albums.items[0] as SpotifyAlbum; // Simplistic: take first result
      if (foundItem) {
        post.spotifyLink = foundItem.external_urls.spotify;
        post.releaseDate = foundItem.release_date;
        post.albumCoverUrl = foundItem.images?.[0]?.url;
        // For album, producers can be extracted directly if logic is good
        const albumDetails = await getSpotifyAlbumDetails(foundItem.id, token); // Re-fetch for full details if needed
        if (albumDetails) {
            post.producers = extractProducers(albumDetails);
             // Override with potentially more detailed info
            post.albumCoverUrl = albumDetails.images?.[0]?.url || post.albumCoverUrl;
            post.releaseDate = albumDetails.release_date || post.releaseDate;
        }
      }
  }


  // TODO: Add Apple Music enrichment if needed (similar flow: auth, search, parse)
  // This would involve using the Apple Music API.

  // For description, Spotify API doesn't provide a good one.
  // Could use the track/album name or leave for GPT.
  // post.description = `Listen to ${post.trackOrAlbumTitle} by ${post.artist}.`;

  return post;
}

// TODO: Apple Music API integration would follow a similar pattern:
// 1. Get Developer Token (can be generated and long-lived, or short-lived and refreshed)
// 2. Search API: https://developer.apple.com/documentation/applemusicapi/search_for_catalog_resources
// 3. Parse results for release date, artwork, etc. Producers are also hard to find.