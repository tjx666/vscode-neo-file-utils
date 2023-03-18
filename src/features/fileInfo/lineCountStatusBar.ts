import throttle from 'lodash-es/throttle';
import vscode from 'vscode';

function getNumberOfSelectedLines(editor: vscode.TextEditor): number {
    return editor.selections.reduce(
        (pre, selection) =>
            pre +
            selection.end.line -
            selection.start.line +
            (selection.end.character - selection.start.character === 0 ? 0 : 1),
        0,
    );
}

export async function lineCountStatusBar(context: vscode.ExtensionContext) {
    let statusBarItem: vscode.StatusBarItem | undefined;

    const _updateStatusBar = async () => {
        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor || activeTextEditor.document.uri.scheme !== 'file') {
            statusBarItem?.hide();
            return;
        }

        if (!statusBarItem) {
            statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 110);
        }

        const { document } = activeTextEditor;
        let text = `Lns ${document.lineCount}`;
        const selectedLineCount = getNumberOfSelectedLines(activeTextEditor);
        if (selectedLineCount > 0) {
            text += ` (${selectedLineCount} selected)`;
        }
        statusBarItem.text = text;
        statusBarItem.show();
    };
    const updateStatusBar = throttle(_updateStatusBar, 16);

    const { subscriptions } = context;
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, subscriptions);
    vscode.window.onDidChangeTextEditorSelection(updateStatusBar, null, subscriptions);
    updateStatusBar();
}
