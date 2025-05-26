import { Button } from "@/components/ui/button";
import { useClearPosts } from "@/features/use_clear_posts";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		component: () => {
			const clearPosts = useClearPosts();

			return (
				<>
					<div className="flex flex-col h-screen bg-neutral-900">
						<nav className="p-4">
							<div className="flex justify-between">
								<div className="flex gap-4">
									<Link to="/">
										<Button variant="outline">🏠 Pipeline Control</Button>
									</Link>

									<Link to="/configuration">
										<Button variant="outline">⚙️ Configuration</Button>
									</Link>

									<Link to="/debug">
										<Button variant="ghost">Debug</Button>
									</Link>
								</div>
								<Button
									variant="destructive"
									onClick={() => clearPosts.mutateAsync()}
								>
									Clear posts
								</Button>
							</div>
						</nav>

						<main className="overflow-auto bg-neutral-950 rounded-t-4xl p-8 h-full">
							<Outlet />
						</main>
					</div>
					<TanStackRouterDevtools />
				</>
			);
		},
	},
);
