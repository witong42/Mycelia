<!-- All Notes — folder explorer + note listing. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAllPaths } from '$lib/stores/notes';
	import { FOLDER_COLORS } from '$lib/vault/graph';
	import { getFolderFromPath } from '$lib/vault/parser';

	let groups = $state<Map<string, string[]>>(new Map());
	let loading = $state(true);
	let total = $state(0);
	let activeFolder = $state<string | null>(null);
	let searchQuery = $state('');

	onMount(async () => {
		const paths = await loadAllPaths();
		total = paths.length;

		const map = new Map<string, string[]>();
		for (const p of paths) {
			const folder = getFolderFromPath(p);
			if (!map.has(folder)) map.set(folder, []);
			map.get(folder)!.push(p);
		}

		for (const [, files] of map) {
			files.sort((a, b) => a.localeCompare(b));
		}

		groups = map;
		loading = false;
	});

	function getNoteName(path: string): string {
		return path.replace(/\.md$/, '').split('/').pop() || path;
	}

	function getFilteredFiles(): string[] {
		let files: string[] = [];
		if (activeFolder) {
			files = groups.get(activeFolder) || [];
		} else {
			for (const f of groups.values()) {
				files = files.concat(f);
			}
			files.sort((a, b) => getNoteName(a).localeCompare(getNoteName(b)));
		}
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			files = files.filter((f) => getNoteName(f).toLowerCase().includes(q));
		}
		return files;
	}

	function getSortedFolders(): [string, string[]][] {
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	}
</script>

<div class="flex h-full">
	<!-- Folder explorer sidebar -->
	<div class="w-52 border-r border-border overflow-y-auto shrink-0 flex flex-col">
		<div class="px-4 h-14 flex items-center border-b border-border shrink-0">
			<span class="text-xs font-medium text-text-secondary uppercase tracking-wider">Folders</span>
		</div>
		<div class="py-2 px-2 flex-1">
			<!-- All notes -->
			<button
				onclick={() => (activeFolder = null)}
				class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors
					{activeFolder === null
						? 'bg-sidebar-active text-text'
						: 'text-text-secondary hover:text-text hover:bg-sidebar-hover'}"
			>
				<svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
				</svg>
				<span>All Notes</span>
				<span class="ml-auto text-[10px] text-text-tertiary">{total}</span>
			</button>

			<div class="h-px bg-border my-2"></div>

			<!-- Folder list -->
			{#each getSortedFolders() as [folder, files]}
				<button
					onclick={() => (activeFolder = activeFolder === folder ? null : folder)}
					class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors
						{activeFolder === folder
							? 'bg-sidebar-active text-text'
							: 'text-text-secondary hover:text-text hover:bg-sidebar-hover'}"
				>
					<span
						class="w-3 h-3 rounded shrink-0"
						style="background-color: {FOLDER_COLORS[folder] || '#cbd5e1'}"
					></span>
					<span class="truncate">{folder}</span>
					<span class="ml-auto text-[10px] text-text-tertiary">{files.length}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Notes list -->
	<div class="flex-1 flex flex-col min-w-0">
		<!-- Header with search -->
		<div class="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
			<h1 class="text-sm font-medium text-text shrink-0">
				{activeFolder || 'All Notes'}
			</h1>
			<div class="flex-1 max-w-xs">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search notes..."
					class="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-xs text-text
						placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
				/>
			</div>
			{#if !loading}
				<span class="text-xs text-text-secondary shrink-0">{getFilteredFiles().length} notes</span>
			{/if}
		</div>

		<!-- Files -->
		<div class="flex-1 overflow-y-auto px-4 py-3">
			{#if loading}
				<p class="text-text-secondary text-sm px-2">Loading notes...</p>
			{:else if getFilteredFiles().length === 0}
				<div class="flex flex-col items-center justify-center h-full text-center">
					<p class="text-text-secondary text-sm">
						{searchQuery ? 'No notes match your search' : 'No notes yet'}
					</p>
					{#if !searchQuery}
						<p class="text-text-tertiary text-xs mt-1">Start chatting and notes will appear here.</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-0.5">
					{#each getFilteredFiles() as file}
						<a
							href="/note/{file}"
							class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-text-secondary
								hover:text-text hover:bg-sidebar-hover transition-colors group"
						>
							<span
								class="w-2 h-2 rounded-full shrink-0"
								style="background-color: {FOLDER_COLORS[getFolderFromPath(file)] || '#cbd5e1'}"
							></span>
							<span class="truncate">{getNoteName(file)}</span>
							{#if !activeFolder}
								<span class="ml-auto text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
									{getFolderFromPath(file)}
								</span>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
