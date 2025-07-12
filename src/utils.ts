import { constants as FS_CONSTANTS } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { execaCommand } from 'execa';
import type { TextEditor } from 'vscode';
import vscode, { Range,Uri } from 'vscode';

import { allExtensionsFolder } from './constants';

export function pathExists(path: string) {
    return fs
        .access(path, FS_CONSTANTS.F_OK)
        .then(() => true)
        .catch(() => false);
}

export async function getActiveFile() {
    const { activeTextEditor } = vscode.window;
    if (activeTextEditor) {
        return activeTextEditor.document.uri;
    }

    const originalClipboard = await vscode.env.clipboard.readText();

    await vscode.commands.executeCommand('copyFilePath');
    const activeFilePath = await vscode.env.clipboard.readText();

    await vscode.env.clipboard.writeText(originalClipboard);

    return (await pathExists(activeFilePath)) ? Uri.file(activeFilePath) : undefined;
}

export async function replaceEditorWholeText(editor: TextEditor, replace: string) {
    return editor.edit((editBuilder) => {
        const document = editor.document;
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const wholeTextRange = new Range(firstLine.range.start, lastLine.range.end);
        editBuilder.replace(wholeTextRange, replace);
    });
}

export async function openFolderInFileExplorer(folderPath: string) {
    return vscode.env.openExternal(Uri.file(folderPath));
}

export function getWorkspaceRootPath() {
    return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
}

export async function getRepositoryInfo() {
    const { stdout } = await execaCommand('git remote -v', {
        cwd: getWorkspaceRootPath(),
    });
    const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const githubRemote = lines.find((line) => line.includes('github.com'));
    if (!githubRemote) return;

    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const regexp = /git@github.com:(?<userName>.+?)\/(?<repositoryName>.+?)\.git/;
    const match = githubRemote.match(regexp);
    if (!match?.groups) return;

    const { groups } = match;
    return {
        userName: groups.userName,
        repositoryName: groups.repositoryName,
    };
}

export async function getExtensionFolders() {
    const fileNames = await fs.readdir(allExtensionsFolder);
    const extensionFolders: string[] = [];
    await Promise.all(
        fileNames.map(async (fileName) => {
            const extensionPath = path.resolve(allExtensionsFolder, fileName);
            if ((await fs.stat(extensionPath)).isDirectory()) {
                extensionFolders.push(fileName);
            }
        }),
    );
    extensionFolders.sort((a, b) => b.localeCompare(a));
    return extensionFolders;
}
