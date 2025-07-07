import { Buffer } from 'buffer';
import fs, { promises as fsPromises } from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';

import vscode from 'vscode';

import { logger } from '../logger';

interface ExtensionInfo {
    publisher: string;
    name: string;
    version: string;
    displayName: string;
    description: string;
}

interface MarketplaceResponse {
    results: Array<{
        extensions: Array<{
            publisher: { publisherName: string };
            extensionName: string;
            displayName: string;
            shortDescription: string;
            versions: Array<{
                version: string;
                lastUpdated: string;
            }>;
        }>;
    }>;
}

/**
 * Install an extension from remote VSIX
 *
 * Workflow:
 *
 * 1. Get user input (extension identifier, URL, or identifier@version)
 * 2. Parse input and extract publisher/extension name and optional version
 * 3. If no version specified, query available versions and let user choose
 * 4. Download VSIX file to temporary directory
 * 5. Install extension using VS Code API
 * 6. Clean up temporary files and show results
 */
export async function installExtensionFromRemoteVsix(): Promise<void> {
    try {
        // Step 1: Get user input
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter extension identifier, marketplace URL, or identifier@version',
            placeHolder:
                'publisher.extension-name[@version] or https://marketplace.visualstudio.com/items?itemName=...',
            validateInput: validateUserInput,
        });

        if (!userInput) {
            return; // User cancelled
        }

        // Parse user input to extract extension info and optional version
        const { publisher, extensionName, version: specifiedVersion } = parseUserInput(userInput);
        const extensionId = `${publisher}.${extensionName}`;

        // Step 2: Show progress and get extension info
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Installing extension ${extensionId}`,
                cancellable: true,
            },
            async (progress, token) => {
                progress.report({ increment: 10, message: 'Querying extension info...' });

                // Get extension information and handle version selection
                let selectedVersion = specifiedVersion;

                if (!selectedVersion) {
                    // No version specified, get available versions and let user choose
                    progress.report({ increment: 20, message: 'Fetching available versions...' });
                    const versions = await getExtensionVersions(publisher, extensionName);
                    if (token.isCancellationRequested) return;

                    const versionChoice = await vscode.window.showQuickPick(
                        versions.map((v: { version: string; lastUpdated: string }) => ({
                            label: v.version,
                            description: `Released: ${new Date(v.lastUpdated).toLocaleDateString()}`,
                        })),
                        {
                            placeHolder: 'Select version to install',
                            title: `Available versions for ${extensionId}`,
                        },
                    );

                    selectedVersion = versionChoice?.label;

                    if (!selectedVersion) {
                        return; // User cancelled version selection
                    }
                }

                const extensionInfo = {
                    publisher,
                    name: extensionName,
                    version: selectedVersion,
                    displayName: extensionId,
                    description: '',
                };
                if (token.isCancellationRequested) return;

                progress.report({
                    increment: 20,
                    message: `Installing ${extensionInfo.displayName} v${extensionInfo.version}`,
                });

                // Download VSIX file
                progress.report({ increment: 20, message: 'Downloading VSIX file...' });
                const vsixPath = await downloadVsixFile(extensionInfo, token);
                if (token.isCancellationRequested) {
                    await cleanupTempFile(vsixPath);
                    return;
                }

                progress.report({ increment: 30, message: 'Installing extension...' });

                // Install extension
                await installExtensionFromVsix(vsixPath);

                progress.report({ increment: 10, message: 'Cleaning up temporary files...' });

                // Clean up temporary files
                await cleanupTempFile(vsixPath);

                // Show success message
                vscode.window.showInformationMessage(
                    `Extension "${extensionInfo.displayName}" (v${extensionInfo.version}) installed successfully!`,
                );
            },
        );
    } catch (error) {
        logger.error('Failed to install extension', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to install extension: ${errorMessage}`);
    }
}

/**
 * Parse user input to extract extension information
 */
