import path from 'node:path';

import vscode from 'vscode';

import { allExtensionsFolder } from '../constants';
import { getExtensionFolders, openFolderInFileExplorer } from '../utils';

/**
 * @param extId Like YuTengjing.better-colorizer, but extension folder name is lowercase
 */
export async function openExtensionFolder(extId: string) {
    let extensionPath = vscode.extensions.getExtension(extId)?.extensionPath;

    if (!extensionPath) {
        const extensionFolders = await getExtensionFolders();
        // get latest version
        const lowerCaseExtensionId = extId.toLowerCase();
        const extensionFolderName = extensionFolders.find((folderName) =>
            folderName.startsWith(lowerCaseExtensionId),
        );
        if (extensionFolderName) {
            extensionPath = path.resolve(allExtensionsFolder, extensionFolderName);
        }
    }

    if (extensionPath) {
        await openFolderInFileExplorer(extensionPath);
    }
}
