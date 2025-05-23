import { Button } from "@/components/ui/button";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
	component: () => (
		<>
			<div className="flex flex-col h-screen bg-neutral-900">
				<nav className=" text-white p-4">
					<div className="flex gap-4">
						<Link to="/">
							<Button variant="outline">🏠 Pipeline Control</Button>
						</Link>

						<Link to="/configuration">
							<Button variant="outline">⚙️ Configuration</Button>
						</Link>
					</div>
				</nav>

				<main className="overflow-auto bg-neutral-950 rounded-t-4xl p-8 h-full">
						<Outlet />
				</main>
			</div>
			<TanStackRouterDevtools />
		</>
	),
});
