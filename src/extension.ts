import vscode from 'vscode';

import { fileSizeStatusBar } from './features/fileInfo/fileSizeStatusBar';
import { lineCountStatusBar } from './features/fileInfo/lineCountStatusBar';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
    const { subscriptions } = context;
    const extName = 'neo-file-utils';

    vscode.commands.registerCommand(
        `${extName}.openSymbolicLinkRealFile`,
        (uri) => {
            import('./features/openSymbolicLinkRealFile').then((mod) =>
                mod.openSymbolicLinkRealFile(uri),
            );
        },
        subscriptions,
    );

    vscode.commands.registerCommand(
        `${extName}.revealSymbolicLinkRealFolder`,
        (uri) => {
            import('./features/revealSymbolicLinkRealFolder').then((mod) =>
                mod.revealSymbolicLinkRealFolder(uri),
            );
        },
        subscriptions,
    );

    vscode.commands.registerTextEditorCommand(`${extName}.detectTextFileEncoding`, (editor) => {
        import('./features/detectTextFileEncoding').then((mod) =>
            mod.detectTextFileEncoding(editor),
        );
    });

    vscode.commands.registerCommand(`${extName}.logFileInfo`, () => {
        import('./features/fileInfo/logFileInfo').then((mod) => mod.logFileInfo());
    });

    fileSizeStatusBar(context);
    lineCountStatusBar(context);
}

export function deactivate() {
    logger.dispose();
}
