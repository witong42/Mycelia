<!-- Note viewer/editor — always-rendered WYSIWYG editing with editable title. -->
<script lang="ts">
	import { page } from '$app/stores';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import BackLinks from '$lib/components/BackLinks.svelte';
	import {
		loadNote,
		computeBacklinks,
		loadAllPaths,
		type NoteData,
		type BackLink
	} from '$lib/stores/notes';
	import { overwriteNote } from '$lib/vault/filesystem';
	import { settings } from '$lib/stores/settings';
	import { get } from 'svelte/store';
	import { FOLDER_COLORS } from '$lib/vault/graph';
	import { extractWikilinks } from '$lib/vault/parser';

	let note = $state<NoteData | null>(null);
	let backlinks = $state<BackLink[]>([]);
	let outgoingLinks = $state<string[]>([]);
	let notePaths = $state<string[]>([]);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let editorComponent: ReturnType<typeof MarkdownEditor> | undefined = $state();

	$effect(() => {
		const path = $page.params.path;
		if (path) {
			loading = true;
			error = '';

			loadNote(path)
				.then((n) => {
					note = n;
					outgoingLinks = extractWikilinks(n.content);
					loading = false;
				})
				.catch((e) => {
					error = e instanceof Error ? e.message : String(e);
					loading = false;
				});

			computeBacklinks(path).then((bl) => {
				backlinks = bl;
			});

			loadAllPaths().then((paths) => {
				notePaths = paths;
			});
		}
	});

	/** Split content into frontmatter block and body. */
	function splitContent(content: string): { frontmatter: string; body: string } {
		const match = content.match(/^(---\n[\s\S]*?\n---)\n*([\s\S]*)$/);
		if (match) return { frontmatter: match[1], body: match[2].trim() };
		return { frontmatter: '', body: content.trim() };
	}

	/** Reconstruct full file content from frontmatter + body. */
	function rebuildContent(frontmatter: string, body: string): string {
		if (frontmatter) return frontmatter + '\n\n' + body + '\n';
		return body + '\n';
	}

	function getTitle(n: NoteData): string {
		return n.frontmatter.title || n.path.replace(/\.md$/, '').split('/').pop() || n.path;
	}

	function getBody(n: NoteData): string {
		return splitContent(n.content).body;
	}

	/** Save body changes from the WYSIWYG editor. */
	async function handleBodySave(newBody: string) {
		if (!note || saving) return;
		const { frontmatter } = splitContent(note.content);
		const newContent = rebuildContent(frontmatter, newBody);
		if (newContent === note.content) return;

		saving = true;
		try {
			const s = get(settings);
			await overwriteNote(s.vaultPath, note.path, newContent);
			// Update local state without full reload to avoid editor reset
			note = { ...note, content: newContent };
			outgoingLinks = extractWikilinks(newContent);
			showSaved();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	/** Save title changes. */
	async function handleTitleBlur(e: FocusEvent) {
		if (!note || saving) return;
		const el = e.target as HTMLHeadingElement;
		const newTitle = el.textContent?.trim() || '';
		if (!newTitle || newTitle === getTitle(note)) return;

		const { frontmatter, body } = splitContent(note.content);
		if (!frontmatter) return;

		saving = true;
		try {
			const updatedFm = frontmatter.replace(
				/title:\s*"?[^"\n]*"?/,
				`title: "${newTitle}"`
			);
			const newContent = rebuildContent(updatedFm, body);
			const s = get(settings);
			await overwriteNote(s.vaultPath, note.path, newContent);
			note = { ...note, content: newContent, frontmatter: { ...note.frontmatter, title: newTitle } };
			showSaved();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLHeadingElement).blur();
		}
	}

	function showSaved() {
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}
</script>

<div class="flex h-full">
	<!-- Note content -->
	<div class="flex-1 overflow-y-auto min-w-0">
		<!-- Header -->
		<div class="flex items-center gap-3 px-6 h-14 border-b border-border shrink-0">
			<a
				href="/notes"
				aria-label="Back to all notes"
				class="text-text-secondary hover:text-text transition-colors"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
					/>
				</svg>
			</a>
			{#if note}
				<span
					class="text-[10px] font-medium px-2 py-0.5 rounded-full"
					style="background-color: {FOLDER_COLORS[note.folder] || '#cbd5e1'}20; color: {FOLDER_COLORS[note.folder] || '#cbd5e1'}"
				>
					{note.folder}
				</span>
				<div class="flex-1"></div>
				{#if saved}
					<span class="text-xs text-emerald-400">Saved</span>
				{/if}
				{#if saving}
					<span class="text-xs text-text-tertiary">Saving...</span>
				{/if}
			{/if}
		</div>

		<!-- Content -->
		<div class="px-8 py-6 max-w-3xl">
			{#if loading}
				<p class="text-text-secondary text-sm">Loading...</p>
			{:else if error}
				<p class="text-red-400 text-sm">Failed to load note: {error}</p>
			{:else if note}
				<!-- Editable title -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<h1
					contenteditable="true"
					onblur={handleTitleBlur}
					onkeydown={handleTitleKeydown}
					class="text-xl font-semibold text-text mb-6 outline-none cursor-text
						rounded px-1 -mx-1 focus:bg-bg-tertiary/30 transition-colors"
					spellcheck="false"
				>
					{getTitle(note)}
				</h1>

				<!-- WYSIWYG body editor -->
				<MarkdownEditor
					bind:this={editorComponent}
					content={getBody(note)}
					onsave={handleBodySave}
					placeholder="Start writing..."
				/>
			{/if}
		</div>
	</div>

	<!-- Right panel -->
	<div class="w-[280px] border-l border-border overflow-y-auto shrink-0 px-4 py-5 space-y-6">
		{#if note}
			<!-- Metadata -->
			<div>
				<h3 class="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2">
					Info
				</h3>
				<div class="space-y-2 text-[13px]">
					<div class="flex items-center gap-2">
						<span class="text-text-tertiary">Folder</span>
						<span
							class="text-xs px-2 py-0.5 rounded-full"
							style="background-color: {FOLDER_COLORS[note.folder] || '#cbd5e1'}20; color: {FOLDER_COLORS[note.folder] || '#cbd5e1'}"
						>
							{note.folder}
						</span>
					</div>
					{#if note.frontmatter.date}
						<div class="flex items-center gap-2">
							<span class="text-text-tertiary">Date</span>
							<span class="text-text-secondary">{note.frontmatter.date}</span>
						</div>
					{/if}
					{#if note.frontmatter.tags}
						<div class="flex flex-wrap gap-1 mt-1">
							{#each note.frontmatter.tags.split(',').map((t: string) => t.trim()) as tag}
								<span
									class="text-[11px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary"
								>
									{tag}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Outgoing links -->
			{#if outgoingLinks.length > 0}
				<div>
					<h3
						class="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2"
					>
						Links ({outgoingLinks.length})
					</h3>
					<div class="flex flex-wrap gap-1">
						{#each outgoingLinks as link}
							<span
								class="text-[11px] px-2 py-0.5 rounded-full bg-accent-muted text-accent"
							>
								{link}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Backlinks -->
			<BackLinks {backlinks} />
		{/if}
	</div>
</div>
