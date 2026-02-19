<!-- MarkdownEditor — WYSIWYG markdown editing powered by TipTap (ProseMirror). -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';
	import { goto } from '$app/navigation';

	let {
		content = '',
		placeholder = 'Start writing...',
		onsave,
		class: className = ''
	}: {
		content?: string;
		placeholder?: string;
		onsave?: (markdown: string) => void;
		class?: string;
	} = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();
	let lastSavedContent = content;

	onMount(() => {
		if (!element) return;

		// Pre-process: convert [[wikilinks]] to placeholder marks so they survive the round-trip
		const processed = preprocessWikilinks(content);

		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3, 4] }
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: { class: 'wikilink' }
				}),
				Placeholder.configure({ placeholder }),
				Markdown.configure({
					html: false,
					transformPastedText: true,
					transformCopiedText: true
				})
			],
			content: processed,
			editorProps: {
				attributes: {
					class: 'prose text-sm leading-relaxed outline-none min-h-[120px]'
				},
				handleClick: (_view, _pos, event) => {
					// Handle wikilink clicks (navigate to note)
					const target = event.target as HTMLElement;
					const anchor = target.closest('a');
					if (anchor) {
						const href = anchor.getAttribute('href');
						if (href?.startsWith('/note/')) {
							event.preventDefault();
							goto(href);
							return true;
						}
					}
					return false;
				},
				handleKeyDown: (_view, event) => {
					if ((event.metaKey || event.ctrlKey) && event.key === 's') {
						event.preventDefault();
						saveContent();
						return true;
					}
					return false;
				}
			},
			onUpdate: ({ editor: e }) => {
				// Debounced auto-save
				clearTimeout(autoSaveTimer);
				autoSaveTimer = window.setTimeout(() => {
					saveContent();
				}, 1500);
			}
		});
	});

	onDestroy(() => {
		clearTimeout(autoSaveTimer);
		// Save any pending changes before destroying
		if (editor && onsave) {
			const md = getMarkdown();
			if (md !== lastSavedContent) {
				onsave(md);
			}
		}
		editor?.destroy();
	});

	let autoSaveTimer: number;

	function getMarkdown(): string {
		if (!editor) return content;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const md = (editor.storage as any).markdown.getMarkdown() as string;
		// Post-process: restore [[wikilinks]] from link format
		return postprocessWikilinks(md);
	}

	function saveContent() {
		if (!editor || !onsave) return;
		const md = getMarkdown();
		if (md !== lastSavedContent) {
			lastSavedContent = md;
			onsave(md);
		}
	}

	/** Convert [[wikilinks]] to markdown links before feeding to TipTap. */
	function preprocessWikilinks(md: string): string {
		// [[link text]] → [link text](wikilink://link text)
		return md.replace(/\[\[([^\]]+)\]\]/g, '[$1](wikilink://$1)');
	}

	/** Convert wikilink:// links back to [[wikilinks]] in markdown output. */
	function postprocessWikilinks(md: string): string {
		// [link text](wikilink://link text) → [[link text]]
		return md.replace(/\[([^\]]+)\]\(wikilink:\/\/[^)]+\)/g, '[[$1]]');
	}

	/** Update editor content from parent (e.g., when navigating to a different note). */
	export function setContent(newContent: string) {
		if (!editor) return;
		const processed = preprocessWikilinks(newContent);
		editor.commands.setContent(processed);
		lastSavedContent = newContent;
	}
</script>

<div bind:this={element} class={className}></div>

<style>
	/* Editor placeholder */
	:global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--color-text-tertiary);
		pointer-events: none;
		height: 0;
		font-style: italic;
	}

	/* Wikilink styling — render as accent-colored links */
	:global(.tiptap a.wikilink),
	:global(.tiptap a[href^='wikilink://']) {
		color: var(--color-accent);
		text-decoration: none;
		cursor: pointer;
		border-bottom: 1px solid var(--color-accent-muted);
	}
	:global(.tiptap a.wikilink:hover),
	:global(.tiptap a[href^='wikilink://']:hover) {
		text-decoration: underline;
	}

	/* Focus ring on editor */
	:global(.tiptap:focus) {
		outline: none;
	}

	/* Make sure the editor fills its container */
	:global(.tiptap) {
		min-height: inherit;
	}
</style>
