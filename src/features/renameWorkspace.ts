import fs from 'node:fs/promises';

import vscode, { Uri } from 'vscode';

export async function renameWorkspace(uri: Uri | undefined) {
    if (uri === undefined) {
        uri = vscode.workspace.workspaceFolders?.[0].uri;
    }

    if (uri === undefined) return;

    const workspaceFolderPath = uri.fsPath;
    const newFolderPath = await vscode.window.showInputBox({
        value: workspaceFolderPath,
    });
    if (newFolderPath) {
        await fs.rename(workspaceFolderPath, newFolderPath);
        await vscode.commands.executeCommand('vscode.openFolder', Uri.file(newFolderPath), false);
    }
}
