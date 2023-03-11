import fs from 'node:fs/promises';

import vscode, { Uri } from 'vscode';

export async function openSymbolicLinkRealFile(uri: Uri) {
    const realPath = await fs.realpath(uri.fsPath);
    vscode.commands.executeCommand('vscode.open', Uri.file(realPath));
}
