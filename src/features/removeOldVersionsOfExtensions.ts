import fs from 'node:fs/promises';
import path from 'node:path';

import vscode from 'vscode';

import { allExtensionsFolder } from '../constants';
import { logger } from '../logger';
import { formatFileSizeIEC, getDirectorySize } from '../utils/file';
import type { IDEKind } from '../utils/ide';
import { getCurrentIDE } from '../utils/ide';

interface ExtensionFolderInfo {
    extensionId: string;
    version: string;
    folderName: string;
    absolutePath: string;
    size?: number;
}

interface DeletionPlan {
    targets: ExtensionFolderInfo[];
    totalBytes: number;
    extensionCount: number;
    preview: string[];
}

async function parseExtensionFolder(
    folderName: string,
    rootPath: string,
): Promise<ExtensionFolderInfo | undefined> {
    const absolutePath = path.join(rootPath, folderName);
    const packageJsonPath = path.join(absolutePath, 'package.json');

    try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);

        // 验证必要字段
        if (!packageJson.name || !packageJson.version) {
            return undefined;
        }

        const result = {
            extensionId: packageJson.name,
            version: packageJson.version,
            folderName,
            absolutePath,
        };
        logger.debug(`Parsed extension folder: ${folderName} -> ${packageJson.name}@${packageJson.version}`);
        return result;
    } catch (error) {
        // package.json 不存在或无法读取，说明不是有效的扩展文件夹
        logger.debug(`Failed to parse extension folder: ${folderName}`, error);
        return undefined;
    }
}

function compareVersions(a: string, b: string) {
    const [coreA, ...preA] = a.split('-');
    const [coreB, ...preB] = b.split('-');
    const partsA = coreA.split('.').map((part) => Number.parseInt(part, 10));
    const partsB = coreB.split('.').map((part) => Number.parseInt(part, 10));
    const length = Math.max(partsA.length, partsB.length);

    for (let index = 0; index < length; index += 1) {
        const valueA = Number.isNaN(partsA[index]) ? 0 : partsA[index];
        const valueB = Number.isNaN(partsB[index]) ? 0 : partsB[index];
        if (valueA > valueB) return 1;
        if (valueA < valueB) return -1;
    }

    const hasPreA = preA.length > 0;
    const hasPreB = preB.length > 0;

    if (hasPreA && !hasPreB) return -1;
    if (!hasPreA && hasPreB) return 1;
    if (hasPreA && hasPreB) {
        const preReleaseA = preA.join('-');
        const preReleaseB = preB.join('-');
        if (preReleaseA > preReleaseB) return 1;
        if (preReleaseA < preReleaseB) return -1;
    }

    return 0;
}

