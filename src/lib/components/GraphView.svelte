<!-- GraphView — interactive knowledge graph using Cytoscape.js + fCoSE layout. -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import cytoscape from 'cytoscape';
	import fcose from 'cytoscape-fcose';
	import { goto } from '$app/navigation';
	import { FOLDER_COLORS, type GraphData } from '$lib/vault/graph';

	cytoscape.use(fcose);

	let { data }: { data: GraphData } = $props();

	let wrapper: HTMLDivElement;
	let container: HTMLDivElement;
	let cy: cytoscape.Core | null = null;
	let error = $state('');
	let ro: ResizeObserver | null = null;

	function initCytoscape(width: number, height: number) {
		if (cy) return;

		container.style.width = `${width}px`;
		container.style.height = `${height}px`;

		const elements: cytoscape.ElementDefinition[] = [
			...data.nodes.map((n) => ({
				data: {
					id: n.id,
					label: n.name,
					folder: n.folder,
					connections: n.connections,
					color: FOLDER_COLORS[n.folder] || '#cbd5e1',
					size: Math.max(6, 8 + Math.sqrt(n.connections) * 6)
				}
			})),
			...data.links.map((l, i) => ({
				data: { id: `e${i}`, source: l.source, target: l.target }
			}))
		];

		cy = cytoscape({
			container,
			elements,
			style: [
				{
					selector: 'node',
					style: {
						'background-color': 'data(color)',
						'background-opacity': 0.85,
						width: 'data(size)',
						height: 'data(size)',
						label: '',
						'border-width': 0,
						'overlay-padding': '2px',
						'underlay-color': 'data(color)',
						'underlay-padding': '4px',
						'underlay-opacity': 0.15,
						'underlay-shape': 'ellipse'
					}
				},
				{
					selector: 'edge',
					style: {
						width: 0.4,
						'line-color': '#334155',
						'line-opacity': 0.25,
						'curve-style': 'haystack',
						'haystack-radius': 0.6
					}
				},
				{
					selector: 'node.hover',
					style: {
						label: 'data(label)',
						'background-opacity': 1,
						'border-width': 2,
						'border-color': '#f8fafc',
						'border-opacity': 0.9,
						'underlay-opacity': 0.35,
						'underlay-padding': '8px',
						color: '#f1f5f9',
						'font-size': '11px',
						'font-weight': 'bold',
						'text-valign': 'bottom',
						'text-margin-y': 6,
						'text-background-color': '#0f172a',
						'text-background-opacity': 0.85,
						'text-background-padding': '4px',
						'text-background-shape': 'roundrectangle',
						'z-index': 10
					}
				},
				{
					selector: 'node.neighbor',
					style: {
						label: 'data(label)',
						'background-opacity': 1,
						'border-width': 1.5,
						'border-color': 'data(color)',
						'border-opacity': 0.6,
						'underlay-opacity': 0.25,
						'underlay-padding': '6px',
						color: '#94a3b8',
						'font-size': '9px',
						'text-valign': 'bottom',
						'text-margin-y': 4,
						'text-background-color': '#0f172a',
						'text-background-opacity': 0.75,
						'text-background-padding': '3px',
						'text-background-shape': 'roundrectangle',
						'z-index': 5
					}
				},
				{
					selector: 'node.dimmed',
					style: {
						'background-opacity': 0.06,
						'underlay-opacity': 0
					}
				},
				{
					selector: 'edge.highlighted',
					style: {
						'line-color': '#e2e8f0',
						'line-opacity': 0.5,
						width: 1.5
					}
				},
				{
					selector: 'edge.dimmed',
					style: {
						'line-opacity': 0.03
					}
				}
			],
			layout: {
				name: 'fcose',
				animate: false,
				fit: true,
				padding: 40,
				quality: 'default',
				nodeRepulsion: () => 6000,
				idealEdgeLength: () => 80,
				edgeElasticity: () => 0.45,
				gravity: 0.3,
				gravityRange: 1.5,
				numIter: 2500,
				nodeSeparation: 75,
				tilingPaddingVertical: 20,
				tilingPaddingHorizontal: 20
			} as cytoscape.LayoutOptions,
			minZoom: 0.05,
			maxZoom: 6,
			wheelSensitivity: 0.8,
			pixelRatio: 'auto',
			hideEdgesOnViewport: true,
			textureOnViewport: true
		});

		// Hover — highlight neighborhood
		cy.on('mouseover', 'node', (evt) => {
			const node = evt.target;
			const neighborhood = node.closedNeighborhood();
			cy!.elements().not(neighborhood).addClass('dimmed');
			neighborhood.edges().addClass('highlighted');
			neighborhood.nodes().not(node).addClass('neighbor');
			node.addClass('hover');
		});

		cy.on('mouseout', 'node', () => {
			cy!.elements().removeClass('dimmed highlighted hover neighbor');
		});

		cy.on('tap', 'node', (evt) => {
			const id = evt.target.id();
			if (!id.startsWith('_link_')) {
				goto(`/note/${id}`);
			}
		});
	}

	onMount(() => {
		try {
			ro = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (!entry) return;
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) {
					if (!cy) {
						initCytoscape(width, height);
					} else {
						container.style.width = `${width}px`;
						container.style.height = `${height}px`;
						cy.resize();
						cy.fit();
					}
				}
			});
			ro.observe(wrapper);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[GraphView] init failed:', msg);
			error = msg;
		}
	});

	onDestroy(() => {
		ro?.disconnect();
		ro = null;
		cy?.destroy();
		cy = null;
	});
</script>

{#if error}
	<div
		class="absolute inset-0 flex items-center justify-center text-red-400 text-sm p-4"
		style="background: #06080d;"
	>
		Graph error: {error}
	</div>
{/if}
<div bind:this={wrapper} class="w-full h-full" style="position: relative;">
	<div
		bind:this={container}
		style="position: absolute; top: 0; left: 0; background: radial-gradient(ellipse at center, #0c1222 0%, #06080d 70%);"
	></div>
</div>
