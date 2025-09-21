import vscode, { Uri } from 'vscode';

export async function openFolderInFileExplorer(folderPath: string) {
    return vscode.env.openExternal(Uri.file(folderPath));
}
