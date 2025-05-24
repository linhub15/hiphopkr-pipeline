import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listRedditPostIds } from "@/lib/db";
import { useRedditPosts } from "@/features/use_reddit_posts";

interface ProcessedRedditPost {
	id: string;
	title: string;
	featureType?: string;
	artist?: string;
}

const posts = [
	{
		id: "1",
		title: "Post 1",
		featureType: "Feature Type 1",
		artist: "Artist 1",
	},
	{
		id: "2",
		title: "Post 2",
		featureType: "Feature Type 2",
		artist: "Artist 2",
	},
];

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const posts2 = useRedditPosts();
	return (
		<div>
			<div className="flex justify-between">
				<div className="flex items-center gap-4">
					<Button variant="secondary" onClick={() => listRedditPostIds()}>
						Fetch Reddit Posts
					</Button>{" "}
					<span>fetching...</span>
				</div>

				<Button>Publish X drafts</Button>
			</div>
			{JSON.stringify(posts2.data)}

			<div className="py-8 space-y-2">
				{posts.map((post) => (
					<label
						key={post.id}
						className="flex rounded-xl hover:bg-neutral-900 hover:cursor-pointer justify-between items-center p-4"
						htmlFor={post.id}
					>
						<div className="flex items-center gap-6">
							<Checkbox id={post.id} />
							<div className="select-none">
								<div className="text-lg font-semibold w-full">
									{post.title}
									<p className="text-sm text-neutral-400">
										{post.featureType} by {post.artist}
									</p>
								</div>
							</div>
						</div>
					</label>
				))}
			</div>
		</div>
	);
}
