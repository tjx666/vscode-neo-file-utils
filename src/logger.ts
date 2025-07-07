import type { OutputChannel } from 'vscode';
import * as vscode from 'vscode';

let outputChannel: OutputChannel | undefined;
export const logger = {
    log(message: string, active = false): void {
        if (outputChannel === undefined) {
            outputChannel = vscode.window.createOutputChannel('Neo File Utils', 'log');
        }
        outputChannel.append(`${message}\n`);
        if (active) {
            outputChannel.show();
        }
    },
    info(message: string, ...args: any[]): void {
        const formattedMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
        this.log(`[INFO] ${formattedMessage}`);
    },
    warn(message: string, ...args: any[]): void {
        const formattedMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
        this.log(`[WARN] ${formattedMessage}`);
    },
    error(message: string, ...args: any[]): void {
        const formattedMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
        this.log(`[ERROR] ${formattedMessage}`, true); // Show output for errors
    },
    dispose(): void {
        outputChannel?.dispose();
    },
};
