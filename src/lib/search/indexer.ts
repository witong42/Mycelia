// BM25 full-text search index for vault notes.
// Builds an inverted index in memory, scores queries using BM25 (same algorithm as Elasticsearch).
// Handles 2000+ notes with instant query times — only scans docs containing query terms.

const STOP_WORDS = new Set([
	'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'he', 'she', 'they', 'them',
	'a', 'an', 'the', 'this', 'that', 'these', 'those',
	'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
	'not', 'no', 'nor', 'so', 'if', 'or', 'and', 'but', 'for', 'of', 'to', 'in', 'on', 'at',
	'by', 'with', 'from', 'up', 'out', 'about', 'into', 'through', 'after', 'before',
	'what', 'which', 'who', 'when', 'where', 'how', 'why',
	'all', 'any', 'some', 'more', 'most', 'other', 'than', 'just', 'also', 'very',
	'there', 'here', 'now', 'then', 'much', 'many'
]);

/** Tokenize text into lowercase terms, stripping punctuation and stop words. */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

interface DocEntry {
	content: string;
	wordCount: number;
	termFreqs: Map<string, number>;
}

export interface SearchResult {
	path: string;
	score: number;
	content: string;
}

export class VaultIndex {
	private docs = new Map<string, DocEntry>();
	private invertedIndex = new Map<string, Set<string>>();
	private totalDocs = 0;
	private avgDocLength = 0;

	// BM25 tuning parameters
	private k1 = 1.2;
	private b = 0.75;

	/** Build the index from a map of path → content. */
	build(notes: Map<string, string>): void {
		this.docs.clear();
		this.invertedIndex.clear();

		let totalWords = 0;

		for (const [path, content] of notes) {
			if (!content.trim()) continue;

			// Tokenize content + path (so filename terms are searchable)
			const pathTerms = tokenize(path.replace(/[/\\._-]/g, ' '));
			const contentTerms = tokenize(content);
			const allTerms = [...pathTerms, ...pathTerms, ...contentTerms]; // path terms counted twice

			const termFreqs = new Map<string, number>();
			for (const term of allTerms) {
				termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
			}

			this.docs.set(path, { content, wordCount: allTerms.length, termFreqs });
			totalWords += allTerms.length;

			for (const term of termFreqs.keys()) {
				let docSet = this.invertedIndex.get(term);
				if (!docSet) {
					docSet = new Set();
					this.invertedIndex.set(term, docSet);
				}
				docSet.add(path);
			}
		}

		this.totalDocs = this.docs.size;
		this.avgDocLength = this.totalDocs > 0 ? totalWords / this.totalDocs : 0;
	}

	/** Search for notes matching a query. Returns top results sorted by BM25 score. */
	search(query: string, limit: number = 20): SearchResult[] {
		const queryTerms = tokenize(query);
		if (queryTerms.length === 0) return [];

		// Collect candidate docs (only those containing at least one query term)
		const candidateDocs = new Set<string>();
		for (const term of queryTerms) {
			const docs = this.invertedIndex.get(term);
			if (docs) {
				for (const doc of docs) candidateDocs.add(doc);
			}
		}

		// Score each candidate with BM25
		const results: SearchResult[] = [];

		for (const path of candidateDocs) {
			const doc = this.docs.get(path)!;
			let score = 0;

			for (const term of queryTerms) {
				const tf = doc.termFreqs.get(term) || 0;
				if (tf === 0) continue;

				const df = this.invertedIndex.get(term)?.size || 0;
				const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);
				const tfNorm =
					(tf * (this.k1 + 1)) /
					(tf + this.k1 * (1 - this.b + this.b * (doc.wordCount / this.avgDocLength)));

				score += idf * tfNorm;
			}

			if (score > 0) {
				results.push({ path, score, content: doc.content });
			}
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, limit);
	}

	/** Get content for a specific note path. */
	getContent(path: string): string | undefined {
		return this.docs.get(path)?.content;
	}

	/** Number of indexed documents. */
	get size(): number {
		return this.docs.size;
	}
}
