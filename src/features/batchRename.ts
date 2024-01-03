import fs from 'node:fs/promises';
import path from 'node:path';

import { temporaryFile } from 'tempy';
import vscode, { Uri } from 'vscode';

import { pathExists, replaceEditorWholeText } from '../utils';

export async function batchRename(selectedFiles: vscode.Uri[]) {
    if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) return;

    const selectedItems = selectedFiles.map((file) => {
        const baseName = path.basename(file.fsPath);
        return {
            filePath: file.fsPath,
            baseName,
            basePath: file.fsPath.slice(0, -baseName.length),
        };
    });

    const content = selectedItems.map((file) => file.baseName).join('\n');
    const tempFile = temporaryFile({ name: 'Batch Rename.txt' });
    await fs.writeFile(tempFile, content, 'utf8');
    const document = await vscode.workspace.openTextDocument(Uri.file(tempFile));
    const editor = await vscode.window.showTextDocument(document);
    await replaceEditorWholeText(editor, content);

    const renameFiles = async () => {
        const newNames = document
            .getText()
            .split(/[\n\r]+/)
            .filter((newName) => newName.trim() !== '');
        let renamedCount = 0;
        if (newNames.length === selectedFiles.length) {
            await Promise.all(
                [...selectedItems.entries()].map(async ([index, item]) => {
                    const newName = newNames[index];

                    let num = 1;
                    let newPath = item.basePath + newName;
                    if (newPath === item.filePath) return;

                    // eslint-disable-next-line no-await-in-loop
                    while (await pathExists(newPath)) {
                        const ext = path.extname(item.baseName);
                        newPath = `${item.basePath + ext.slice(0, -ext.length)}_${num}${ext}`;
                        num++;
                    }

                    await fs.rename(item.filePath, newPath);
                    renamedCount++;
                }),
            );
            vscode.window.setStatusBarMessage(`rename ${renamedCount} files successfully`, 3000);
        } else {
            await vscode.window.showInformationMessage(
                "The new file names count don't match the selected files count",
            );
        }
    };

    const registration = vscode.workspace.onWillSaveTextDocument(async (e) => {
        if (e.document !== document) return;

        try {
            await renameFiles();
        } finally {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            await fs.unlink(tempFile);
            registration.dispose();
        }
    });
}
