import * as vscode from 'vscode';
import type { OutputChannel } from 'vscode';

let outputChannel: OutputChannel | undefined;
export const logger = {
    log(message: string, active: boolean): void {
        if (outputChannel === undefined) {
            outputChannel = vscode.window.createOutputChannel('Neo File Utils', 'log');
        }
        outputChannel.append(`${message}\n`);
        if (active) {
            outputChannel.show();
        }
    },
    dispose(): void {
        outputChannel?.dispose();
    },
};
