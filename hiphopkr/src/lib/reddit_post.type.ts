export interface RedditPost {
	id: string;
	title: string;
	reddit_link: string;
	flair: string;
	posted_at: Date;
	created_at: Date;
	data: JSON;
}
