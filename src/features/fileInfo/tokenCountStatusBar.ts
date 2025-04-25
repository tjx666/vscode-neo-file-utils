// @ts-expect-error maybe we should fix tsconfig
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { debounce } from 'lodash-es';
import vscode from 'vscode';

export async function tokenCountStatusBar(context: vscode.ExtensionContext) {
    let statusBarItem: vscode.StatusBarItem | undefined;

    const createStatusBar = () => {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        statusBarItem.command = 'neo-file-utils.logFileInfo';
        statusBarItem.tooltip = 'Current file tokens count - Click to toggle more info';
        return statusBarItem;
    };

    // Get max file size (in MB) from configuration
    const getMaxFileSize = (): number => {
        const config = vscode.workspace.getConfiguration('neo-file-utils.tokenCounter');
        const maxFileSizeMB = config.get<number>('maxFileSizeMB');
        return maxFileSizeMB! * 1024 * 1024; // Convert to bytes
    };

    // Get display format from configuration
    const getDisplayFormat = (): string => {
        const config = vscode.workspace.getConfiguration('neo-file-utils.tokenCounter');
        return config.get<string>('displayFormat')!;
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

            // Check file size - hide token count if file is too large
            const maxFileSize = getMaxFileSize();
            if (content.length > maxFileSize) {
                statusBarItem.hide();
                return;
            }

            const tokenCount = countTokens(content);

            // Apply display format
            const displayFormat = getDisplayFormat();
            statusBarItem.text = displayFormat.replace('{tokenCount}', tokenCount.toString());

            statusBarItem.show();
        } catch (error) {
            console.error('Error calculating tokens:', error);
            statusBarItem.text = 'Error: token count';
            statusBarItem.show();
        }
    };

    const { subscriptions } = context;

    // Optimize configuration change listener with debounce to reduce unnecessary updates
    vscode.workspace.onDidChangeConfiguration(
        debounce(
            (e) => {
                if (
                    e.affectsConfiguration('neo-file-utils.tokenCounter.maxFileSizeMB') ||
                    e.affectsConfiguration('neo-file-utils.tokenCounter.displayFormat')
                ) {
                    updateStatusBar();
                }
            },
            500,
            {
                leading: true,
                trailing: true,
            },
        ),
        null,
        subscriptions,
    );

    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, subscriptions);
    vscode.workspace.onDidSaveTextDocument(updateStatusBar, null, subscriptions);
    vscode.workspace.onDidChangeTextDocument(
        debounce(
            () => {
                updateStatusBar();
            },
            300,
            {
                leading: false,
                trailing: true,
            },
        ),
        null,
        subscriptions,
    );

    updateStatusBar();
}
