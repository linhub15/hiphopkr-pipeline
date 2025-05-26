import { Button } from "@/components/ui/button";
import { useLogs } from "@/features/use_logs";
import { log } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/debug")({
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const logs = useLogs();

	const ping = async () => {
		await log("info", "ping");
		await queryClient.invalidateQueries({ queryKey: ["logs"] });
	};

	return (
		<div className="flex flex-col gap-8">
			<div>
				<Button onClick={ping}>Ping</Button>
			</div>
			<div className="font-mono">
				{logs.data?.map((log) => (
					<div key={log.created_at.getTime()}>
						[{new Date(log.created_at).toISOString()}] {log.message}
						<br />
					</div>
				))}
			</div>
		</div>
	);
}
