import vscode from 'vscode';

import { logger } from '../logger';
import type { ExtensionInfo } from './installExtensionFromRemoteVsix';
import {
    cleanupTempFile,
    downloadVsixFile,
    getExtensionVersions,
    installExtensionFromVsix,
} from './installExtensionFromRemoteVsix';
import { compareVersions } from './removeOldVersionsOfExtensions';

/**
 * Check if a version object from marketplace API is marked as prerelease
 */
function isMarketplacePreRelease(versionObj: {
    version: string;
    lastUpdated: string;
    properties?: Array<{ key: string; value: string }>;
}): boolean {
    return (
        versionObj.properties?.some(
            (prop) => prop.key === 'Microsoft.VisualStudio.Code.PreRelease',
        ) ?? false
    );
}

/**
 * Get engine requirement from version properties
 */
function getEngineRequirement(versionObj: {
    version: string;
    lastUpdated: string;
    properties?: Array<{ key: string; value: string }>;
}): string | undefined {
    return versionObj.properties?.find(
        (prop) => prop.key === 'Microsoft.VisualStudio.Code.Engine',
    )?.value;
}

/**
 * Check if current VSCode version satisfies the engine requirement
 * @param requirement Engine requirement like "^1.80.0" or ">=1.75.0"
 * @param currentVersion Current VSCode version like "1.85.0"
 */
function satisfiesEngineRequirement(requirement: string | undefined, currentVersion: string): boolean {
    if (!requirement) {
        return true; // No requirement means compatible
    }

    // Parse current version (remove any pre-release identifiers)
    const currentVersionParts = currentVersion.split('-')[0].split('.').map(Number);
    const [currentMajor, currentMinor, currentPatch] = currentVersionParts;

    // Handle common requirement patterns
    // ^1.80.0 means >=1.80.0 <2.0.0
    // >=1.75.0 means greater than or equal to 1.75.0
    // 1.80.0 means exactly 1.80.0

    let match = requirement.match(/\^(\d+)\.(\d+)\.(\d+)/);
    if (match) {
        const [, reqMajor, reqMinor, reqPatch] = match.map(Number);
        // Caret allows changes that do not modify the left-most non-zero digit
        if (currentMajor !== reqMajor) {
            return currentMajor > reqMajor;
        }
        if (currentMinor < reqMinor) {
            return false;
        }
        if (currentMinor === reqMinor && currentPatch < reqPatch) {
            return false;
        }
        return true;
    }

    match = requirement.match(/>=(\d+)\.(\d+)\.(\d+)/);
    if (match) {
        const [, reqMajor, reqMinor, reqPatch] = match.map(Number);
        if (currentMajor > reqMajor) return true;
        if (currentMajor < reqMajor) return false;
        if (currentMinor > reqMinor) return true;
        if (currentMinor < reqMinor) return false;
        return currentPatch >= reqPatch;
    }

    match = requirement.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
        const [, reqMajor, reqMinor, reqPatch] = match.map(Number);
        return (
            currentMajor === reqMajor && currentMinor === reqMinor && currentPatch === reqPatch
        );
    }

    // If we can't parse the requirement, assume compatible to be safe
    logger.warn(`Unable to parse engine requirement: ${requirement}`);
    return true;
}

interface ExtensionUpdateInfo {
    /** Extension unique identifier (publisher.name) */
    id: string;
    /** Display name of the extension */
    displayName: string;
    /** Publisher name */
    publisher: string;
    /** Extension name */
    name: string;
    /** Current installed version */
    currentVersion: string;
    /** Latest version available on marketplace */
    latestVersion: string;
    /** Release date of latest version */
    releaseDate: string;
}

interface IncompatibleUpdateInfo {
    /** Extension unique identifier (publisher.name) */
    id: string;
    /** Display name of the extension */
    displayName: string;
    /** Current installed version */
    currentVersion: string;
    /** Latest incompatible version */
    latestVersion: string;
    /** Required VSCode engine version */
    requiredEngine: string;
}

interface QuickPickExtensionItem extends vscode.QuickPickItem {
    updateInfo: ExtensionUpdateInfo;
}

/**
 * Check for extension updates and allow user to select which ones to update
 *
 * Workflow:
 *
 * 1. Get all installed non-builtin extensions
 * 2. Query marketplace for latest version of each extension
 * 3. Compare versions and filter extensions with updates available
 * 4. Show multi-select QuickPick for user to choose which extensions to update
 * 5. Download and install selected extensions
 */
