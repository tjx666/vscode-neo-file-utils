import vscode from 'vscode';

import { getFilePrettySize } from './getFileInfo';

export async function fileSizeStatusBar(context: vscode.ExtensionContext) {
    let statusBarItem: vscode.StatusBarItem | undefined;

    const createStatusBar = () => {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
        statusBarItem.command = 'neo-file-utils.logFileInfo';
        statusBarItem.tooltip = 'Current file size - Click to toggle more info';
        return statusBarItem;
    };

    const updateStatusBar = async () => {
        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor || activeTextEditor.document.uri.scheme !== 'file') {
            statusBarItem?.hide();
            return;
        }

        if (!statusBarItem) {
            statusBarItem = createStatusBar();
        }

        const { document } = activeTextEditor;
        const prettySize = await getFilePrettySize(document.uri.fsPath);
        statusBarItem.text = prettySize;
        statusBarItem.show();
    };

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(updateStatusBar));

    updateStatusBar();
}
