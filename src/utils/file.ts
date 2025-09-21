import fs from 'node:fs/promises';
import path from 'node:path';
import { constants as FS_CONSTANTS } from 'fs';

import { execaCommand } from 'execa';
import getFolderSize from 'get-folder-size';
import vscode, { Uri } from 'vscode';

import { allExtensionsFolder } from '../constants';

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
export async function getDirectorySize(directory: string): Promise<number> {
    return new Promise((resolve) => {
        // Limit waiting time to avoid blocking the progress UI on very large folders.
        const timeout = setTimeout(() => {
            resolve(0); // Fall back to zero when timing out so other entries can continue.
        }, 5000);

        const compute = getFolderSize.loose
            ? async (dir: string) => Number(await getFolderSize.loose!(dir))
            : async (dir: string) => {
                  const result = await getFolderSize(dir);
                  return Number(result.size);
              };

        compute(directory)
            .then((size) => {
                clearTimeout(timeout);
                resolve(Number.isFinite(size) ? size : 0);
            })
            .catch(() => {
                clearTimeout(timeout);
                resolve(0);
            });
    });
}

// File size formatting constants and functions
const DECIMAL_BASE = 1000;
const IEC_BASE = 1024;
const IEC_SUFFIXES = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
const DECIMAL_SUFFIXES = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

/**
 * Format file size with specified base and suffixes
 */
export function formatFileSize(size: number, base: number, suffixes: string[]) {
    if (size === 0) return '0 bytes';
    if (size === 1) return '1 byte';

    const scale = Math.floor(Math.log(size) / Math.log(base));
    const activeSuffix = suffixes[scale];
    const scaledSize = size / base ** scale;
    // Round size with a decimal precision of 2
    const fixedScale = Math.round(Number(`${scaledSize}e+2`));
    const roundedSize = Number(`${fixedScale}e-2`);
    return `${roundedSize} ${activeSuffix}`;
}

/**
 * Format file size using decimal base (1000) and standard units
 */
export function formatFileSizeDecimal(size: number) {
    return formatFileSize(size, DECIMAL_BASE, DECIMAL_SUFFIXES);
}

/**
 * Format file size using IEC base (1024) and binary units
 */
export function formatFileSizeIEC(size: number) {
    return formatFileSize(size, IEC_BASE, IEC_SUFFIXES);
}

/**
 * Get formatted file size for a specific file
 */
export async function getFilePrettySize(filePath: string) {
    const stats = await fs.stat(filePath);
    return formatFileSizeDecimal(stats.size);
}