export async function checkExtensionUpdates(): Promise<void> {
    try {
        // Step 1: Get installed extensions
        const installedExtensions = vscode.extensions.all.filter(
            (ext) => !ext.packageJSON.isBuiltin,
        );

        if (installedExtensions.length === 0) {
            vscode.window.showInformationMessage('No installed extensions found.');
            return;
        }

        logger.info(`Found ${installedExtensions.length} installed non-builtin extensions`);

        // Get current VSCode version for compatibility checking
        const currentVSCodeVersion = vscode.version;
        logger.info(`Current VSCode version: ${currentVSCodeVersion}`);

        // Step 2: Check for updates (parallel)
        const checkResult = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Checking for extension updates',
                cancellable: true,
            },
            async (progress, token) => {
                if (token.isCancellationRequested) {
                    return null;
                }

                const total = installedExtensions.length;
                let completed = 0;

                // Check all extensions in parallel
                const checkPromises = installedExtensions.map(async (ext) => {
                    const { id, packageJSON } = ext;
                    const currentVersion = packageJSON.version as string;
                    const [publisher, name] = id.split('.');

                    if (!publisher || !name) {
                        logger.warn(`Invalid extension id: ${id}`);
                        completed++;
                        progress.report({
                            increment: (1 / total) * 100,
                            message: `${completed}/${total} - ${id}`,
                        });
                        return null;
                    }

                    try {
                        // Query marketplace for latest version
                        const allVersions = await getExtensionVersions(publisher, name);

                        if (allVersions.length === 0) {
                            logger.debug(`No versions found for ${id}`);
                            completed++;
                            progress.report({
                                increment: (1 / total) * 100,
                                message: `${completed}/${total} - ${id}`,
                            });
                            return null;
                        }

                        // Only consider stable versions (filter out prerelease)
                        const stableVersions = allVersions.filter((v) => !isMarketplacePreRelease(v));

                        if (stableVersions.length === 0) {
                            logger.debug(`No stable versions found for ${id}`);
                            completed++;
                            progress.report({
                                increment: (1 / total) * 100,
                                message: `${completed}/${total} - ${id}`,
                            });
                            return null;
                        }

                        // Check if there's a newer version at all
                        const absoluteLatestVersion = stableVersions[0];
                        const hasNewerVersion = compareVersions(absoluteLatestVersion.version, currentVersion) > 0;

                        if (!hasNewerVersion) {
                            // No update available
                            completed++;
                            progress.report({
                                increment: (1 / total) * 100,
                                message: `${completed}/${total} - ${id}`,
                            });
                            return null;
                        }

                        // Filter versions compatible with current VSCode
                        const compatibleVersions = stableVersions.filter((v) => {
                            const engineRequirement = getEngineRequirement(v);
                            return satisfiesEngineRequirement(engineRequirement, currentVSCodeVersion);
                        });

                        // Update progress
                        completed++;
                        progress.report({
                            increment: (1 / total) * 100,
                            message: `${completed}/${total} - ${id}`,
                        });

                        // Check if latest compatible version is newer than current
                        if (compatibleVersions.length > 0) {
                            const latestCompatibleVersion = compatibleVersions[0];
                            if (compareVersions(latestCompatibleVersion.version, currentVersion) > 0) {
                                logger.info(
                                    `Update available for ${id}: ${currentVersion} → ${latestCompatibleVersion.version}`,
                                );
                                return {
                                    compatible: {
                                        id,
                                        displayName: packageJSON.displayName || id,
                                        publisher,
                                        name,
                                        currentVersion,
                                        latestVersion: latestCompatibleVersion.version,
                                        releaseDate: latestCompatibleVersion.lastUpdated,
                                    },
                                    incompatible: null,
                                };
                            }
                        }

                        // Check if there's an incompatible newer version
                        if (compareVersions(absoluteLatestVersion.version, currentVersion) > 0) {
                            const latestEngine = getEngineRequirement(absoluteLatestVersion);
                            logger.info(
                                `Incompatible update for ${id}: ${currentVersion} → ${absoluteLatestVersion.version} (requires VSCode ${latestEngine})`,
                            );
                            return {
                                compatible: null,
                                incompatible: {
                                    id,
                                    displayName: packageJSON.displayName || id,
                                    currentVersion,
                                    latestVersion: absoluteLatestVersion.version,
                                    requiredEngine: latestEngine || 'unknown',
                                },
                            };
                        }

                        return null;
                    } catch (error) {
                        // Extension might not be on marketplace (private/local extensions)
                        logger.debug(`Failed to check updates for ${id}:`, error);
                        completed++;
                        progress.report({
                            increment: (1 / total) * 100,
                            message: `${completed}/${total} - ${id}`,
                        });
                        return null;
                    }
                });

                const results = await Promise.all(checkPromises);

                if (token.isCancellationRequested) {
                    return null;
                }

                // Separate compatible and incompatible updates
                const compatibleUpdates: ExtensionUpdateInfo[] = [];
                const incompatibleUpdates: IncompatibleUpdateInfo[] = [];

                for (const result of results) {
                    if (!result) continue;
                    if (result.compatible) {
                        compatibleUpdates.push(result.compatible);
                    }
                    if (result.incompatible) {
                        incompatibleUpdates.push(result.incompatible);
                    }
                }

                return { compatibleUpdates, incompatibleUpdates };
            },
        );

        if (checkResult === null) {
            // User cancelled
            return;
        }

        const { compatibleUpdates, incompatibleUpdates } = checkResult;

        // Show info about incompatible updates first
        if (incompatibleUpdates.length > 0) {
            logger.info(`Found ${incompatibleUpdates.length} extensions with incompatible updates`);
            const incompatibleList = incompatibleUpdates
                .slice(0, 5)
                .map(
                    (u, index) =>
                        `${index + 1}. ${u.displayName}\n   v${u.currentVersion} → v${u.latestVersion}\n   Requires: VSCode ${u.requiredEngine}`,
                )
                .join('\n\n');
            const moreText = incompatibleUpdates.length > 5 ? `\n\n...and ${incompatibleUpdates.length - 5} more` : '';

            await vscode.window.showWarningMessage(
                `${incompatibleUpdates.length} extension update(s) require a newer VSCode version`,
                {
                    modal: true,
                    detail: incompatibleList + moreText,
                },
                'OK',
            );
        }

        if (compatibleUpdates.length === 0) {
            if (incompatibleUpdates.length > 0) {
                vscode.window.showInformationMessage('No compatible extension updates available.');
            } else {
                vscode.window.showInformationMessage('All extensions are up to date! ✓');
            }
            return;
        }

        logger.info(`Found ${compatibleUpdates.length} extensions with compatible updates available`);

        // Step 3: Show multi-select QuickPick
        const items: QuickPickExtensionItem[] = compatibleUpdates.map((update) => ({
            label: update.displayName,
            description: `v${update.currentVersion} → v${update.latestVersion}`,
            detail: `Released: ${new Date(update.releaseDate).toLocaleDateString()}`,
            picked: true, // Default select all updates
            updateInfo: update,
        }));

        const selectedItems = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: `Select extensions to update (${compatibleUpdates.length} updates available)`,
            title: 'Extension Updates Available',
        });

        if (!selectedItems || selectedItems.length === 0) {
            return; // User cancelled or selected nothing
        }

        logger.info(`User selected ${selectedItems.length} extensions to update`);

        // Step 4: Install selected updates
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Updating extensions',
                cancellable: true,
            },
            async (progress, token) => {
                const total = selectedItems.length;
                let succeeded = 0;
                let failed = 0;
                const failures: Array<{ id: string; error: string }> = [];

                for (const [i, { updateInfo }] of selectedItems.entries()) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    const extensionInfo: ExtensionInfo = {
                        publisher: updateInfo.publisher,
                        name: updateInfo.name,
                        version: updateInfo.latestVersion,
                        displayName: updateInfo.displayName,
                        description: '',
                    };

                    progress.report({
                        increment: (1 / total) * 100,
                        message: `${i + 1}/${total} - ${updateInfo.id}`,
                    });

                    logger.info(
                        `Updating ${updateInfo.id} from v${updateInfo.currentVersion} to v${updateInfo.latestVersion}`,
                    );

                    let vsixPath: string | null = null;

                    try {
                        // Download VSIX
                        // eslint-disable-next-line no-await-in-loop -- Extensions must be installed sequentially to avoid conflicts
                        vsixPath = await downloadVsixFile(extensionInfo, token);

                        if (token.isCancellationRequested) {
                            // eslint-disable-next-line no-await-in-loop -- Cleanup before cancellation
                            await cleanupTempFile(vsixPath);
                            break;
                        }

                        // Install extension
                        // eslint-disable-next-line no-await-in-loop -- Extensions must be installed sequentially to avoid conflicts
                        await installExtensionFromVsix(vsixPath);

                        // Clean up
                        // eslint-disable-next-line no-await-in-loop -- Cleanup after installation
                        await cleanupTempFile(vsixPath);

                        succeeded++;
                        logger.info(`Successfully updated ${updateInfo.id}`);
                    } catch (error) {
                        failed++;
                        const errorMessage =
                            error instanceof Error ? error.message : 'Unknown error';
                        logger.error(`Failed to update ${updateInfo.id}:`, error);
                        failures.push({ id: updateInfo.id, error: errorMessage });

                        // Clean up on error
                        if (vsixPath) {
                            // eslint-disable-next-line no-await-in-loop -- Cleanup on error
                            await cleanupTempFile(vsixPath).catch(() => {});
                        }
                    }
                }

                // Show results
                if (failed === 0) {
                    vscode.window.showInformationMessage(
                        `Successfully updated ${succeeded} extension${succeeded > 1 ? 's' : ''}!`,
                    );
                } else if (succeeded === 0) {
                    vscode.window.showErrorMessage(
                        `Failed to update all ${failed} extension${failed > 1 ? 's' : ''}.`,
                    );
                } else {
                    const failureList = failures.map((f) => `- ${f.id}: ${f.error}`).join('\n');
                    vscode.window.showWarningMessage(
                        `Updated ${succeeded} extension${succeeded > 1 ? 's' : ''}, but ${failed} failed.`,
                        {
                            detail: failureList,
                            modal: true,
                        },
                    );
                }
            },
        );
    } catch (error) {
        logger.error('Failed to check extension updates', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to check extension updates: ${errorMessage}`);
    }
}
