<!-- BackLinks — displays incoming links to the current note. -->
<script lang="ts">
	import { FOLDER_COLORS } from '$lib/vault/graph';
	import type { BackLink } from '$lib/stores/notes';

	let { backlinks }: { backlinks: BackLink[] } = $props();
</script>

{#if backlinks.length > 0}
	<div>
		<h3 class="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2">
			Backlinks ({backlinks.length})
		</h3>
		<div class="space-y-0.5">
			{#each backlinks as link}
				<a
					href="/note/{link.path}"
					class="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-text-secondary
						hover:text-text hover:bg-sidebar-hover transition-colors"
				>
					<span
						class="w-2 h-2 rounded-full shrink-0"
						style="background-color: {FOLDER_COLORS[link.folder] || '#cbd5e1'}"
					></span>
					<span class="truncate">{link.name}</span>
				</a>
			{/each}
		</div>
	</div>
{/if}
