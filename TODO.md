# Mycelia — TODO

Tasks are grouped by phase. Items marked **[MVP]** are required for the first public desktop release. Items marked **[CLOUD]** are for the subscription tier.

---

## Phase 1 — Desktop MVP (ship the $99 product)

### In progress / next up

- [ ] **[MVP] Vector search for RAG** — Replace context stuffing with proper embedding-based retrieval. Store embeddings locally (sqlite-vec or similar) and retrieve only the top-K relevant chunks per query. The current approach loads every note into the prompt, which breaks at scale.

- [ ] **[MVP] Note browser / viewer** — Users can't read their vault inside the app. Add a notes panel that lists vault files by folder, lets you open and read them, and highlights wikilinks. Clicking a wikilink should navigate to that note.

- [ ] **[MVP] Full-text search** — Search across all vault markdown files by keyword. Simple grep-style scan initially; can be replaced with indexed search later.

### Core features

- [ ] **[MVP] Multi-conversation support** — Add named conversations/sessions, each with its own chat history. Users need separate threads for work, personal, projects, etc.

- [ ] **[MVP] Ollama / local model integration** — Add support for local models via Ollama as the free tier backend. Users who don't want to pay for anything get a working product with llama/mistral. Model selection in settings alongside the Claude options.

- [ ] **[MVP] Settings validation** — Validate API key format on entry (starts with `sk-ant-`) and test it with a cheap API call before accepting. Show clear errors for invalid keys. Also validate Ollama connection when local model is selected.

- [ ] **System tray** — Run Mycelia in the background. A tray icon lets the user open the window or start a quick capture without bringing up the full app.

- [ ] **Auto-update** — Implement `tauri-plugin-updater` so the app can update itself. Ship update manifests to a static hosting endpoint. Updates are free forever.

- [ ] **App icon and branding** — Replace placeholder Tauri icons with real Mycelia branding. Design a proper icon for macOS, Windows, and Linux.

- [ ] **Note editing** — Allow the user to edit a note directly in the app. Edits write back to the markdown file on disk.

- [ ] **Wikilink navigation in graph** — Clicking a node in the graph view should open that note in a side panel.

- [ ] **Conversation export** — Export a conversation as markdown or plain text.

---

## Phase 2 — MCP Integration (the Claude-native experience)

- [ ] **MCP server implementation** — Build an MCP server (Node sidecar or Rust native) that exposes the vault as MCP tools. Core tools to expose:
  - **File access**: read/write markdown notes in the vault
  - **Search/retrieval**: RAG pipeline as a tool (vector search + full-text)
  - **Graph traversal**: query wikilink relationships, find connected notes, traverse the knowledge graph
  - **Memory**: custom memory tools backed by the vault

- [ ] **MCP server auto-start** — The MCP server starts automatically with the Tauri app and registers itself so Claude.ai Desktop can discover and connect to it.

- [ ] **MCP tool schema design** — Design the tool schemas that Claude.ai will use to interact with the vault. Keep them simple and composable: `read_note`, `search_notes`, `list_notes`, `get_connections`, `write_note`, etc.

- [ ] **MCP documentation / onboarding** — Guide users through connecting Claude.ai Desktop to Mycelia's MCP server. In-app instructions and a setup wizard.

---

## Phase 3 — Cloud & Web (the subscription product)

- [ ] **[CLOUD] Auth system** — User accounts for the cloud tier. Email + password or OAuth. Required for sync, web access, and managed API.

- [ ] **[CLOUD] Sync infrastructure** — Bidirectional vault sync between desktop and cloud. CRDTs (Yjs or Automerge) for conflict resolution when two devices edit the same note. Backend storage on S3/R2/Supabase.

- [ ] **[CLOUD] Web interface** — A SvelteKit web app that provides the same vault, graph, and chat experience as the desktop app. Shares Svelte components with the Tauri frontend. Accessible from any browser or phone.

- [ ] **[CLOUD] Managed API backend** — Server-side Claude API integration for subscription users. Users get Claude without managing their own key. Needs usage metering and rate limiting.

- [ ] **[CLOUD] Mobile companion** — A minimal iOS/Android app or PWA that lets users chat with their vault, send quick notes, or capture voice memos. Targets the same synced vault.

---

## Quality and reliability

- [ ] **Better error handling** — Add a proper error log view and retry mechanism for failed writes. The background extraction and journal tasks currently only surface errors as dismissable toasts.

- [ ] **Extraction reliability** — The parser that splits Claude's output into note blocks is fragile. Add validation, better fallback handling, and logging of raw extraction responses for debugging.

- [ ] **Test coverage** — No tests exist. Add unit tests for the pure functions in `parser.ts`, `graph.ts`, and `rag.ts`. Add integration tests for the extraction pipeline using fixture conversations.

- [ ] **TypeScript strictness** — Several `any` casts exist in `GraphView.svelte` due to the force-graph library's untyped API. Wrap the library with a typed adapter.

- [ ] **Stale vault path handling** — If the vault directory is moved or deleted, the app shows a generic error. Improve this to guide the user through reselecting the vault.

- [ ] **Extraction deduplication** — The model sometimes creates duplicate notes for the same topic. Add a deduplication pass that compares filenames before writing.

---

## Performance

- [ ] **Lazy vault loading** — `readAllNotes` loads all vault files into memory for RAG. Switch to streaming/chunked reads and index on a background thread.

- [ ] **Graph performance** — The force-graph simulation can become sluggish with hundreds of nodes. Add a node-count threshold that switches to a simplified rendering mode.

---

## Done

- [x] Chat interface with Claude API streaming
- [x] Configurable conversation and extraction models (Opus / Sonnet / Haiku)
- [x] Knowledge extraction with YAML frontmatter, wikilinks, and folder routing
- [x] Append mode for existing notes
- [x] Daily journal with timestamped entries
- [x] Force-graph visualization of wikilink connections
- [x] Color-coded graph nodes by folder
- [x] Phantom nodes for unresolved wikilinks
- [x] RAG retrieval via pattern detection and context stuffing
- [x] Settings page (API key, vault path, models, writing perspective)
- [x] First/second person writing perspective toggle
- [x] Onboarding wizard (2-step: API key + vault directory)
- [x] Chat persistence to `.mycelia/chat.json`
- [x] Vault folder structure initialization on first run
- [x] Obsidian-compatible markdown output
- [x] Background task error surfacing (toast)