function parseUserInput(input: string): {
    publisher: string;
    extensionName: string;
    version?: string;
} {
    let cleanInput = input.trim();

    // Handle marketplace URL
    if (cleanInput.includes('marketplace.visualstudio.com')) {
        const urlMatch = cleanInput.match(/[?&]itemName=([^&]+)/);
        if (urlMatch) {
            cleanInput = urlMatch[1];
        } else {
            throw new Error('Invalid marketplace URL format');
        }
    }

    // Handle version specification (identifier@version)
    let version: string | undefined;
    const versionMatch = cleanInput.match(/^([^@]+)@([^@]+)$/);
    if (versionMatch) {
        cleanInput = versionMatch[1];
        version = versionMatch[2];
    }

    // Parse publisher.extensionName format
    const parts = cleanInput.split('.');
    if (parts.length !== 2) {
        throw new Error('Format should be: publisher.extension-name');
    }

    const [publisher, extensionName] = parts;
    if (!publisher || !extensionName) {
        throw new Error('Publisher and extension name cannot be empty');
    }

    // Basic naming rule check
    const nameRegex = /^[a-z0-9][\w\-]*$/i;
    if (!nameRegex.test(publisher) || !nameRegex.test(extensionName)) {
        throw new Error(
            'Publisher and extension name can only contain letters, numbers, hyphens and underscores',
        );
    }

    return { publisher, extensionName, version };
}

/**
 * Validate user input format
 */
function validateUserInput(value: string): string | undefined {
    if (!value) {
        return 'Please enter extension identifier or marketplace URL';
    }

    try {
        parseUserInput(value);
        return undefined; // Valid input
    } catch (error) {
        return error instanceof Error ? error.message : 'Invalid input format';
    }
}

/**
 * Get extension versions from Marketplace API
 */
