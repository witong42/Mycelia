// Knowledge extraction engine — extracts structured notes from conversation and writes to vault.

import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { callClaude } from './claude';
import { writeNote, readNote, listAllNotes } from '$lib/vault/filesystem';
import { extractFrontmatter } from '$lib/vault/parser';
import type { ChatMessage } from '$lib/stores/chat';

const PERSPECTIVE_INSTRUCTIONS = {
	second: {
		rule: 'Write in second person ("You mentioned...", "You decided...", "You\'re interested in...")',
		example:
			"You're considering building software for [[farriers]] (horseshoe makers). This connects to your broader interest in [[niche markets]] and [[B2B SaaS]]. The insight is that underserved trades often have terrible software and will pay well for something that actually works."
	},
	first: {
		rule: 'Write in first person from the USER\'s perspective — "I" means the user, never the AI ("I mentioned...", "I decided...", "I\'m interested in...")',
		example:
			"I'm considering building software for [[farriers]] (horseshoe makers). This connects to my broader interest in [[niche markets]] and [[B2B SaaS]]. The insight is that underserved trades often have terrible software and will pay well for something that actually works."
	},
	plural: {
		rule: 'Write in first person plural from the USER\'s perspective — "We" means the user and their AI assistant ("We discussed...", "We decided...", "We\'re exploring...")',
		example:
			"We're considering building software for [[farriers]] (horseshoe makers). This connects to our broader interest in [[niche markets]] and [[B2B SaaS]]. The insight is that underserved trades often have terrible software and will pay well for something that actually works."
	}
};

function buildExtractionPrompt(perspective: 'first' | 'second' | 'plural'): string {
	const p = PERSPECTIVE_INSTRUCTIONS[perspective];
	return `You are a knowledge extraction engine for a personal knowledge base.

Given a conversation, extract information worth remembering. Output structured markdown notes.

## Rules
- Only extract genuinely useful information: ideas, decisions, facts, plans, insights, preferences, people, projects
- Skip small talk, greetings, filler, meta-conversation about the AI itself
- If the conversation contains NOTHING worth extracting, respond with exactly: NO_EXTRACTION
- Each distinct topic gets its own note block
- Use [[wikilinks]] for people, projects, tools, concepts
- ${p.rule}
- Be concise — capture the essence, not the full conversation
- IMPORTANT: When mode is "append", output ONLY the new body text. Do NOT repeat frontmatter.
- IMPORTANT: When mode is "create", include full frontmatter with title, folder, filename, tags, date.

## Output Format
For each note, use this structure. Separate multiple notes with ===

### For NEW notes (mode: create):
---
title: <short descriptive title>
folder: <one of: topics, people, projects, decisions, ideas>
filename: <kebab-case.md>
mode: create
tags: [relevant, tags]
date: <YYYY-MM-DD>
---

<markdown body with [[wikilinks]]>

===

### For UPDATING existing notes (mode: append):
---
folder: <folder>
filename: <existing-filename.md>
mode: append
date: <YYYY-MM-DD>
---

<new information to add — just the body, no title or metadata>

===

## Folder guide
- topics: General knowledge, concepts, learning, interests
- people: People mentioned — friends, colleagues, public figures
- projects: Active projects, businesses, ventures
- decisions: Decisions made with reasoning
- ideas: Raw ideas, creative sparks, what-ifs

## Example

---
title: Niche Software Business Idea
folder: ideas
filename: niche-software-farriers.md
mode: create
tags: [business, software, niche-markets]
date: 2026-02-19
---

${p.example}

===`;
}

/** Extract notes from the last few messages and write to vault. */
export async function extractKnowledge(messages: ChatMessage[]): Promise<void> {
	const s = get(settings);
	if (!s.vaultPath || !s.apiKey) return;

	const recentMessages = messages.slice(-10);
	if (recentMessages.length < 2) return;

	let existingFiles: string[] = [];
	try {
		existingFiles = await listAllNotes(s.vaultPath);
	} catch {
		// Vault may not be initialized yet
	}

	const conversationText = recentMessages
		.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
		.join('\n\n');

	const prompt =
		existingFiles.length > 0
			? `Existing notes in vault:\n${existingFiles.join('\n')}\n\nIf a topic already has a note, use mode: append with the existing filename. Only output new body text for appends.\n\nConversation:\n${conversationText}`
			: `Conversation:\n${conversationText}`;

	const today = new Date().toISOString().split('T')[0];
	const systemPrompt = buildExtractionPrompt(s.writingPerspective || 'second').replace(
		/2026-02-19/g,
		today
	);

	const result = await callClaude([{ role: 'user', content: prompt }], systemPrompt);

	if (result.trim() === 'NO_EXTRACTION') return;

	const noteBlocks = result.split('===').filter((b) => b.trim());

	let written = 0;
	for (const block of noteBlocks) {
		const ok = await processNoteBlock(s.vaultPath, block.trim());
		if (ok) written++;
	}
	console.log(`[extraction] Wrote ${written} note(s)`);
}

