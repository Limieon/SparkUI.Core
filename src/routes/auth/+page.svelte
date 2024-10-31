<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<h1>Hi, {data.user.username}!</h1>
<p>Your user id: {data.user.sub}</p>

<form method="post" action="?/logout">
	<button>Sign out</button>
</form>
