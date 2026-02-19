// Daily journal — auto-writes summarized conversation entries to journals/.

import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { callClaude } from '$lib/ai/claude';
import { writeNote } from './filesystem';
import { exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

// --- Journal filename formats ---

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface JournalFormat {
	id: string;
	label: string;
	example: string;
}

export const JOURNAL_FORMATS: JournalFormat[] = [
	{ id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-02-19' },
	{ id: 'YYYY_MM_DD', label: 'YYYY_MM_DD', example: '2026_02_19' },
	{ id: 'YYYY.MM.DD', label: 'YYYY.MM.DD', example: '2026.02.19' },
	{ id: 'YYYYMMDD', label: 'YYYYMMDD', example: '20260219' },
	{ id: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '19-02-2026' },
	{ id: 'DD_MM_YYYY', label: 'DD_MM_YYYY', example: '19_02_2026' },
	{ id: 'MM-DD-YYYY', label: 'MM-DD-YYYY', example: '02-19-2026' },
	{ id: 'MM_DD_YYYY', label: 'MM_DD_YYYY', example: '02_19_2026' },
	{ id: 'YYYY-MM-DD-ddd', label: 'YYYY-MM-DD-ddd', example: '2026-02-19-Thu' },
	{ id: 'ddd-YYYY-MM-DD', label: 'ddd-YYYY-MM-DD', example: 'Thu-2026-02-19' }
];

/** Format a Date into a journal filename stem using the given format id. */
export function formatJournalDate(date: Date, formatId: string): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const ddd = DAY_NAMES[date.getDay()];

	switch (formatId) {
		case 'YYYY_MM_DD':
			return `${y}_${m}_${d}`;
		case 'YYYY.MM.DD':
			return `${y}.${m}.${d}`;
		case 'YYYYMMDD':
			return `${y}${m}${d}`;
		case 'DD-MM-YYYY':
			return `${d}-${m}-${y}`;
		case 'DD_MM_YYYY':
			return `${d}_${m}_${y}`;
		case 'MM-DD-YYYY':
			return `${m}-${d}-${y}`;
		case 'MM_DD_YYYY':
			return `${m}_${d}_${y}`;
		case 'YYYY-MM-DD-ddd':
			return `${y}-${m}-${d}-${ddd}`;
		case 'ddd-YYYY-MM-DD':
			return `${ddd}-${y}-${m}-${d}`;
		default:
			return `${y}-${m}-${d}`;
	}
}

/** Parse a journal filename stem back to a Date. Returns null if parsing fails. */
export function parseJournalStem(stem: string, formatId: string): Date | null {
	let y: number, m: number, d: number;

	try {
		switch (formatId) {
			case 'YYYY-MM-DD': {
				const match = stem.match(/^(\d{4})-(\d{2})-(\d{2})$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			case 'YYYY_MM_DD': {
				const match = stem.match(/^(\d{4})_(\d{2})_(\d{2})$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			case 'YYYY.MM.DD': {
				const match = stem.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			case 'YYYYMMDD': {
				const match = stem.match(/^(\d{4})(\d{2})(\d{2})$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			case 'DD-MM-YYYY': {
				const match = stem.match(/^(\d{2})-(\d{2})-(\d{4})$/);
				if (!match) return null;
				[, d, m, y] = match.map(Number);
				break;
			}
			case 'DD_MM_YYYY': {
				const match = stem.match(/^(\d{2})_(\d{2})_(\d{4})$/);
				if (!match) return null;
				[, d, m, y] = match.map(Number);
				break;
			}
			case 'MM-DD-YYYY': {
				const match = stem.match(/^(\d{2})-(\d{2})-(\d{4})$/);
				if (!match) return null;
				[, m, d, y] = match.map(Number);
				break;
			}
			case 'MM_DD_YYYY': {
				const match = stem.match(/^(\d{2})_(\d{2})_(\d{4})$/);
				if (!match) return null;
				[, m, d, y] = match.map(Number);
				break;
			}
			case 'YYYY-MM-DD-ddd': {
				const match = stem.match(/^(\d{4})-(\d{2})-(\d{2})-\w{3}$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			case 'ddd-YYYY-MM-DD': {
				const match = stem.match(/^\w{3}-(\d{4})-(\d{2})-(\d{2})$/);
				if (!match) return null;
				[, y, m, d] = match.map(Number);
				break;
			}
			default:
				return null;
		}
	} catch {
		return null;
	}

	return new Date(y, m - 1, d, 12, 0, 0);
}

// --- Journal entry writing ---

function buildJournalPrompt(perspective: 'first' | 'second' | 'plural'): string {
	const examples =
		perspective === 'first'
			? '("I discussed...", "I decided...")'
			: perspective === 'plural'
				? '("We discussed...", "We decided...")'
				: '("You discussed...", "You decided...")';
	const personInstruction =
		perspective === 'first'
			? 'first person from the USER\'s perspective — "I" means the user, never the AI'
			: perspective === 'plural'
				? 'first person plural — "We" means the user and their AI assistant'
				: 'second person — "You" refers to the user';
	return `You are a concise journal entry writer. Given a conversation exchange between a user and their AI, write a brief journal entry summarizing what was discussed.

Rules:
- Write 2-4 sentences max
- Write in past tense, ${personInstruction} ${examples}
- Use [[wikilinks]] for notable people, projects, tools, or concepts mentioned
- Focus on substance: decisions, ideas, plans, insights
- Skip greetings, small talk, or meta-conversation
- If there's truly nothing worth journaling, respond with exactly: NO_ENTRY

Output ONLY the journal entry text (with wikilinks), nothing else.`;
}

/** Get current time as HH:MM. */
function currentTime(): string {
	return new Date().toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

/** Write a journal entry for the latest conversation exchange. */
export async function writeJournalEntry(
	userMessage: string,
	assistantMessage: string
): Promise<void> {
	const s = get(settings);
	if (!s.vaultPath) {
		console.warn('[journal] Skipped: no vaultPath');
		return;
	}

	console.log('[journal] Summarizing exchange with model:', s.extractionModel);
	const summary = await callClaude(
		[
			{
				role: 'user',
				content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantMessage}"`
			}
		],
		buildJournalPrompt(s.writingPerspective || 'second')
	);

	console.log('[journal] Summary response:', summary.slice(0, 200));

	if (summary.trim() === 'NO_ENTRY') {
		console.log('[journal] Claude returned NO_ENTRY');
		return;
	}

	const now = new Date();
	const time = currentTime();
	const stem = formatJournalDate(now, s.journalFormat || 'YYYY-MM-DD');
	const filename = `${stem}.md`;

	// Ensure journals directory exists
	const journalsDir = await join(s.vaultPath, 'journals');
	const dirExists = await exists(journalsDir);
	if (!dirExists) {
		const { mkdir } = await import('@tauri-apps/plugin-fs');
		await mkdir(journalsDir, { recursive: true });
	}

	// Check if today's journal already exists
	const journalPath = await join(s.vaultPath, 'journals', filename);
	const journalExists = await exists(journalPath);

	if (journalExists) {
		const entry = `\n## ${time}\n${summary}\n`;
		await writeNote(s.vaultPath, 'journals', filename, entry);
	} else {
		const content = `## ${time}\n${summary}\n`;
		await writeNote(s.vaultPath, 'journals', filename, content);
	}

	console.log('[journal] Wrote journal entry:', filename);
}
