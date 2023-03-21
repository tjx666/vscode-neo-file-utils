import vscode from 'vscode';

import { fileSizeStatusBar } from './features/fileInfo/fileSizeStatusBar';
import { lineCountStatusBar } from './features/fileInfo/lineCountStatusBar';
import { highlightGitErrorFile } from './features/highlightGitErrorFile';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
    const { commands } = vscode;
    const { subscriptions } = context;
    const extName = 'neo-file-utils';

    fileSizeStatusBar(context);
    lineCountStatusBar(context);
    highlightGitErrorFile(context);

    const registerCommand = (
        commandName: string,
        callback: (...args: any[]) => any,
        thisArg?: any,
    ) => {
        const cmd = commands.registerCommand(`${extName}.${commandName}`, callback, thisArg);
        context.subscriptions.push(cmd);
        return cmd;
    };

    const registerTextEditorCommand = (
        commandName: string,
        callback: (
            textEditor: vscode.TextEditor,
            edit: vscode.TextEditorEdit,
            ...args: any[]
        ) => void,
        thisArg?: any,
    ) => {
        const cmd = commands.registerTextEditorCommand(
            `${extName}.${commandName}`,
            callback,
            thisArg,
        );
        context.subscriptions.push(cmd);
        return cmd;
    };

    registerCommand('openSymbolicLinkRealFile', (uri) => {
        return import('./features/openSymbolicLinkRealFile').then((mod) =>
            mod.openSymbolicLinkRealFile(uri),
        );
    });

    registerCommand('revealSymbolicLinkRealFolder', (uri) => {
        return import('./features/revealSymbolicLinkRealFolder').then((mod) =>
            mod.revealSymbolicLinkRealFolder(uri),
        );
    });

    registerTextEditorCommand(
        `detectTextFileEncoding`,
        (editor) => {
            return import('./features/detectTextFileEncoding').then((mod) =>
                mod.detectTextFileEncoding(editor),
            );
        },
        subscriptions,
    );

    registerCommand(
        'logFileInfo',
        () => {
            return import('./features/fileInfo/logFileInfo').then((mod) => mod.logFileInfo());
        },
        subscriptions,
    );

    registerCommand(
        'openNewWorkspaceHere',
        (uri: vscode.Uri) => {
            return commands.executeCommand('vscode.openFolder', uri, true);
        },
        subscriptions,
    );

    registerCommand(
        'reopenWorkspaceHere',
        (uri: vscode.Uri) => {
            return commands.executeCommand('vscode.openFolder', uri, false);
        },
        subscriptions,
    );

    registerTextEditorCommand('smartRevert', (editor) => {
        return import('./features/smartRevert').then((mod) => mod.smartRevert(editor));
    });

    registerCommand('batchRename', (_clickedFile, selectedFiles) => {
        return import('./features/batchRename').then((mod) => mod.batchRename(selectedFiles));
    });

    registerCommand('renameWorkspace', (uri: vscode.Uri | undefined) => {
        return import('./features/renameWorkspace').then((mod) => mod.renameWorkspace(uri));
    });
}

export function deactivate() {
    logger.dispose();
}
