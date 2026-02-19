<!-- Daily Notes — infinite scroll journal feed with WYSIWYG inline editing. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Calendar from '$lib/components/Calendar.svelte';
	import NoteViewer from '$lib/components/NoteViewer.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import { settings } from '$lib/stores/settings';
	import { get } from 'svelte/store';
	import { readNote, listAllNotes, overwriteNote } from '$lib/vault/filesystem';
	import { loadAllPaths } from '$lib/stores/notes';
	import { formatJournalDate, parseJournalStem } from '$lib/vault/journal';

	const todayISO = new Date().toISOString().slice(0, 10);

	interface DayEntry {
		/** Internal ISO date (YYYY-MM-DD) used for date math and Calendar. */
		iso: string;
		/** Filename stem for display and file I/O. */
		stem: string;
		content: string;
	}

	let selectedDate = $state(todayISO);
	let days = $state<DayEntry[]>([]);
	/** Set of YYYY-MM-DD dates that have journal files (for Calendar dots). */
	let datesWithEntries = $state<Set<string>>(new Set());
	/** Map from YYYY-MM-DD → filename stem (for existing files that might use old formats). */
	let stemMap = $state<Map<string, string>>(new Map());
	let notePaths = $state<string[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let loadingFuture = $state(false);
	let recentDates = $state<string[]>([]);
	let scrollContainer: HTMLDivElement;
	let editingDate = $state<string | null>(null);
	let savedDate = $state<string | null>(null);

	function getFormat(): string {
		return get(settings).journalFormat || 'YYYY-MM-DD';
	}

	/** Add days to an ISO date string, returns ISO date string. */
	function addDays(isoDate: string, offset: number): string {
		const d = new Date(isoDate + 'T12:00:00');
		d.setDate(d.getDate() + offset);
		return d.toISOString().slice(0, 10);
	}

	/** Get the filename stem for an ISO date (existing mapping or generate with current format). */
	function getStem(isoDate: string): string {
		return stemMap.get(isoDate) || formatJournalDate(new Date(isoDate + 'T12:00:00'), getFormat());
	}

	async function loadJournalDates() {
		const s = get(settings);
		if (!s.vaultPath) return;
		const fmt = s.journalFormat || 'YYYY-MM-DD';

		const allPaths = await listAllNotes(s.vaultPath);
		const isoSet = new Set<string>();
		const map = new Map<string, string>();

		for (const p of allPaths) {
			const match = p.match(/^journals\/(.+)\.md$/);
			if (!match) continue;
			const stem = match[1];

			// Try to parse with current format first, then try all formats as fallback
			let parsed = parseJournalStem(stem, fmt);
			if (!parsed) {
				// Try common formats as fallback for files created with a previous format
				for (const fallback of ['YYYY-MM-DD', 'YYYY_MM_DD', 'YYYY.MM.DD', 'YYYYMMDD', 'DD-MM-YYYY', 'MM-DD-YYYY']) {
					parsed = parseJournalStem(stem, fallback);
					if (parsed) break;
				}
			}
			if (parsed) {
				const iso = parsed.toISOString().slice(0, 10);
				isoSet.add(iso);
				map.set(iso, stem);
			}
		}

		datesWithEntries = isoSet;
		stemMap = map;
		recentDates = [...isoSet].sort().reverse().slice(0, 10);
	}

	async function loadDayContent(isoDate: string): Promise<string> {
		const s = get(settings);
		if (!s.vaultPath) return '';
		const stem = getStem(isoDate);
		try {
			return await readNote(s.vaultPath, `journals/${stem}.md`);
		} catch {
			return '';
		}
	}

	async function loadInitialDays() {
		const batch: DayEntry[] = [];
		// Load today + 13 past days (no future days)
		for (let i = 0; i < 14; i++) {
			const iso = addDays(todayISO, -i);
			const content = datesWithEntries.has(iso) ? await loadDayContent(iso) : '';
			batch.push({ iso, stem: getStem(iso), content });
		}
		days = batch;
	}

	/** Load older days when scrolling down. */
	async function loadMoreDays() {
		if (loadingMore || days.length === 0) return;
		loadingMore = true;

		const oldestISO = days[days.length - 1].iso;
		const batch: DayEntry[] = [];
		for (let i = 1; i <= 14; i++) {
			const iso = addDays(oldestISO, -i);
			const content = datesWithEntries.has(iso) ? await loadDayContent(iso) : '';
			batch.push({ iso, stem: getStem(iso), content });
		}
		days = [...days, ...batch];
		loadingMore = false;
	}

	/** Load one future day when scrolling up. Preserves scroll position. */
	async function loadFutureDays() {
		if (loadingFuture || days.length === 0) return;
		loadingFuture = true;

		const newestISO = days[0].iso;
		const iso = addDays(newestISO, 1);
		const content = datesWithEntries.has(iso) ? await loadDayContent(iso) : '';
		const entry: DayEntry = { iso, stem: getStem(iso), content };

		// Preserve scroll position when prepending
		const prevHeight = scrollContainer.scrollHeight;
		days = [entry, ...days];
		await tick();
		const newHeight = scrollContainer.scrollHeight;
		scrollContainer.scrollTop += newHeight - prevHeight;

		loadingFuture = false;
	}

	function handleScroll() {
		if (!scrollContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		// Near bottom → load older days
		if (scrollHeight - scrollTop - clientHeight < 300) {
			loadMoreDays();
		}
		// Near top → load future days
		if (scrollTop < 200) {
			loadFutureDays();
		}
	}

	function handleDateSelect(isoDate: string) {
		selectedDate = isoDate;
		const idx = days.findIndex((d) => d.iso === isoDate);
		if (idx >= 0 && scrollContainer) {
			const el = scrollContainer.querySelector(`[data-date="${isoDate}"]`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			reloadFromDate(isoDate);
		}
	}

	async function reloadFromDate(isoDate: string) {
		loading = true;
		const batch: DayEntry[] = [];
		// Load selected date + 13 past days (no future days)
		for (let i = 0; i < 14; i++) {
			const iso = addDays(isoDate, -i);
			const content = datesWithEntries.has(iso) ? await loadDayContent(iso) : '';
			batch.push({ iso, stem: getStem(iso), content });
		}
		days = batch;
		loading = false;
	}

	function isToday(isoDate: string): boolean {
		return isoDate === todayISO;
	}

	function startEditingDay(isoDate: string) {
		editingDate = isoDate;
	}

	async function handleDaySave(isoDate: string, newContent: string) {
		const day = days.find((d) => d.iso === isoDate);
		if (!day) return;
		if (newContent === day.content) return;

		try {
			const s = get(settings);
			if (!s.vaultPath) return;
			const stem = getStem(isoDate);
			const path = `journals/${stem}.md`;
			if (newContent.trim()) {
				await overwriteNote(s.vaultPath, path, newContent);
				if (!datesWithEntries.has(isoDate)) {
					datesWithEntries = new Set([...datesWithEntries, isoDate]);
					stemMap = new Map([...stemMap, [isoDate, stem]]);
				}
			}
			days = days.map((d) => (d.iso === isoDate ? { ...d, content: newContent } : d));
			savedDate = isoDate;
			setTimeout(() => (savedDate = null), 2000);
		} catch (e) {
			console.error('Failed to save journal entry:', e);
		}
	}

	onMount(async () => {
		await loadJournalDates();
		await loadInitialDays();
		notePaths = await loadAllPaths();
		loading = false;
	});
</script>

<div class="flex h-full">
	<!-- Journal feed -->
	<div bind:this={scrollContainer} onscroll={handleScroll} class="flex-1 overflow-y-auto min-w-0">
		<!-- Header -->
		<div
			class="flex items-center px-6 h-14 border-b border-border shrink-0 sticky top-0 bg-bg z-10"
		>
			<h1 class="text-sm font-medium text-text">Daily Notes</h1>
		</div>

		<!-- Day entries -->
		<div class="px-8 py-6 max-w-3xl">
			{#if loading}
				<p class="text-text-secondary text-sm">Loading...</p>
			{:else}
				{#if loadingFuture}
					<p class="text-text-secondary text-sm text-center py-4">Loading future days...</p>
				{/if}

				{#each days as day (day.iso)}
					<div data-date={day.iso} class="mb-10">
						<!-- Day header — shows filename stem -->
						<div class="flex items-baseline gap-3 mb-4">
							<h2 class="text-lg font-semibold text-text">
								{day.stem}
							</h2>
							{#if isToday(day.iso)}
								<span class="text-xs text-accent font-medium">Today</span>
							{/if}
							{#if savedDate === day.iso}
								<span class="text-xs text-emerald-400">Saved</span>
							{/if}
						</div>

						<!-- Day content — WYSIWYG when active, rendered when not -->
						<div class="pl-4 border-l-2 border-border">
							{#if editingDate === day.iso}
								<MarkdownEditor
									content={day.content}
									onsave={(md) => handleDaySave(day.iso, md)}
									placeholder="Write about your day..."
								/>
							{:else if day.content}
								<button
									type="button"
									onclick={() => startEditingDay(day.iso)}
									class="cursor-text text-left w-full"
								>
									<NoteViewer content={day.content} {notePaths} />
								</button>
							{:else}
								<button
									type="button"
									onclick={() => startEditingDay(day.iso)}
									class="cursor-text text-left w-full py-2"
								>
									<p class="text-text-tertiary text-sm italic">
										No entry — click to write
									</p>
								</button>
							{/if}
						</div>

						<!-- Separator -->
						<div class="border-b border-border/30 mt-8"></div>
					</div>
				{/each}

				{#if loadingMore}
					<p class="text-text-secondary text-sm text-center py-4">Loading more...</p>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Right panel -->
	<div class="w-[280px] border-l border-border overflow-y-auto shrink-0 px-4 py-5 space-y-6">
		<Calendar {selectedDate} {datesWithEntries} onselect={handleDateSelect} />

		{#if recentDates.length > 0}
			<div>
				<h3 class="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2">
					Recent Entries
				</h3>
				<div class="space-y-0.5">
					{#each recentDates as isoDate}
						<button
							onclick={() => handleDateSelect(isoDate)}
							class="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors
								{isoDate === selectedDate
								? 'bg-sidebar-active text-text'
								: 'text-text-secondary hover:text-text hover:bg-sidebar-hover'}"
						>
							{stemMap.get(isoDate) || isoDate}
							{#if isoDate === todayISO}
								<span class="text-accent text-[10px] ml-1">today</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
