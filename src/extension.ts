import vscode from 'vscode';

import { fileSizeStatusBar } from './features/fileInfo/fileSizeStatusBar';
import { lineCountStatusBar } from './features/fileInfo/lineCountStatusBar';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
    const { commands } = vscode;
    const { subscriptions } = context;
    const extName = 'neo-file-utils';

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
        import('./features/openSymbolicLinkRealFile').then((mod) =>
            mod.openSymbolicLinkRealFile(uri),
        );
    });

    registerCommand('revealSymbolicLinkRealFolder', (uri) => {
        import('./features/revealSymbolicLinkRealFolder').then((mod) =>
            mod.revealSymbolicLinkRealFolder(uri),
        );
    });

    registerTextEditorCommand(
        `detectTextFileEncoding`,
        (editor) => {
            import('./features/detectTextFileEncoding').then((mod) =>
                mod.detectTextFileEncoding(editor),
            );
        },
        subscriptions,
    );

    registerCommand(
        'logFileInfo',
        () => {
            import('./features/fileInfo/logFileInfo').then((mod) => mod.logFileInfo());
        },
        subscriptions,
    );

    fileSizeStatusBar(context);
    lineCountStatusBar(context);

    registerCommand(
        'openNewWorkbenchHere',
        (uri: vscode.Uri) => {
            commands.executeCommand('vscode.openFolder', uri, true);
        },
        subscriptions,
    );

    registerCommand(
        'reopenWorkbenchHere',
        (uri: vscode.Uri) => {
            commands.executeCommand('vscode.openFolder', uri, false);
        },
        subscriptions,
    );

    registerTextEditorCommand('smartRevert', (editor) => {
        import('./features/smartRevert').then((mod) => mod.smartRevert(editor));
    });
}

export function deactivate() {
    logger.dispose();
}
