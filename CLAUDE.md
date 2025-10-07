# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A VSCode extension providing file utilities like symbolic link navigation, file encoding detection, batch operations, and status bar enhancements. Supports multiple IDEs: VSCode, Cursor, Windsurf, and Trae.

## Quality Check

- `mcp__vscode-mcp__get_diagnostics`

## Architecture

**Entry Point:** `src/extension.ts`

- Registers all commands with lazy loading (dynamic imports)
- Initializes status bar providers: file size, line count, token count
- Uses helper functions `registerCommand()` and `registerTextEditorCommand()` to auto-prefix commands with `neo-file-utils.`

**Feature Organization:**

- Each feature is a separate file in `src/features/`
- Features are dynamically imported when commands are invoked to reduce extension activation time
- File info features grouped under `src/features/fileInfo/`

**Utils:**

- `src/utils/ide.ts` - IDE detection (VSCode/Cursor/Windsurf/Trae) via `getCurrentIDE()`
- `src/utils/vscode-api.ts` - VSCode API wrappers
- `src/utils/editor.ts` - Editor-related utilities
- `src/utils/file.ts` - File system utilities

**Multi-IDE Support:**

- Extension works across VSCode, Cursor, Windsurf, and Trae
- IDE type is detected via `vscode.env.appName` in `src/utils/ide.ts`
- Extension folder paths are calculated based on detected IDE (e.g., `~/.cursor/extensions`, `~/.windsurf/extensions`)
- Constants in `src/constants.ts` handle IDE-specific paths
