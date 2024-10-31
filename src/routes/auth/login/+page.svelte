<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();

	let isLogin = $state(true);

	function toggleLogin() {
		isLogin = !isLogin;
	}
</script>

<div class="flex h-screen flex-col md:flex-row">
	<!-- Left section with gradient background -->
	<div
		class="flex w-full items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 p-8 md:w-1/2"
	>
		<div class="w-full max-w-md">
			<h1 class="mb-8 text-center text-4xl font-bold text-white">
				{isLogin ? 'Welcome Back' : 'Create Account'}
			</h1>
			<div class="rounded-lg bg-white/10 p-8 backdrop-blur-lg">
				{#if isLogin}
					<form method="post" action="?/login" class="space-y-4" use:enhance>
						<div>
							<Label for="email" class="text-white">Email</Label>
							<Input
								id="email"
								type="email"
								name="email"
								placeholder="Enter your email"
								class="bg-white/20 text-white placeholder:text-gray-200"
							/>
						</div>
						<div>
							<Label for="password" class="text-white">Password</Label>
							<Input
								id="password"
								type="password"
								name="password"
								placeholder="Enter your password"
								class="bg-white/20 text-white placeholder:text-gray-200"
							/>
						</div>
						<Button type="submit" class="w-full bg-white text-purple-600 hover:bg-gray-100"
							>Log In</Button
						>
					</form>
				{:else}
					<form method="post" action="?/register" class="space-y-4" use:enhance>
						<div>
							<Label for="username" class="text-white">Name</Label>
							<Input
								id="username"
								name="username"
								placeholder="Enter your username"
								class="bg-white/20 text-white placeholder:text-gray-200"
							/>
						</div>
						<div>
							<Label for="email" class="text-white">Email</Label>
							<Input
								id="email"
								type="email"
								name="email"
								placeholder="Enter your email"
								class="bg-white/20 text-white placeholder:text-gray-200"
							/>
						</div>
						<div>
							<Label for="password" class="text-white">Password</Label>
							<Input
								id="password"
								type="password"
								name="password"
								placeholder="Create a password"
								class="bg-white/20 text-white placeholder:text-gray-200"
							/>
						</div>
						<Button type="submit" class="w-full bg-white text-purple-600 hover:bg-gray-100"
							>Sign Up</Button
						>
					</form>
				{/if}
			</div>
		</div>
	</div>

	<!-- Right section with gray background and abstract shapes -->
	<div
		class="relative flex w-full items-center justify-center overflow-hidden bg-gray-100 p-8 md:w-1/2"
	>
		<!-- 2 Circles -->
		<svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
			<circle cx="20" cy="20" r="20" fill="#6366f1" opacity="0.5" />
			<circle cx="80" cy="80" r="30" fill="#8b5cf6" opacity="0.5" />
			<path d="M0 100 L100 0 L100 100 Z" fill="#d946ef" opacity="0.5" />
		</svg>

		<div class="z-10 text-center">
			<h2 class="mb-4 text-3xl font-bold text-gray-800">
				{isLogin ? "Don't have an account?" : 'Already have an account?'}
			</h2>
			<p class="mb-8 text-gray-600">
				{isLogin ? 'Sign up now to access all features!' : 'Log in to continue your journey!'}
			</p>
			<Button on:click={toggleLogin} variant="outline" class="bg-white">
				{isLogin ? 'Sign Up' : 'Log In'}
			</Button>
		</div>
	</div>
</div>

<p style="color: red">{form?.message ?? ''}</p>
