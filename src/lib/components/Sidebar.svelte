<!-- Sidebar — Reflect-style navigation with icons and labels. -->
<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/daily', label: 'Daily Notes', icon: 'calendar' },
		{ href: '/', label: 'Chat', icon: 'chat' },
		{ href: '/notes', label: 'All Notes', icon: 'files' },
		{ href: '/graph', label: 'Graph', icon: 'network' }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		if (href === '/notes') return pathname.startsWith('/note');
		return pathname.startsWith(href);
	}
</script>

<nav class="flex flex-col w-60 bg-sidebar-bg border-r border-border h-full">
	<!-- Brand -->
	<div class="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
		<div class="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
			<span class="text-accent font-bold text-sm">M</span>
		</div>
		<span class="text-sm font-semibold text-text">Mycelia</span>
	</div>

	<!-- Nav -->
	<div class="flex flex-col gap-0.5 px-3 py-3 flex-1">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors
					{isActive(item.href, $page.url.pathname)
						? 'bg-sidebar-active text-text border-l-2 border-accent'
						: 'text-text-secondary hover:text-text hover:bg-sidebar-hover border-l-2 border-transparent'}"
			>
				{#if item.icon === 'calendar'}
					<svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
					</svg>
				{:else if item.icon === 'chat'}
					<svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
					</svg>
				{:else if item.icon === 'files'}
					<svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
					</svg>
				{:else if item.icon === 'network'}
					<svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
					</svg>
				{/if}
				<span>{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Settings -->
	<div class="px-3 py-3 border-t border-border">
		<a
			href="/settings"
			class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors
				{isActive('/settings', $page.url.pathname)
					? 'bg-sidebar-active text-text border-l-2 border-accent'
					: 'text-text-secondary hover:text-text hover:bg-sidebar-hover border-l-2 border-transparent'}"
		>
			<svg class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			<span>Settings</span>
		</a>
	</div>
</nav>
