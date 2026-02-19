<!-- ChatMessage — ChatGPT-style message layout with markdown rendering. -->
<script lang="ts">
	import type { ChatMessage } from '$lib/stores/chat';
	import { marked } from 'marked';

	let { message }: { message: ChatMessage } = $props();

	function renderMarkdown(content: string): string {
		return marked.parse(content, { async: false }) as string;
	}
</script>

{#if message.role === 'user'}
	<div class="flex justify-end mb-6">
		<div class="max-w-[70%] bg-user-bubble text-text rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
			{message.content}
		</div>
	</div>
{:else}
	<div class="flex gap-3 mb-6">
		<div class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
			<span class="text-accent text-[10px] font-bold">M</span>
		</div>
		<div class="prose text-sm leading-relaxed flex-1 min-w-0">
			{@html renderMarkdown(message.content)}
		</div>
	</div>
{/if}
