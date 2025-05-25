import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveConfig } from "@/features/use_save_config";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import type { Config } from "@/lib/config.type";
import { useConfig } from "@/features/use_config";

export const Route = createFileRoute("/configuration")({
	component: Configuration,
});

function Configuration() {
	const config = useConfig();
	const saveConfig = useSaveConfig();

	const form = useForm({
		defaultValues: {
			wordpress_endpoint:
				config.data?.wordpress_endpoint || "https://hiphopkr.com/wp-json",
			wordpress_username: config.data?.wordpress_username || "",
			wordpress_password: config.data?.wordpress_password || "",
			spotify_client_id: config.data?.spotify_client_id || "",
			spotify_client_secret: config.data?.spotify_client_secret || "",
		} satisfies Config,
		onSubmit: async ({ value }) => {
			value.wordpress_password = value.wordpress_password.replace(/\s+/g, "");
			await saveConfig.mutateAsync(value);
		},
	});

	return (
		<>
			<form
				onSubmit={async (e) => {
					e.stopPropagation();
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-col gap-6 max-w-lg">
					<form.Field name="wordpress_endpoint">
						{(field) => (
							<div className="space-y-3">
								<Label>Wordpress Endpoint</Label>
								<Input
									type="text"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="wordpress_username">
						{(field) => (
							<div className="space-y-3">
								<Label>Wordpress Username</Label>
								<Input
									type="text"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="wordpress_password">
						{(field) => (
							<div className="space-y-3">
								<Label>Wordpress Password</Label>
								<Input
									type="password"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="spotify_client_id">
						{(field) => (
							<div className="space-y-3">
								<Label>Spotify Client ID</Label>
								<Input
									type="text"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="spotify_client_secret">
						{(field) => (
							<div className="space-y-3">
								<Label>Spotify Client Secret</Label>
								<Input
									type="text"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
								/>
							</div>
						)}
					</form.Field>

					<div className="flex justify-end">
						{saveConfig.isPending && (
							<span className="text-sm text-neutral-400">Saving...</span>
						)}
						<Button type="submit">Save</Button>
					</div>
				</div>
			</form>
		</>
	);
}
