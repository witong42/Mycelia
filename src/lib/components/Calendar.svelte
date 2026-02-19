<!-- Calendar — monthly grid widget for navigating daily journal entries. -->
<script lang="ts">
	let {
		selectedDate,
		datesWithEntries,
		onselect
	}: {
		selectedDate: string;
		datesWithEntries: Set<string>;
		onselect: (date: string) => void;
	} = $props();

	const initialYear = parseInt(selectedDate.slice(0, 4));
	const initialMonth = parseInt(selectedDate.slice(5, 7)) - 1;
	let currentYear = $state(initialYear);
	let currentMonth = $state(initialMonth);

	const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const MONTHS = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	function getDaysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDayOfMonth(year: number, month: number): number {
		return new Date(year, month, 1).getDay();
	}

	function formatDate(year: number, month: number, day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function prevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
	}

	function getCalendarDays(year: number, month: number): Array<{ day: number; date: string; isCurrentMonth: boolean }> {
		const firstDay = getFirstDayOfMonth(year, month);
		const daysInMonth = getDaysInMonth(year, month);
		const daysInPrev = month === 0 ? getDaysInMonth(year - 1, 11) : getDaysInMonth(year, month - 1);

		const days: Array<{ day: number; date: string; isCurrentMonth: boolean }> = [];

		// Previous month padding
		for (let i = firstDay - 1; i >= 0; i--) {
			const d = daysInPrev - i;
			const m = month === 0 ? 11 : month - 1;
			const y = month === 0 ? year - 1 : year;
			days.push({ day: d, date: formatDate(y, m, d), isCurrentMonth: false });
		}

		// Current month
		for (let d = 1; d <= daysInMonth; d++) {
			days.push({ day: d, date: formatDate(year, month, d), isCurrentMonth: true });
		}

		// Next month padding (fill to 42 cells for 6 rows)
		const remaining = 42 - days.length;
		for (let d = 1; d <= remaining; d++) {
			const m = month === 11 ? 0 : month + 1;
			const y = month === 11 ? year + 1 : year;
			days.push({ day: d, date: formatDate(y, m, d), isCurrentMonth: false });
		}

		return days;
	}

	const today = new Date().toISOString().slice(0, 10);
</script>

<div class="select-none">
	<!-- Month navigation -->
	<div class="flex items-center justify-between mb-3">
		<button onclick={prevMonth} aria-label="Previous month" class="text-text-secondary hover:text-text p-1 transition-colors">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
			</svg>
		</button>
		<span class="text-[13px] font-medium text-text">{MONTHS[currentMonth]} {currentYear}</span>
		<button onclick={nextMonth} aria-label="Next month" class="text-text-secondary hover:text-text p-1 transition-colors">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
			</svg>
		</button>
	</div>

	<!-- Day headers -->
	<div class="grid grid-cols-7 mb-1">
		{#each DAYS as day}
			<div class="text-center text-[10px] text-text-tertiary py-1">{day}</div>
		{/each}
	</div>

	<!-- Day grid -->
	<div class="grid grid-cols-7">
		{#each getCalendarDays(currentYear, currentMonth) as { day, date, isCurrentMonth }}
			<button
				onclick={() => onselect(date)}
				class="relative flex flex-col items-center justify-center h-8 text-[12px] rounded-md transition-colors
					{date === selectedDate
						? 'bg-accent text-white font-medium'
						: date === today && isCurrentMonth
							? 'ring-1 ring-accent/50 text-accent'
							: isCurrentMonth
								? 'text-text-secondary hover:bg-sidebar-hover hover:text-text'
								: 'text-text-tertiary hover:bg-sidebar-hover/50'}"
			>
				{day}
				{#if datesWithEntries.has(date) && date !== selectedDate}
					<span class="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent"></span>
				{/if}
			</button>
		{/each}
	</div>
</div>
