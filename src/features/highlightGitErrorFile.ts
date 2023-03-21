import vscode from 'vscode';

export async function highlightGitErrorFile(context: vscode.ExtensionContext) {
    vscode.workspace.onDidOpenTextDocument(
        async (document) => {
            const { uri } = document;
            if (uri.scheme === 'git-output' && /\/git-error-/.test(uri.fsPath)) {
                await vscode.languages.setTextDocumentLanguage(document, 'log');
            }
        },
        null,
        context.subscriptions,
    );
}
