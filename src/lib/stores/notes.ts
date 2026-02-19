// Notes store — manages note loading, path listing, and backlink computation.

import { writable, get } from 'svelte/store';
import { settings } from './settings';
import { readNote, readAllNotes, listAllNotes } from '$lib/vault/filesystem';
import { extractWikilinks, extractFrontmatter, getFolderFromPath } from '$lib/vault/parser';

export interface NoteData {
	path: string;
	content: string;
	folder: string;
	frontmatter: Record<string, string>;
}

export interface BackLink {
	path: string;
	name: string;
	folder: string;
}

export const allNotePaths = writable<string[]>([]);

/** Load a single note by its relative path. */
export async function loadNote(relativePath: string): Promise<NoteData> {
	const s = get(settings);
	if (!s.vaultPath) throw new Error('No vault path configured');

	const content = await readNote(s.vaultPath, relativePath);
	const frontmatter = extractFrontmatter(content);
	const folder = getFolderFromPath(relativePath);

	return { path: relativePath, content, folder, frontmatter };
}

/** Load all note paths into the store. */
export async function loadAllPaths(): Promise<string[]> {
	const s = get(settings);
	if (!s.vaultPath) return [];

	const paths = await listAllNotes(s.vaultPath);
	allNotePaths.set(paths);
	return paths;
}

/** Compute backlinks for a given note. */
export async function computeBacklinks(notePath: string): Promise<BackLink[]> {
	const s = get(settings);
	if (!s.vaultPath) return [];

	const notes = await readAllNotes(s.vaultPath);
	const targetName = notePath.replace(/\.md$/, '').split('/').pop()?.toLowerCase() || '';
	const targetFrontmatter = extractFrontmatter(notes.get(notePath) || '');
	const targetTitle = targetFrontmatter.title?.toLowerCase() || '';

	const backlinks: BackLink[] = [];

	for (const [path, content] of notes) {
		if (path === notePath) continue;

		const wikilinks = extractWikilinks(content);
		const hasLink = wikilinks.some((link) => {
			const linkLower = link.toLowerCase();
			return linkLower === targetName || linkLower === targetTitle || notePath.toLowerCase().includes(linkLower);
		});

		if (hasLink) {
			const fm = extractFrontmatter(content);
			const name = fm.title || path.replace(/\.md$/, '').split('/').pop() || path;
			backlinks.push({ path, name, folder: getFolderFromPath(path) });
		}
	}

	return backlinks;
}
