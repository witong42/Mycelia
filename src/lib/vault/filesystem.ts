// Vault filesystem operations — wraps Tauri FS plugin for markdown read/write.

import {
	readTextFile,
	writeTextFile,
	readDir,
	mkdir,
	exists
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

const VAULT_FOLDERS = ['journals', 'topics', 'people', 'projects', 'decisions', 'ideas', '.mycelia'];

/** Ensure all vault subdirectories exist. */
export async function ensureVaultStructure(vaultPath: string): Promise<void> {
	for (const folder of VAULT_FOLDERS) {
		try {
			const dirPath = await join(vaultPath, folder);
			const dirExists = await exists(dirPath);
			if (!dirExists) {
				await mkdir(dirPath, { recursive: true });
			}
		} catch (err) {
			console.warn(`Skipping vault folder "${folder}":`, err);
		}
	}
}

/** Write a markdown note. Supports append (default) and overwrite modes. */
export async function writeNote(
	vaultPath: string,
	folder: string,
	filename: string,
	content: string,
	options?: { overwrite?: boolean }
): Promise<string> {
	const dirPath = await join(vaultPath, folder);
	const filePath = await join(dirPath, filename);

	if (options?.overwrite) {
		await writeTextFile(filePath, content);
	} else {
		const fileExists = await exists(filePath);
		if (fileExists) {
			const existing = await readTextFile(filePath);
			await writeTextFile(filePath, existing + '\n\n' + content);
		} else {
			await writeTextFile(filePath, content);
		}
	}

	return filePath;
}

/** Overwrite a note by its full relative path. */
export async function overwriteNote(
	vaultPath: string,
	relativePath: string,
	content: string
): Promise<void> {
	const filePath = await join(vaultPath, relativePath);
	await writeTextFile(filePath, content);
}

/** Read a single markdown file. */
export async function readNote(vaultPath: string, relativePath: string): Promise<string> {
	const filePath = await join(vaultPath, relativePath);
	return readTextFile(filePath);
}

/** Directories to skip when walking the vault. */
const SKIP_DIRS = new Set(['.mycelia', '.recycle', '.trash', '.git', 'node_modules', 'logseq']);

/** Recursively list all .md files in the vault (excluding internal dirs). */
export async function listAllNotes(vaultPath: string): Promise<string[]> {
	const results: string[] = [];

	async function walk(dir: string, prefix: string) {
		let entries;
		try {
			entries = await readDir(dir);
		} catch {
			// Skip directories we can't read (permissions, symlinks, etc.)
			return;
		}
		for (const entry of entries) {
			const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory) {
				if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
				await walk(await join(dir, entry.name), entryPath);
			} else if (entry.name.endsWith('.md')) {
				results.push(entryPath);
			}
		}
	}

	await walk(vaultPath, '');
	return results;
}

/** Read all markdown files and return as a map of path → content.
 *  Reads in parallel batches of 50 to handle large vaults (2000+ notes). */
export async function readAllNotes(vaultPath: string): Promise<Map<string, string>> {
	const files = await listAllNotes(vaultPath);
	const notes = new Map<string, string>();
	const BATCH_SIZE = 50;

	for (let i = 0; i < files.length; i += BATCH_SIZE) {
		const batch = files.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(
			batch.map(async (file) => {
				try {
					const content = await readNote(vaultPath, file);
					return [file, content] as const;
				} catch {
					return [file, ''] as const;
				}
			})
		);
		for (const [file, content] of results) {
			if (content) notes.set(file, content);
		}
	}

	return notes;
}

/** Save conversation history to .mycelia/chat.json. */
export async function saveConversation(
	vaultPath: string,
	messages: unknown[]
): Promise<void> {
	try {
		const dirPath = await join(vaultPath, '.mycelia');
		const dirExists = await exists(dirPath);
		if (!dirExists) {
			await mkdir(dirPath, { recursive: true });
		}
		const filePath = await join(dirPath, 'chat.json');
		await writeTextFile(filePath, JSON.stringify(messages, null, 2));
	} catch (err) {
		console.warn('Failed to save conversation:', err);
	}
}

/** Load conversation history from .mycelia/chat.json. */
export async function loadConversation(vaultPath: string): Promise<unknown[]> {
	try {
		const filePath = await join(vaultPath, '.mycelia', 'chat.json');
		const fileExists = await exists(filePath);
		if (!fileExists) return [];

		const content = await readTextFile(filePath);
		return JSON.parse(content);
	} catch (err) {
		console.warn('Failed to load conversation:', err);
		return [];
	}
}
