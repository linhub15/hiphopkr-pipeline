import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRedditPosts } from "@/features/use_reddit_posts";
import { useFetchRedditPosts } from "@/features/use_fetch_reddit_posts";
import { Badge } from "@/components/ui/badge";
import { usePublishDrafts } from "@/features/use_publish_drafts";
import { useConfig } from "@/features/use_config";
import { useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const posts = useRedditPosts();
	const config = useConfig();
	const fetchRedditPosts = useFetchRedditPosts();
	const publishDrafts = usePublishDrafts();
	const [selected, setSelected] = useState<string[]>([]);

	const publish = async () => {
		if (!config.data) {
			alert("Please configure your WordPress settings first.");
			return;
		}

		await publishDrafts.mutateAsync({
			postIds: selected,
			wordpressEndpoint: config.data?.wordpress_endpoint,
			wordpressUsername: config.data?.wordpress_username,
			wordpressPassword: config.data?.wordpress_password,
		});

		setSelected([]);
	};

	const toggle = (postId: string, checked: CheckedState) => {
		if (checked) {
			setSelected((prev) => [...prev, postId]);
		} else {
			setSelected((prev) => prev.filter((id) => id !== postId));
		}
	};

	return (
		<div>
			<div className="flex justify-between">
				<div className="flex items-center gap-4">
					<Button
						variant="secondary"
						onClick={() => fetchRedditPosts.mutateAsync()}
					>
						Fetch Reddit Posts
					</Button>
					{fetchRedditPosts.isPending && (
						<span className="text-sm text-neutral-400">Fetching...</span>
					)}
				</div>
				<Button onClick={publish}>Publish X drafts</Button>
			</div>

			<div className="py-8 space-y-2">
				{posts.data?.map((post) => (
					<label
						key={post.id}
						className="flex rounded-xl hover:bg-neutral-900 hover:cursor-pointer justify-between items-center p-4"
						htmlFor={post.id}
					>
						<div className="flex items-center gap-6">
							<Checkbox
								id={post.id}
								onCheckedChange={(checked) => toggle(post.id, checked)}
							/>
							<div className="select-none">
								<div className="text-lg font-semibold w-full">
									<h3 className="inline-flex items-center gap-2">
										<Badge>{post.flair}</Badge>
										{post.title}
									</h3>
									<div className="flex gap-4 items-center py-1 text-sm text-neutral-400">
										<span>Posted: {post.posted_at.toLocaleDateString()}</span>
									</div>
								</div>
							</div>
						</div>
					</label>
				))}
			</div>
		</div>
	);
}
