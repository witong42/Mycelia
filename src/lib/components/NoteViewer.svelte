<!-- NoteViewer — renders markdown content with clickable wikilinks. -->
<script lang="ts">
	import { marked } from 'marked';
	import { goto } from '$app/navigation';

	let { content, notePaths = [] }: { content: string; notePaths?: string[] } = $props();

	/** Build a lookup map from note name to path. */
	function buildLookup(paths: string[]): Map<string, string> {
		const map = new Map<string, string>();
		for (const p of paths) {
			const name = p.replace(/\.md$/, '').split('/').pop()?.toLowerCase() || '';
			if (name && !map.has(name)) map.set(name, p);
		}
		return map;
	}

	/** Replace [[wikilinks]] with markdown links. */
	function resolveWikilinks(md: string, lookup: Map<string, string>): string {
		return md.replace(/\[\[([^\]]+)\]\]/g, (_, link: string) => {
			const linkLower = link.toLowerCase();
			const resolved = lookup.get(linkLower);
			if (resolved) {
				return `[${link}](/note/${resolved})`;
			}
			return `**${link}**`;
		});
	}

	function renderContent(raw: string): string {
		const lookup = buildLookup(notePaths);
		const withLinks = resolveWikilinks(raw, lookup);
		// Strip frontmatter before rendering
		const stripped = withLinks.replace(/^---\n[\s\S]*?\n---\n?/, '');
		return marked.parse(stripped, { async: false }) as string;
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const anchor = target.closest('a');
		if (anchor) {
			const href = anchor.getAttribute('href');
			if (href?.startsWith('/note/')) {
				e.preventDefault();
				goto(href);
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			const target = e.target as HTMLElement;
			const anchor = target.closest('a');
			if (anchor) {
				const href = anchor.getAttribute('href');
				if (href?.startsWith('/note/')) {
					e.preventDefault();
					goto(href);
				}
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="prose text-sm leading-relaxed" onclick={handleClick} onkeydown={handleKeydown} role="region">
	{@html renderContent(content)}
</div>
