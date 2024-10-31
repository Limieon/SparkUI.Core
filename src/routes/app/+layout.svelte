<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';

	import { page } from '$app/stores';

	import UserMenu from '$spark/UserMenu.svelte';

	import {
		House as IconHome,
		Type as IconText,
		Image as IconImage,
		Workflow as IconNode,
		Earth as IconBrowser,
		Download as IconDownloads,
		Settings as IconSettings,
		User as IconUser,
		LogOut as IconLogOut,
		Sun as IconSun,
		Moon as IconMoon,
		ChartArea as IconDashboard
	} from 'lucide-svelte/icons';

	const tabs = [
		{ name: 'Home', href: '/app/home', icon: IconHome },
		{ name: 'Text to Image', href: '/app/txt2img', icon: IconText },
		{ name: 'Image to Image', href: '/app/img2img', icon: IconImage },
		{ name: 'Node Editor', href: '/app/nodes', icon: IconNode }
	];

	let route = '/app/home';
	$effect(() => {
		route = $page.route.id || '/app/home';
	});

	let { data }: { data: PageServerData } = $props();
	const user = {
		name: data.user.username,
		email: data.user.email,
		avatar: `/api/v1/user/${data.user.sub}/avatar`,
		role: data.user.role
	};
</script>

<div class="bg-background_dark flex h-screen">
	<!-- Main content -->
	<div class="flex flex-1 flex-col">
		<!-- Header -->
		<header class="flex w-full items-end justify-between p-4 shadow">
			<!-- App Title and Version -->
			<div class="group flex h-full flex-row items-center space-x-4">
				<h1 class="text-4xl font-semibold">SparkUI ✨</h1>
			</div>

			<!-- User info (name and avatar) -->
			<UserMenu {...user} />
		</header>

		<div class="flex h-full flex-row">
			<div class="m-2 flex flex-col space-y-2 shadow-md">
				{#each tabs as tab}
					<Button href={tab.href} class="flex h-10 w-full items-center gap-2">
						<svelte:component this={tab.icon} /> {tab.name}</Button
					>
				{/each}
			</div>
			<div class="flex-1 rounded-tl-lg bg-background p-2 shadow-md">
				<slot />
			</div>
		</div>
	</div>
</div>
