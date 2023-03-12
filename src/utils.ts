import { constants as FS_CONSTANTS } from 'node:fs';
import fs from 'node:fs/promises';

import vscode, { Uri } from 'vscode';

export function pathExists(path: string) {
    return fs
        .access(path, FS_CONSTANTS.F_OK)
        .then(() => true)
        .catch(() => false);
}

export async function getActiveFile() {
    const { activeTextEditor } = vscode.window;
    if (activeTextEditor) {
        return activeTextEditor.document.uri;
    }

    const originalClipboard = await vscode.env.clipboard.readText();

    await vscode.commands.executeCommand('copyFilePath');
    const activeFilePath = await vscode.env.clipboard.readText();

    await vscode.env.clipboard.writeText(originalClipboard);

    return (await pathExists(activeFilePath)) ? Uri.file(activeFilePath) : undefined;
}
