import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import vscode from 'vscode';

import { openFolderInFileExplorer } from '../utils';

/**
 * @param extId Like YuTengjing.better-colorizer, but extension folder name is lowercase
 */
export async function openExtensionFolder(extId: string) {
    let extensionPath = vscode.extensions.getExtension(extId)?.extensionPath;

    if (!extensionPath) {
        const isInsidersVersion = vscode.version.toLowerCase().includes('insider');
        const home = os.homedir();
        const allExtensionsFolder = isInsidersVersion
            ? `${home}/.vscode-insiders/extensions`
            : `${home}/.vscode/extensions`;
        const extensionFolders = await fs.readdir(allExtensionsFolder);
        // get latest version
        const lowerCaseExtensionId = extId.toLowerCase();
        const extensionFolderName = extensionFolders
            .sort((a, b) => b.localeCompare(a))
            .find((folderName) => folderName.startsWith(lowerCaseExtensionId));
        if (extensionFolderName) {
            extensionPath = path.resolve(allExtensionsFolder, extensionFolderName);
        }
    }

    if (extensionPath) {
        await openFolderInFileExplorer(extensionPath);
    }
}
