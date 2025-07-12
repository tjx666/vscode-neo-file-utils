import * as path from 'path';

import { execa } from 'execa';
import type { SourceControlResourceState } from 'vscode';
import vscode from 'vscode';

import { logger } from '../logger';

/**
 * Get workspace root directory
 */
function getWorkspaceRoot(): string {
    logger.info('Getting workspace root directory');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        logger.error('No workspace folder found');
        throw new Error('No workspace folder found');
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;
    logger.info(`Workspace root found: ${workspaceRoot}`);
    return workspaceRoot;
}

/**
 * Find the deepest common base directory for a list of file paths
 */
export function findCommonBaseDirectory(filePaths: string[]): string {
    if (filePaths.length === 0) {
        return '';
    }

    if (filePaths.length === 1) {
        return path.dirname(filePaths[0]);
    }

    // Start with the directory of the first file as the baseline
    let baseDir = path.dirname(filePaths[0]);

    // Check each remaining file path
    for (let i = 1; i < filePaths.length; i++) {
        const currentFileDir = path.dirname(filePaths[i]);

        // Keep moving baseDir up until it contains the current file's directory
        while (!currentFileDir.startsWith(baseDir + path.sep) && currentFileDir !== baseDir) {
            const parentDir = path.dirname(baseDir);

            // Safety check to avoid infinite loop (reached root)
            if (parentDir === baseDir) {
                break;
            }

            baseDir = parentDir;
        }
    }

    return baseDir;
}

interface ResolveConflictFilesOptions {
    conflictFiles: string[];
    useOurs: boolean;
    shouldStage?: boolean;
}

/**
 * Resolve conflict files using specified strategy with a single git command on directory
 */
async function resolveConflictFilesWithStrategy(
    options: ResolveConflictFilesOptions,
): Promise<void> {
    const { conflictFiles, useOurs, shouldStage = false } = options;
    const strategy = useOurs ? 'Accept All Current' : 'Accept All Incoming';
    const stageText = shouldStage ? ' and Stage' : '';

    logger.info(`Starting batch ${strategy}${stageText} for ${conflictFiles.length} files`);

    const workspaceRoot = getWorkspaceRoot();

    // Convert absolute paths to relative paths (relative to workspace root)
    const relativeFilePaths = conflictFiles.map((filePath) => {
        const relativePath = path.relative(workspaceRoot, filePath);

        // Security check: ensure all files are within the workspace
        if (relativePath.startsWith('..')) {
            throw new Error(`File ${filePath} is outside workspace: ${relativePath}`);
        }
        return relativePath;
    });

    // Find the common base directory
    const baseDirectory = findCommonBaseDirectory(relativeFilePaths);

    const gitStrategy = useOurs ? '--ours' : '--theirs';

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `${strategy}${stageText}`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({
                message: `Processing directory: ${baseDirectory || 'workspace root'}`,
                increment: 30,
            });

            try {
                // Use directory path for git checkout command
                const targetPath = baseDirectory ? `${baseDirectory}/` : '.';
                const checkoutArgs = ['checkout', gitStrategy, '--', targetPath];

                logger.info(`Executing: git ${checkoutArgs.join(' ')} (cwd: ${workspaceRoot})`);

                await execa('git', checkoutArgs, { cwd: workspaceRoot });

                progress.report({
                    message: 'Conflicts resolved',
                    increment: 40,
                });

                if (shouldStage) {
                    progress.report({
                        message: 'Staging changes...',
                        increment: 20,
                    });

                    const addArgs = ['add', '--', targetPath];

                    logger.info(`Executing: git ${addArgs.join(' ')} (cwd: ${workspaceRoot})`);

                    await execa('git', addArgs, { cwd: workspaceRoot });
                }

                progress.report({
                    message: 'Completed successfully',
                    increment: 10,
                });

                const message = shouldStage
                    ? `${strategy} and staged ${conflictFiles.length} files in ${baseDirectory || 'workspace root'}`
                    : `${strategy} resolved ${conflictFiles.length} files in ${baseDirectory || 'workspace root'}`;

                vscode.window.showInformationMessage(message);
                logger.info(`Successfully completed: ${message}`);
            } catch (error) {
                const errorMessage = `Failed to ${strategy.toLowerCase()}: ${error instanceof Error ? error.message : String(error)}`;
                logger.error(errorMessage);
                vscode.window.showErrorMessage(errorMessage);
                throw error;
            }
        },
    );
}

/**
 * Extract conflict file paths from SCM resource states
 */
function extractConflictFiles(resourceStates: SourceControlResourceState[]): string[] {
    return resourceStates
        .filter((state) => state.resourceUri)
        .map((state) => state.resourceUri.fsPath);
}

/**
 * Accept all current version (ours) conflicts in folder without staging
 */
export async function acceptAllCurrentInFolder(
    ...resourceStates: SourceControlResourceState[]
): Promise<void> {
    const conflictFiles = extractConflictFiles(resourceStates);

    if (conflictFiles.length === 0) {
        vscode.window.showWarningMessage('No conflict files found to process');
        return;
    }

    await resolveConflictFilesWithStrategy({
        conflictFiles,
        useOurs: true,
        shouldStage: false,
    });
}

/**
 * Accept all incoming version (theirs) conflicts in folder without staging
 */
export async function acceptAllIncomingInFolder(
    ...resourceStates: SourceControlResourceState[]
): Promise<void> {
    const conflictFiles = extractConflictFiles(resourceStates);

    if (conflictFiles.length === 0) {
        vscode.window.showWarningMessage('No conflict files found to process');
        return;
    }

    await resolveConflictFilesWithStrategy({
        conflictFiles,
        useOurs: false,
        shouldStage: false,
    });
}

/**
 * Accept all current version (ours) conflicts in folder and stage them
 */
export async function acceptAllCurrentAndStageInFolder(
    ...resourceStates: SourceControlResourceState[]
): Promise<void> {
    const conflictFiles = extractConflictFiles(resourceStates);

    if (conflictFiles.length === 0) {
        vscode.window.showWarningMessage('No conflict files found to process');
        return;
    }

    await resolveConflictFilesWithStrategy({
        conflictFiles,
        useOurs: true,
        shouldStage: true,
    });
}

/**
 * Accept all incoming version (theirs) conflicts in folder and stage them
 */
export async function acceptAllIncomingAndStageInFolder(
    ...resourceStates: SourceControlResourceState[]
): Promise<void> {
    const conflictFiles = extractConflictFiles(resourceStates);

    if (conflictFiles.length === 0) {
        vscode.window.showWarningMessage('No conflict files found to process');
        return;
    }

    await resolveConflictFilesWithStrategy({
        conflictFiles,
        useOurs: false,
        shouldStage: true,
    });
}
