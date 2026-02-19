// Graph data builder — transforms vault files into nodes and links for visualization.

import { extractWikilinks, extractFrontmatter, getFolderFromPath } from './parser';

export interface GraphNode {
	[key: string]: unknown;
	id: string;
	name: string;
	folder: string;
	connections: number;
}

export interface GraphLink {
	[key: string]: unknown;
	source: string;
	target: string;
}

export interface GraphData {
	nodes: GraphNode[];
	links: GraphLink[];
}

/** Folder-to-color mapping for graph visualization. */
export const FOLDER_COLORS: Record<string, string> = {
	// Logseq folders
	pages: '#7dd3fc', // sky-300
	journals: '#fcd34d', // amber-300
	assets: '#c4b5fd', // violet-300
	draws: '#f9a8d4', // pink-300
	whiteboards: '#6ee7b7', // emerald-300
	// Mycelia folders
	topics: '#7dd3fc',
	people: '#6ee7b7',
	projects: '#c4b5fd',
	decisions: '#fca5a5', // red-300
	ideas: '#f9a8d4',
	root: '#cbd5e1' // slate-300
};

/** Build graph data from vault notes. */
export function buildGraphData(notes: Map<string, string>): GraphData {
	const nodeMap = new Map<string, GraphNode>();
	const links: GraphLink[] = [];

	// Create nodes for each file
	for (const [path] of notes) {
		const content = notes.get(path)!;
		const frontmatter = extractFrontmatter(content);
		const folder = getFolderFromPath(path);
		const name = frontmatter.title || path.replace(/\.md$/, '').split('/').pop() || path;

		nodeMap.set(path, {
			id: path,
			name,
			folder,
			connections: 0
		});
	}

	// Extract links from wikilinks
	for (const [path, content] of notes) {
		const wikilinks = extractWikilinks(content);

		for (const link of wikilinks) {
			const linkLower = link.toLowerCase();

			// Find matching node by name or filename
			let targetPath: string | null = null;
			for (const [nodePath, node] of nodeMap) {
				if (
					node.name.toLowerCase() === linkLower ||
					nodePath.toLowerCase().includes(linkLower)
				) {
					targetPath = nodePath;
					break;
				}
			}

			if (!targetPath) {
				// Create a phantom node for unresolved links
				const phantomId = `_link_${linkLower}`;
				if (!nodeMap.has(phantomId)) {
					nodeMap.set(phantomId, {
						id: phantomId,
						name: link,
						folder: 'root',
						connections: 0
					});
				}
				targetPath = phantomId;
			}

			if (path !== targetPath) {
				links.push({ source: path, target: targetPath });
				const sourceNode = nodeMap.get(path);
				const targetNode = nodeMap.get(targetPath);
				if (sourceNode) sourceNode.connections++;
				if (targetNode) targetNode.connections++;
			}
		}
	}

	return {
		nodes: Array.from(nodeMap.values()),
		links
	};
}