/** Parse a single note block and write it to the vault. */
async function processNoteBlock(vaultPath: string, block: string): Promise<boolean> {
	const normalized = block.replace(/\r\n/g, '\n').trim();

	const fmMatch = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!fmMatch) {
		console.warn('[extraction] Failed to parse block:', normalized.slice(0, 200));
		return false;
	}

	const frontmatterText = fmMatch[1];
	const body = fmMatch[2].trim();
	if (!body) return false;

	const folder = extractField(frontmatterText, 'folder') || 'topics';
	const filename = extractField(frontmatterText, 'filename') || 'untitled.md';
	const mode = extractField(frontmatterText, 'mode') || 'create';
	const tags = extractField(frontmatterText, 'tags') || '[]';
	const date = extractField(frontmatterText, 'date') || new Date().toISOString().split('T')[0];
	// Derive title from filename if not provided (strip .md, convert kebab-case to Title Case)
	const rawTitle = extractField(frontmatterText, 'title');
	const title = rawTitle && rawTitle !== 'Untitled'
		? rawTitle.replace(/^["']|["']$/g, '')
		: filename.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// Ensure target folder exists
	const { join } = await import('@tauri-apps/api/path');
	const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
	const dirPath = await join(vaultPath, folder);
	const dirExists = await exists(dirPath);
	if (!dirExists) {
		await mkdir(dirPath, { recursive: true });
	}

	if (mode === 'append') {
		// Read existing file, append just the new body under a date header
		const appendContent = `\n\n## ${date}\n${body}`;
		await writeNote(vaultPath, folder, filename, appendContent);
	} else {
		// Create: check if file already exists — if so, merge instead of duplicating
		const relativePath = `${folder}/${filename}`;
		const existingFile = await findExistingNote(vaultPath, folder, filename);

		if (existingFile) {
			// File exists (exact match or similar name) — append instead of overwriting
			const appendContent = `\n\n## ${date}\n${body}`;
			await writeNote(vaultPath, folder, existingFile, appendContent);
			console.log(`[extraction] Appended to existing: ${folder}/${existingFile}`);
		} else {
			// Genuinely new file — write with frontmatter
			const fullContent = `---\ntitle: "${title}"\ntags: ${tags}\ndate: ${date}\n---\n\n${body}\n`;
			await writeNote(vaultPath, folder, filename, fullContent);
		}
	}

	return true;
}

/** Find an existing note file by exact match or similar filename.
 *  Returns the filename if found, null otherwise. */
async function findExistingNote(
	vaultPath: string,
	folder: string,
	filename: string
): Promise<string | null> {
	// Check exact match first
	try {
		await readNote(vaultPath, `${folder}/${filename}`);
		return filename;
	} catch {
		// Not found — check for similar filenames
	}

	// Look for similar files in the same folder (prevents near-duplicates)
	let allFiles: string[] = [];
	try {
		allFiles = await listAllNotes(vaultPath);
	} catch {
		return null;
	}

	const stem = filename.replace(/\.md$/, '').toLowerCase();
	const stemWords = new Set(stem.split('-').filter((w) => w.length > 2));

	for (const file of allFiles) {
		if (!file.startsWith(`${folder}/`)) continue;
		const existingStem = file.replace(`${folder}/`, '').replace(/\.md$/, '').toLowerCase();
		const existingWords = new Set(existingStem.split('-').filter((w) => w.length > 2));

		// Check word overlap — if 70%+ of words match, it's likely the same topic
		if (stemWords.size === 0 || existingWords.size === 0) continue;
		const overlap = [...stemWords].filter((w) => existingWords.has(w)).length;
		const similarity = overlap / Math.max(stemWords.size, existingWords.size);

		if (similarity >= 0.7) {
			const existingFilename = file.replace(`${folder}/`, '');
			console.log(`[extraction] Fuzzy match: "${filename}" ≈ "${existingFilename}" (${(similarity * 100).toFixed(0)}%)`);
			return existingFilename;
		}
	}

	return null;
}

/** Extract a YAML field value from frontmatter text. */
function extractField(frontmatter: string, field: string): string | null {
	const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
	return match ? match[1].trim() : null;
}