async function getExtensionVersions(
    publisher: string,
    extensionName: string,
): Promise<Array<{ version: string; lastUpdated: string }>> {
    const apiUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

    const requestBody = {
        filters: [
            {
                criteria: [{ filterType: 7, value: `${publisher}.${extensionName}` }],
                pageNumber: 1,
                pageSize: 50, // Increase to get more results
                sortBy: 0,
                sortOrder: 0,
            },
        ],
        assetTypes: ['Microsoft.VisualStudio.Services.VSIXPackage'],
        flags: 0x1 | 0x2 | 0x10, // IncludeVersions | IncludeFiles | IncludeVersionProperties
    };

    const postData = JSON.stringify(requestBody);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json;api-version=3.0-preview.1',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'vscode-neo-file-utils',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(apiUrl, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response: MarketplaceResponse = JSON.parse(data);

                    if (!response.results?.[0]?.extensions?.[0]) {
                        reject(new Error(`Extension "${publisher}.${extensionName}" not found`));
                        return;
                    }

                    const extension = response.results[0].extensions[0];

                    // Return all versions, sorted by most recent first
                    const versions = extension.versions.map((v: any) => ({
                        version: v.version,
                        lastUpdated: v.lastUpdated,
                    }));

                    logger.info(
                        `Found ${versions.length} versions for ${publisher}.${extensionName}`,
                    );
                    if (versions.length > 0) {
                        logger.info(
                            `Latest version: ${versions[0].version}, Oldest version: ${versions.at(-1)?.version}`,
                        );
                    }

                    resolve(versions);
                } catch (error) {
                    reject(
                        new Error(
                            `Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        ),
                    );
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`API request failed: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Download VSIX file to temporary directory
 */
async function downloadVsixFile(
    extensionInfo: ExtensionInfo,
    cancellationToken: vscode.CancellationToken,
): Promise<string> {
    // Use VS Assets Gallery (recommended by mjmirza/Download-VSIX-From-Visual-Studio-Market-Place) // cSpell:ignore mjmirza
    const vsAssetsUrl = `https://${extensionInfo.publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${extensionInfo.publisher}/extension/${extensionInfo.name}/${extensionInfo.version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`; // cSpell:ignore vsassets

    const tempDir = os.tmpdir();
    const fileName = `${extensionInfo.publisher}.${extensionInfo.name}-${extensionInfo.version}.vsix`;
    const filePath = path.join(tempDir, fileName);

    logger.info(`Downloading VSIX: ${vsAssetsUrl} -> ${filePath}`);

    return downloadFromUrl(vsAssetsUrl, filePath, cancellationToken);
}

/**
 * Download file from URL
 */
function downloadFromUrl(
    url: string,
    filePath: string,
    cancellationToken: vscode.CancellationToken,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        let downloadedBytes = 0;
        let expectedBytes: number | undefined;

        const cleanup = () => {
            file.close();
            fsPromises.unlink(filePath).catch(() => {});
        };

        const request = https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    cleanup();
                    // Recursive call for redirect
                    downloadFromUrl(redirectUrl, filePath, cancellationToken)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                cleanup();
                reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                return;
            }

            // Validate Content-Type
            const contentType = response.headers['content-type'];
            logger.info(`Response Content-Type: ${contentType}`);

            // VS Code Marketplace can return various content types for VSIX files
            const validContentTypes = [
                'application/octet-stream',
                'application/zip',
                'application/vsix', // Official VSIX content type
            ];

            if (
                contentType &&
                !validContentTypes.some((validType) => contentType.includes(validType))
            ) {
                cleanup();
                reject(
                    new Error(
                        `Invalid content type: ${contentType}. Expected one of: ${validContentTypes.join(', ')}`,
                    ),
                );
                return;
            }

            // Get expected file size from Content-Length header
            const contentLength = response.headers['content-length'];
            if (contentLength) {
                expectedBytes = Number.parseInt(contentLength, 10);
                logger.info(`Expected file size: ${expectedBytes} bytes`);
            }

            // Track downloaded bytes
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
            });

            response.pipe(file);

            file.on('finish', async () => {
                file.close();

                // Verify file size if Content-Length was provided
                if (expectedBytes && downloadedBytes !== expectedBytes) {
                    cleanup();
                    reject(
                        new Error(
                            `File size mismatch: expected ${expectedBytes} bytes, got ${downloadedBytes} bytes`,
                        ),
                    );
                    return;
                }

                logger.info(`Download completed: ${downloadedBytes} bytes`);

                // Verify the file is a valid ZIP file (VSIX is a ZIP file)
                try {
                    await validateVsixFile(filePath);
                    resolve(filePath);
                } catch (error) {
                    cleanup();
                    reject(
                        new Error(
                            `Invalid VSIX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        ),
                    );
                }
            });

            response.on('error', (error) => {
                cleanup();
                reject(new Error(`Response stream error: ${error.message}`));
            });
        });

        request.on('error', (error) => {
            cleanup();
            reject(new Error(`Download request failed: ${error.message}`));
        });

        // Handle cancellation
        cancellationToken.onCancellationRequested(() => {
            request.destroy();
            cleanup();
            reject(new Error('Download cancelled by user'));
        });
    });
}

/**
 * Validate that the downloaded file is a valid ZIP/VSIX file
 */
async function validateVsixFile(filePath: string): Promise<void> {
    const fileHandle = await fsPromises.open(filePath, 'r');

    try {
        // Read the first 4 bytes to check for ZIP signature
        const buffer = Buffer.alloc(4);
        await fileHandle.read(buffer, 0, 4, 0);

        // ZIP files start with 'PK' (0x504B)
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
            throw new Error('File is not a valid ZIP/VSIX file (missing ZIP signature)');
        }

        // Get file stats
        const stats = await fsPromises.stat(filePath);
        if (stats.size === 0) {
            throw new Error('File is empty');
        }

        // Check if file size is reasonable (at least 1KB for a valid VSIX)
        if (stats.size < 1024) {
            throw new Error(`File size too small: ${stats.size} bytes`);
        }

        logger.info(`VSIX file validation passed: ${stats.size} bytes`);
    } finally {
        await fileHandle.close();
    }
}

/**
 * Install extension using VS Code API
 */
async function installExtensionFromVsix(vsixPath: string): Promise<void> {
    try {
        // Use VS Code's extension installation API
        const uri = vscode.Uri.file(vsixPath);
        await vscode.commands.executeCommand('workbench.extensions.installExtension', uri);

        logger.info(`Extension installed successfully: ${vsixPath}`);
    } catch (error) {
        throw new Error(
            `Failed to install extension: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFile(filePath: string): Promise<void> {
    try {
        await fsPromises.access(filePath);
        await fsPromises.unlink(filePath);
        logger.info(`Temporary file cleaned up: ${filePath}`);
    } catch (error) {
        // File doesn't exist or already cleaned up, which is fine
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn(`Failed to clean up temporary file: ${filePath}`, error);
        }
    }
}
