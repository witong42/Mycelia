// RAG retrieval — uses BM25 index to find relevant vault notes for each query.
// Only includes top-matching notes in context, scales to 2000+ notes.

import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { readAllNotes } from '$lib/vault/filesystem';
import { VaultIndex } from '$lib/search/indexer';

const MAX_CONTEXT_CHARS = 60_000; // ~15k tokens — enough for relevant notes without flooding

/** Singleton index instance. */
let index: VaultIndex | null = null;
let indexTimestamp = 0;
const INDEX_TTL = 30_000; // 30s — rebuild index at most every 30 seconds

/** Build or refresh the search index. */
async function ensureIndex(): Promise<VaultIndex | null> {
	const s = get(settings);
	if (!s.vaultPath) return null;

	const now = Date.now();
	if (index && now - indexTimestamp < INDEX_TTL) {
		return index;
	}

	try {
		const notes = await readAllNotes(s.vaultPath);
		if (notes.size === 0) return null;

		const idx = new VaultIndex();
		idx.build(notes);
		index = idx;
		indexTimestamp = now;
		console.log(`[rag] Indexed ${idx.size} notes`);
		return idx;
	} catch (err) {
		console.error('[rag] Failed to index vault:', err);
		return null;
	}
}

/** Build the system prompt with relevant vault context for a given query. */
export async function buildRagContext(query: string): Promise<string | null> {
	const idx = await ensureIndex();
	if (!idx || idx.size === 0) return null;

	const today = new Date().toISOString().slice(0, 10);

	// BM25 search for relevant notes
	const results = idx.search(query, 30);

	// Always include today's journal if it exists (even if BM25 didn't rank it)
	const todayJournal = idx.getContent(`journals/${today}.md`);
	const hasTodayInResults = results.some((r) => r.path.includes(today));

	// Build context from ranked results
	let context = '';
	let charCount = 0;
	let included = 0;

	// Prepend today's journal if not already in results
	if (todayJournal && !hasTodayInResults) {
		const block = `\n### File: journals/${today}.md\n${todayJournal}\n`;
		context += block;
		charCount += block.length;
		included++;
	}

	for (const { path, content } of results) {
		const noteBlock = `\n### File: ${path}\n${content}\n`;
		if (charCount + noteBlock.length > MAX_CONTEXT_CHARS) {
			if (included > 0) break;
			// First note is too large — truncate
			const truncated = noteBlock.slice(0, MAX_CONTEXT_CHARS - charCount);
			context += truncated;
			charCount += truncated.length;
			included++;
			break;
		}
		context += noteBlock;
		charCount += noteBlock.length;
		included++;
	}

	if (!context.trim()) return null;

	const topScore = results[0]?.score?.toFixed(1) || '0';
	console.log(`[rag] Included ${included} notes (${charCount} chars, top BM25 score: ${topScore})`);

	return `You are Mycelia, a thoughtful personal AI companion. The user talks to you about their day, ideas, plans, and thoughts. You're like a smart, curious friend who genuinely cares about what they're working on.

Be concise and natural. Ask follow-up questions to draw out insights when something seems interesting. Help them think through problems. Remember context from earlier in the conversation.

Don't be overly formal or use bullet points unless asked. Just talk like a real person.

You have access to relevant notes from the user's personal knowledge base below. Use them naturally in conversation — reference their notes, projects, people, and ideas when relevant. When you draw from their notes, briefly mention which note you're referencing. If you can't find the answer in the notes, just be helpful as usual — don't mention that notes were searched.

<vault_context>
${context}
</vault_context>`;
}

/** Invalidate the search index (call after writing new notes). */
export function invalidateRagCache(): void {
	index = null;
	indexTimestamp = 0;
}