async function prepareDeletionPlan(rootPath: string): Promise<DeletionPlan> {
    logger.info(`Starting extension cleanup scan in: ${rootPath}`);
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const totalDirectories = entries.filter((entry) => entry.isDirectory()).length;
    logger.info(`Found ${totalDirectories} directories to scan`);

    const grouped = new Map<string, ExtensionFolderInfo[]>();

    // 并行解析所有扩展文件夹
    const parsePromises = entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => parseExtensionFolder(entry.name, rootPath));

    const extensionInfos = await Promise.all(parsePromises);

    const validExtensions = extensionInfos.filter(Boolean);
    const invalidDirectories = totalDirectories - validExtensions.length;
    logger.info(`Successfully parsed ${validExtensions.length} extensions, skipped ${invalidDirectories} invalid directories`);

    for (const info of extensionInfos) {
        if (!info) continue;
        const group = grouped.get(info.extensionId);
        if (group) {
            group.push(info);
        } else {
            grouped.set(info.extensionId, [info]);
        }
    }

    const targets: ExtensionFolderInfo[] = [];

    for (const [extensionId, versions] of grouped) {
        if (versions.length <= 1) continue;
        versions.sort((a, b) => compareVersions(b.version, a.version));
        const [latest, ...outdated] = versions;
        logger.debug(`Extension ${extensionId}: keeping ${latest.version}, removing ${outdated.length} old versions: ${outdated.map(v => v.version).join(', ')}`);
        targets.push(...outdated);
    }

    logger.info(`Found ${targets.length} outdated extension versions to remove`);

    if (targets.length === 0) {
        return {
            targets: [],
            totalBytes: 0,
            extensionCount: grouped.size,
            preview: [],
        };
    }

    // 并行计算目录大小，但限制并发数以避免系统负载过高
    const batchSize = 5; // 最多同时计算 5 个目录
    const sizes: number[] = [];
    logger.debug(`Calculating directory sizes for ${targets.length} targets in batches of ${batchSize}`);

    for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(targets.length / batchSize)}`);
        // eslint-disable-next-line no-await-in-loop -- 批量处理以控制并发数
        const batchSizes = await Promise.all(
            batch.map(async (target) => {
                const size = await getDirectorySize(target.absolutePath).catch((error) => {
                    logger.warn(`Failed to calculate size for ${target.folderName}:`, error);
                    return 0;
                });
                target.size = size;
                return size;
            }),
        );
        sizes.push(...batchSizes);
    }

    const totalBytes = sizes.reduce((total, current) => total + current, 0);
    logger.info(`Total size to be freed: ${formatFileSizeIEC(totalBytes)}`);

    const preview = targets.slice(0, 10).map((target) => {
        const size = target.size ?? 0;
        const hasSize = size > 0;
        const sizeLabel = hasSize ? ` (${formatFileSizeIEC(size)})` : '';
        return `${target.extensionId} @ ${target.version}${sizeLabel}`;
    });

    return {
        targets,
        totalBytes,
        extensionCount: grouped.size,
        preview,
    };
}


function buildPreviewDetail(plan: DeletionPlan, rootPath: string, ide: IDEKind) {
    const header = [
        `Host: ${ide}`,
        `Extensions root: ${rootPath}`,
        `Folders to remove: ${plan.targets.length}`,
    ];
    if (plan.totalBytes > 0) {
        header.push(`Estimated free space: ${formatFileSizeIEC(plan.totalBytes)}`);
    }

    const lines = [...header];
    if (plan.preview.length > 0) {
        lines.push('', ...plan.preview);
        if (plan.targets.length > plan.preview.length) {
            lines.push('...');
        }
    }

    return lines.join('\n');
}

export async function removeOldVersionsOfExtensions(_context: vscode.ExtensionContext) {
    const extensionsRoot = allExtensionsFolder;
    const ide = getCurrentIDE();
    logger.info(`Starting removeOldVersionsOfExtensions for ${ide} in ${extensionsRoot}`);

    const plan = await prepareDeletionPlan(extensionsRoot);
    if (plan.targets.length === 0) {
        logger.info('No outdated extension caches found');
        await vscode.window.showInformationMessage('No outdated extension caches found.');
        return;
    }

    logger.info(`Cleanup plan ready: ${plan.targets.length} targets, ${formatFileSizeIEC(plan.totalBytes)} to be freed`);

    const selection = await vscode.window.showInformationMessage(
        'Outdated extension caches detected. Continue cleanup?',
        {
            modal: true,
            detail: buildPreviewDetail(plan, extensionsRoot, ide),
        },
        'Clean up now',
        'Cancel',
    );

    if (selection !== 'Clean up now') {
        logger.info('User cancelled cleanup operation');
        return;
    }

    logger.info('Starting deletion process');
    const failures: Array<{ target: ExtensionFolderInfo; error: unknown }> = [];

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Neo File Utils: Remove Old Versions of Extensions',
        },
        async (progress) => {
            const total = plan.targets.length;
            let deletedCount = 0;
            for (const target of plan.targets) {
                // Delete sequentially to avoid spikes caused by removing many directories at once.
                progress.report({ message: target.folderName, increment: (1 / total) * 100 });
                logger.debug(`Deleting: ${target.folderName} (${target.extensionId}@${target.version})`);
                try {
                    // eslint-disable-next-line no-await-in-loop -- Deletion runs serially to avoid exhausting file handles.
                    await fs.rm(target.absolutePath, { recursive: true, force: true });
                    deletedCount++;
                    logger.debug(`Successfully deleted: ${target.folderName}`);
                } catch (error) {
                    logger.error(`Failed to delete ${target.folderName}:`, error);
                    failures.push({ target, error });
                }
            }
            logger.info(`Deletion process completed: ${deletedCount}/${total} successful`);
        },
    );

    if (failures.length === 0) {
        logger.info(`Cleanup completed successfully: removed ${plan.targets.length} directories, reclaimed ${formatFileSizeIEC(plan.totalBytes)}`);
        await vscode.window.showInformationMessage(
            `Removed ${plan.targets.length}  outdated directories, reclaimed about  ${formatFileSizeIEC(plan.totalBytes)}。`,
        );
        return;
    }

    const failedTargets = failures.map(({ target }) => target.folderName);
    logger.warn(`Cleanup completed with errors: ${plan.targets.length - failures.length} successful, ${failures.length} failed`, {
        failedTargets,
        errors: failures.map(({ target, error }) => ({ target: target.folderName, error }))
    });

    const failedLines = failures.slice(0, 5).map(({ target }) => target.folderName);
    await vscode.window.showWarningMessage(
        `Successfully cleaned ${plan.targets.length - failures.length}  directories, ${failures.length}  directories failed to delete.`,
        {
            detail: `${failedLines.join('\n')}${failures.length > failedLines.length ? '\n...' : ''}`,
            modal: true,
        },
    );
}

export { compareVersions, prepareDeletionPlan };
