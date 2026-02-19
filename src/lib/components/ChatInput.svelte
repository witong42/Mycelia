<!-- ChatInput — ChatGPT-style pill input with send button. -->
<script lang="ts">
	import { isLoading } from '$lib/stores/chat';

	let { onsend }: { onsend: (text: string) => void } = $props();

	let value = $state('');
	let textarea = $state<HTMLTextAreaElement | null>(null);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function send() {
		const trimmed = value.trim();
		if (!trimmed || $isLoading) return;
		onsend(trimmed);
		value = '';
		if (textarea) textarea.style.height = 'auto';
	}

	function autoResize() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
	}
</script>

<div class="p-4 pb-6">
	<div class="max-w-3xl mx-auto">
		<div class="flex items-end gap-2 bg-bg-secondary border border-border rounded-3xl px-4 py-2.5">
			<textarea
				bind:this={textarea}
				bind:value
				onkeydown={handleKeydown}
				oninput={autoResize}
				placeholder={$isLoading ? 'Thinking...' : 'Talk to Mycelia...'}
				disabled={$isLoading}
				rows="1"
				class="flex-1 bg-transparent text-text text-sm resize-none border-none
					focus:outline-none placeholder-text-secondary
					disabled:opacity-50 leading-relaxed"
			></textarea>
			<button
				onclick={send}
				disabled={!value.trim() || $isLoading}
				aria-label="Send message"
				class="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0
					hover:bg-accent-hover disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
			>
				<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
				</svg>
			</button>
		</div>
	</div>
</div>
