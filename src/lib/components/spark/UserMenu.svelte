<script lang="ts">
	import { Separator } from '$ui/separator';
	import { Button } from '$ui/button';

	import { toggleMode, mode } from 'mode-watcher';
	import { quintInOut } from 'svelte/easing';
	import { fade, blur, fly } from 'svelte/transition';

	import {
		Settings as IconSettings,
		User as IconUser,
		LogOut as IconLogOut,
		Sun as IconSun,
		Moon as IconMoon,
		ChartArea as IconDashboard
	} from 'lucide-svelte/icons';

	export let open = false;
	export let name: string;
	export let avatar: string;
	export let role: string;

	const tabs = [
		{ name: 'Profile', href: `/user/@${name}/profile`, icon: IconUser },
		{ name: 'Manage Account', href: '/user/manage', icon: IconSettings }
	];

	let node: any;
	function onClickOutside(e: any) {
		if (open && node && !node.contains(e.target)) open = false;
	}
</script>

<svelte:window onclick={onClickOutside} />

<div class="relative" bind:this={node}>
	<button
		class="flex items-center space-x-4 rounded-full px-4 py-2 hover:cursor-pointer hover:bg-background"
		onclick={() => {
			open = !open;
		}}
	>
		<span class="text-xl">{name}</span>
		<img src={avatar} alt="Avatar" class="aspect-square h-10 rounded-full" />
	</button>
	{#if open}
		<div
			class="absolute right-0 mt-2 w-64 rounded-md bg-gradient-to-br from-background p-4 shadow-2xl backdrop-blur-lg backdrop-filter"
			transition:fly={{ x: 15, y: -15, duration: 100, easing: quintInOut }}
		>
			<div
				class="flex flex-col space-y-2"
				role="menu"
				aria-orientation="vertical"
				aria-labelledby="options-menu"
			>
				{#each tabs as tab}
					<Button
						href={tab.href}
						variant="ghost"
						centerItems={false}
						class="flex w-full items-center py-6 text-sm"
					>
						<svelte:component this={tab.icon} class="mr-2" />
						{tab.name}
					</Button>
				{/each}

				<Button
					onclick={toggleMode}
					variant="ghost"
					centerItems={false}
					class="flex w-full items-center py-6 text-sm"
				>
					{#if $mode === 'dark'}
						<IconMoon class="mr-2" />
					{:else}
						<IconSun class="mr-2" />
					{/if}
					<span>Toggle Theme</span>
				</Button>

				<Separator />

				<Button
					href="/auth/logout"
					variant="ghost"
					centerItems={false}
					class="flex w-full items-center py-6 text-sm text-destructive hover:text-destructive"
				>
					<IconLogOut class="mr-2" />
					Logout
				</Button>

				{#if role === 'admin'}
					<Separator />
					<Button
						variant="ghost"
						centerItems={false}
						class="flex w-full items-center py-6 text-sm"
						href="/admin/dashboard"
					>
						<IconDashboard class="mr-2" />
						Admin Dashboard
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>
