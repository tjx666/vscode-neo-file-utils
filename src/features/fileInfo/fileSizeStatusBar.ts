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

    const supportedSchema = new Set(['vscode-userdata', 'file']);
    const updateStatusBar = async () => {
        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor || !supportedSchema.has(activeTextEditor.document.uri.scheme)) {
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

    const { subscriptions } = context;
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, subscriptions);
    vscode.workspace.onDidSaveTextDocument(updateStatusBar, null, subscriptions);

    updateStatusBar();
}
