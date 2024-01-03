import path from 'node:path';

import vscode from 'vscode';

import { getRepositoryInfo, getWorkspaceRootPath } from '../utils';

export async function copyJsDeliverLink(filePath: string) {
    const info = await getRepositoryInfo();
    if (!info) return;

    const { userName, repositoryName } = info;
    const workspaceRootPath = getWorkspaceRootPath()!;
    const relativePath = path.relative(workspaceRootPath, filePath);
    const link = `https://cdn.jsdelivr.net/gh/${userName}/${repositoryName}@main/${relativePath}`;
    return vscode.env.clipboard.writeText(link);
}
