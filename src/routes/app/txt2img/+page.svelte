<script lang="ts">
	import { Switch } from '$ui/switch';
	import { Checkbox } from '$ui/checkbox';
	import { Label } from '$ui/label';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Progress } from '$ui/progress';
	import { Textarea } from '$ui/textarea';
	import { Separator } from '$ui/separator';
	import * as Dropdown from '$ui/dropdown-menu';
	import * as Popover from '$ui/popover';
	import * as Command from '$ui/command';

	import {
		Zap as IconZap,
		X as IconX,
		Trash2 as IconTrash,
		Timer as IconTimer,
		CircleGauge as IconSpeed,
		LoaderCircle as IconProgress,
		Shuffle as IconShuffle
	} from 'lucide-svelte/icons';

	let comboSamplerOpen = false;
	let selectedSampler = undefined;

	const schedulers = [
		'Euler A',
		'DPM++ 2M',
		'DPM++ 2M Karras',
		'DPM++ 2M Exponential',
		'DPM++ 2M Exponential Karras'
	];
</script>

<div class="flex h-full flex-row space-x-2">
	<div
		class="bg-background_dark flex-1 flex-nowrap space-y-2 rounded-xl border-2 border-border p-2"
	>
		<div class="flex items-center justify-between">
			<div class="flex">
				<Button class="max-w-52 flex-grow px-8 py-6 text-2xl font-bold">Generate</Button>
				<Button variant="secondary" class="h-12 w-12" size="icon"><IconZap /></Button>
			</div>

			<div class="flex space-x-2">
				<Label for="num_batchSize" class="flex items-center justify-center text-center">
					Batch Size:
				</Label>
				<Input
					id="num_batchSize"
					type="number"
					class="w-14 pr-0 text-center"
					min={1}
					max={9}
					value={4}
				/>
			</div>

			<div class="flex">
				<Button variant="destructive" class="h-12 w-12" size="icon"><IconX /></Button>
				<Button variant="destructive" class="h-12 w-12" size="icon"><IconTrash /></Button>
			</div>
		</div>

		<div class="flex h-fit flex-col space-y-1 px-2">
			<Progress class="w-full" />
			<div class="flex">
				<span class="flex flex-grow flex-row space-x-2 text-nowrap">
					<IconSpeed />
					<p>27 It/s</p>
				</span>
				<span class="flex flex-grow flex-row space-x-2 text-nowrap">
					<IconTimer />
					<p>0:42 left</p>
				</span>
				<span class="flex flex-row space-x-2 text-nowrap">
					<IconProgress />
					<p>19/95</p>
				</span>
			</div>
		</div>

		<Separator />

		<div>
			<h2>Prompt Settings</h2>
			<Separator class="mb-2 bg-foreground" />

			<p>Prompt:</p>
			<Textarea class="h-24 text-wrap p-1 font-mono" />
			<p>Negative Prompt:</p>
			<Textarea class="h-12 text-wrap p-1 font-mono" />
		</div>

		<Separator />

		<div>
			<h2>Highres. Fix</h2>
			<Separator class="mb-2 bg-foreground" />
		</div>

		<Separator />

		<div>
			<h2>Tiling</h2>
			<Separator class="mb-2 bg-foreground" />
		</div>

		<Separator />

		<div>
			<h2>Restore Faces</h2>
			<Separator class="mb-2 bg-foreground" />
		</div>

		<Separator />

		<div>
			<div>
				<h2>Base Settings</h2>
				<Separator class="mb-2 bg-foreground" />
			</div>

			<div class="flex">
				<span class="flex flex-col items-center space-y-1">
					<Label class="text-nowrap">Steps</Label>
					<Input type="number" class="pr-0 text-center" min={1} max={100} value={20} />
				</span>

				<span class="flex flex-col items-center space-y-1">
					<Label class="text-nowrap">CFG Scale</Label>
					<Input type="number" class="pr-0 text-center" min={0.1} max={1} step={0.1} value={0.7} />
				</span>

				<span class="flex flex-col items-center space-y-1">
					<Label class="text-nowrap">Scheduler</Label>
				</span>
			</div>

			<span class="flex flex-row items-center justify-between space-x-4">
				<Label class="text-nowrap">Seed</Label>
				<Input type="number" class="pr-0 text-right" min={0} max={100} value={42} />

				<Button class="">
					<span class="flex flex-row items-center space-x-2">
						<IconShuffle />
						<p>Shuffle Seed</p>
					</span>
				</Button>

				<div class="flex items-center space-x-2">
					<Switch />
					<Label class="text-nowrap">Ramdomize Seed</Label>
				</div>
			</span>
		</div>
	</div>
	<div class="h-full flex-1 bg-indigo-600"></div>
	<div class="h-full flex-1 bg-fuchsia-600"></div>
</div>
