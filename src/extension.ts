import fs from 'node:fs/promises';
import vscode, { Uri } from 'vscode';

async function openSymbolicLinkRealFile(uri: Uri) {
    const realPath = await fs.realpath(uri.fsPath);
    vscode.commands.executeCommand('vscode.open', Uri.file(realPath));
}

async function revealSymbolicLinkRealFolder(uri: Uri) {
    const realPath = await fs.realpath(uri.fsPath);
    vscode.commands.executeCommand('revealInExplorer', Uri.file(realPath));
}

export function activate({ subscriptions }: vscode.ExtensionContext) {
    vscode.commands.registerCommand(
        'vscode-neo-file-utils.openSymbolicLinkRealFile',
        (uri: Uri) => {
            if (uri) {
                openSymbolicLinkRealFile(uri);
            }
        },
        subscriptions,
    );

    vscode.commands.registerCommand(
        'vscode-neo-file-utils.revealSymbolicLinkRealFolder',
        (uri: Uri) => {
            if (uri) {
                revealSymbolicLinkRealFolder(uri);
            }
        },
        subscriptions,
    );
}

// export function deactivate() {}
