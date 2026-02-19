# Mycelia — Project Context

## Overview

Mycelia (mycelia.garden) is a conversation-first personal knowledge base. The user chats with an AI; a second AI automatically extracts, organizes, and writes that conversation into an Obsidian-compatible markdown vault.

The product ships as a local-first desktop app (Tauri) with an optional cloud tier that adds a web interface, cross-device sync, and managed AI. The desktop app also exposes an MCP server so Claude.ai Desktop can natively access the user's vault, graph, and RAG tools.

## Stack

- **Runtime**: Tauri v2 (Rust backend, WebView frontend)
- **Frontend**: SvelteKit + Svelte 5 + TypeScript + Tailwind CSS v4
- **AI**: Anthropic Claude API — direct browser access via `anthropic-dangerous-direct-browser-access: true` header (no proxy needed in Tauri context)
- **Graph**: force-graph (canvas-based force-directed visualization)
- **Persistence**: tauri-plugin-store (settings), tauri-plugin-fs (vault markdown files)
- **Package manager**: bun (never npm)

## Business model

- **Free**: Local model (Ollama), core vault + graph features, no account required
- **$99 one-time**: BYOK (user's own Anthropic key), full Claude access, all future updates free
- **Subscription**: Managed Claude API, cloud sync, web interface, MCP integration

## Key constraints

- All vault output must be plain markdown with YAML frontmatter and `[[wikilinks]]` — Obsidian-compatible, no proprietary format.
- Desktop app works fully offline with no account. API calls go directly from the Tauri WebView to Anthropic (BYOK) or to a local Ollama instance (free tier).
- Vault is a user-selected directory. The app must never assume a fixed path.
- Settings and chat history are local-only on the desktop tier. Cloud tier adds optional sync.
- MCP server exposes vault tools to Claude.ai Desktop — no API key needed for MCP users (they use their own Claude subscription).

## Architecture decisions

- **Two-model design**: A larger conversational model (default: Sonnet) handles chat streaming; a faster, cheaper model (default: Haiku) handles background extraction and journal writes. Both are configurable independently.
- **Background tasks after each exchange**: `writeJournalEntry` and `extractKnowledge` run in parallel after every assistant response. Errors are surfaced as dismissable toasts but do not block the chat.
- **Context stuffing for RAG (current MVP)**: Retrieval queries are detected by regex pattern matching. When triggered, all vault notes are read and injected into the system prompt. This works for small vaults but will not scale — vector search is the intended replacement.
- **Extraction parser is prompt-dependent**: The note block format (`---` frontmatter, `===` separator) relies on Claude returning a specific structure. The parser is tolerant of whitespace variations but fragile to format changes. Handle with care.
- **Append semantics**: `writeNote` in `filesystem.ts` appends to an existing file rather than overwriting it. The extraction engine instructs the model to specify `mode: append` when an existing file should be updated.

## File layout (source only)

```
src/lib/ai/         — Claude client, extraction engine, RAG
src/lib/vault/      — Filesystem ops, graph builder, journal writer, markdown parser
src/lib/stores/     — Svelte stores for chat messages and settings
src/lib/components/ — UI components (chat, graph, sidebar, onboarding)
src/routes/         — SvelteKit pages (chat, graph, settings)
src-tauri/src/      — Rust: plugin registration only (lib.rs + main.rs)
```

## Roadmap phases

**Phase 1 — Desktop MVP** (ship the $99 product): Vector search, note browser, full-text search, Ollama integration, multi-conversation support.

**Phase 2 — MCP Integration**: Build and ship the MCP server so Claude.ai Desktop users get native vault access. Key differentiator — very few tools offer this yet.

**Phase 3 — Cloud & Web**: Auth, sync infrastructure (CRDTs), web interface (SvelteKit), managed API backend, mobile companion.

See TODO.md for the full task list.

## Known issues / gotchas

- `GraphView.svelte` uses `any` casts for the force-graph API — the library has no useful type definitions.
- The extraction parser splits on `===` as a note separator; if Claude includes `===` in note body content, blocks will be split incorrectly.
- `readAllNotes` loads the entire vault into memory synchronously — fine for small vaults, will be slow at scale.
- The Tauri capabilities file (`src-tauri/capabilities/default.json`) must explicitly grant filesystem permissions to the user's chosen vault directory. Ensure this is kept in sync with any new Tauri plugin additions.
