// @ts-expect-error maybe we should fix tsconfig
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import vscode from 'vscode';

// Set file size threshold (in bytes), files larger than this will skip token counting
const MAX_FILE_SIZE_FOR_TOKEN_COUNT = 1024 * 1024; // 1MB

export async function tokenCountStatusBar(context: vscode.ExtensionContext) {
    let statusBarItem: vscode.StatusBarItem | undefined;

    const createStatusBar = () => {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        statusBarItem.command = 'neo-file-utils.logFileInfo';
        statusBarItem.tooltip = 'Current file tokens count - Click to toggle more info';
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

        try {
            const { document } = activeTextEditor;
            const content = document.getText();

            // 检查文件大小，如果文件太大则隐藏token计数
            if (content.length > MAX_FILE_SIZE_FOR_TOKEN_COUNT) {
                statusBarItem.hide();
                return;
            }

            const tokenCount = countTokens(content);

            statusBarItem.text = `${tokenCount} tokens`;
            statusBarItem.show();
        } catch (error) {
            console.error('Error calculating tokens:', error);
            statusBarItem.text = 'Error: token count';
            statusBarItem.show();
        }
    };

    const { subscriptions } = context;
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, subscriptions);
    vscode.workspace.onDidSaveTextDocument(updateStatusBar, null, subscriptions);
    vscode.workspace.onDidChangeTextDocument(updateStatusBar, null, subscriptions);

    updateStatusBar();
}
