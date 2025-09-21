import vscode from 'vscode';

export type IDEKind = 'vscode' | 'cursor' | 'windsurf' | 'trae' | 'unknown';

export function getCurrentIDE(): IDEKind {
    const appName = vscode.env.appName.toLowerCase();

    if (appName.includes('windsurf')) {
        return 'windsurf';
    }

    if (appName.includes('cursor')) {
        return 'cursor';
    }

    if (appName.includes('trae')) {
        return 'trae';
    }

    if (appName.includes('visual studio code')) {
        return 'vscode';
    }

    return 'unknown';
}
