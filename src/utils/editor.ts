import type { TextEditor } from 'vscode';
import { Range } from 'vscode';

export async function replaceEditorWholeText(editor: TextEditor, replace: string) {
    return editor.edit((editBuilder) => {
        const document = editor.document;
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const wholeTextRange = new Range(firstLine.range.start, lastLine.range.end);
        editBuilder.replace(wholeTextRange, replace);
    });
}
