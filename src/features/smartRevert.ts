import path from 'node:path';

import { execa } from 'execa';
import vscode from 'vscode';

function getDirectory(filePath: string) {
    return path.resolve(filePath, '..');
}

async function checkFileGitChanged(filePath: string) {
    const { stdout } = await execa('git', ['diff', '--name-only', filePath], {
        cwd: getDirectory(filePath),
    });
    return stdout.trim().length > 0;
}

async function checkFileStaged(filePath: string) {
    const { stdout } = await execa('git', ['diff', '--name-only', '--cached', filePath], {
        cwd: getDirectory(filePath),
    });
    return stdout.trim().length > 0;
}

export async function smartRevert(editor: vscode.TextEditor) {
    if (editor.document.isDirty) {
        vscode.window.setStatusBarMessage('revert modification', 3000);
        await vscode.commands.executeCommand('workbench.action.files.revert');
        return;
    }

    const filePath = editor.document.uri.fsPath;

    if (await checkFileGitChanged(filePath)) {
        vscode.window.setStatusBarMessage('discard git changes', 3000);
        await execa('git', ['checkout', '--', filePath], {
            cwd: getDirectory(filePath),
        });
        return;
    }

    if (await checkFileStaged(filePath)) {
        vscode.window.setStatusBarMessage('unstage git changes', 3000);
        await execa('git', ['reset', 'HEAD', filePath], {
            cwd: getDirectory(filePath),
        });
    }
}
