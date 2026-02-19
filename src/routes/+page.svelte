<!-- Chat view — the main conversation interface. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import {
		messages,
		isLoading,
		addUserMessage,
		addAssistantMessage,
		appendToLastMessage,
		finalizeLastMessage
	} from '$lib/stores/chat';
	import { streamResponse } from '$lib/ai/claude';
	import { buildRagContext, invalidateRagCache } from '$lib/ai/rag';
	import { writeJournalEntry } from '$lib/vault/journal';
	import { extractKnowledge } from '$lib/ai/extraction';

	let chatContainer: HTMLDivElement;
	let bgError = $state('');

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	function showBgError(label: string, err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`${label}:`, err);
		bgError = `${label}: ${msg}`;
		setTimeout(() => (bgError = ''), 8000);
	}

	async function handleSend(text: string) {
		addUserMessage(text);
		isLoading.set(true);
		await tick();
		scrollToBottom();

		addAssistantMessage();

		try {
			// Include relevant vault notes as context, scored by query relevance
			const systemPrompt = (await buildRagContext(text)) || undefined;

			const fullResponse = await streamResponse(
				$messages.slice(0, -1),
				(chunk) => {
					appendToLastMessage(chunk);
					scrollToBottom();
				},
				systemPrompt
			);

			finalizeLastMessage();

			writeJournalEntry(text, fullResponse)
				.then(() => invalidateRagCache())
				.catch((err) => showBgError('Journal write failed', err));
			extractKnowledge($messages)
				.then(() => invalidateRagCache())
				.catch((err) => showBgError('Extraction failed', err));
		} catch (error) {
			appendToLastMessage(
				`\n\n*Error: ${error instanceof Error ? error.message : 'Something went wrong'}*`
			);
			finalizeLastMessage();
		} finally {
			isLoading.set(false);
			await tick();
			scrollToBottom();
		}
	}

	onMount(() => {
		scrollToBottom();
	});
</script>

<div class="flex flex-col h-full relative">
	<!-- Error toast -->
	{#if bgError}
		<div class="absolute top-3 right-3 z-50 max-w-sm bg-red-900/80 text-red-200 text-xs px-4 py-2.5 rounded-lg border border-red-800 shadow-lg">
			{bgError}
		</div>
	{/if}

	<!-- Messages -->
	<div
		bind:this={chatContainer}
		class="flex-1 overflow-y-auto px-4 py-6"
	>
		<div class="max-w-3xl mx-auto">
			{#if $messages.length === 0}
				<div class="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
					<div class="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mb-5">
						<span class="text-accent text-xl font-bold">M</span>
					</div>
					<h2 class="text-base font-medium text-text mb-2">What's on your mind?</h2>
					<p class="text-text-secondary text-sm max-w-sm leading-relaxed">
						Share your thoughts, ideas, or anything you're working on. I'll organize it into your knowledge base.
					</p>
				</div>
			{:else}
				{#each $messages as message (message.id)}
					<ChatMessage {message} />
				{/each}

				{#if $isLoading && $messages[$messages.length - 1]?.content === ''}
					<div class="flex gap-3 mb-6">
						<div class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
							<span class="text-accent text-[10px] font-bold">M</span>
						</div>
						<div class="flex gap-1 pt-2">
							<span class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></span>
							<span class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce [animation-delay:150ms]"></span>
							<span class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce [animation-delay:300ms]"></span>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Gradient fade -->
	<div class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-bg via-bg/60 to-transparent pointer-events-none"></div>

	<!-- Input -->
	<div class="relative z-10">
		<ChatInput onsend={handleSend} />
	</div>
</div>
