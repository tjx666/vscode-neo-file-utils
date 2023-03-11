import fs from 'node:fs/promises';

import vscode, { Uri } from 'vscode';

export async function revealSymbolicLinkRealFolder(uri: Uri) {
    const realPath = await fs.realpath(uri.fsPath);
    vscode.commands.executeCommand('revealInExplorer', Uri.file(realPath));
}
