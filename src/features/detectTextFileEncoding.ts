import fs from 'node:fs/promises';

import chardet from 'chardet';
import type { QuickPickItem, TextEditor } from 'vscode';
import vscode from 'vscode';

export async function detectTextFileEncoding(editor: TextEditor) {
    const buffer = await fs.readFile(editor.document.uri.fsPath);
    const encodingList = chardet.analyse(buffer);
    const item = await vscode.window.showQuickPick(
        encodingList.map((encodingItem) => {
            return {
                label: encodingItem.name,
                detail: `confidence: ${encodingItem.confidence} language: ${
                    encodingItem.lang ?? 'unknown'
                }`,
            } satisfies QuickPickItem;
        }),
        {
            placeHolder: 'click item to copy encoding name to clipboard',
        },
    );
    if (item) {
        await vscode.env.clipboard.writeText(item.label);
    }
}
