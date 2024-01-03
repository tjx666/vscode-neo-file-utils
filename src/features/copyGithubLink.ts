import path from 'node:path';

import { isBinaryFile } from 'isbinaryfile';
import vscode from 'vscode';

import { getRepositoryInfo, getWorkspaceRootPath } from '../utils';

export async function copyGithubLink(filePath: string) {
    const info = await getRepositoryInfo();
    if (!info) return;

    const { userName, repositoryName } = info;

    const workspaceRootPath = getWorkspaceRootPath()!;
    const relativePath = path.relative(workspaceRootPath, filePath);
    let githubLink = `https://github.com/${userName}/${repositoryName}/blob/main/${relativePath}`;
    if (await isBinaryFile(filePath)) {
        githubLink += '?raw=true';
    }

    return vscode.env.clipboard.writeText(githubLink);
}
