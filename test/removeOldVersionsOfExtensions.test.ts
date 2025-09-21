import { deepStrictEqual, strictEqual } from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    compareVersions,
    prepareDeletionPlan,
} from '../src/features/removeOldVersionsOfExtensions';

describe('cleanExtensionCaches.prepareDeletionPlan', () => {
    let tempDir: string;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neo-clean-'));

        /**
         * Helper function to create extension folder with package.json
         */
        const createExtensionFolder = async (folderName: string, name: string, version: string) => {
            const folderPath = path.join(tempDir, folderName);
            await fs.mkdir(folderPath);
            await fs.writeFile(path.join(folderPath, 'file.txt'), 'test content');
            await fs.writeFile(
                path.join(folderPath, 'package.json'),
                JSON.stringify({ name, version }, null, 2),
            );
        };

        await createExtensionFolder('sample.extension-1.0.0', 'sample.extension', '1.0.0');
        await createExtensionFolder('sample.extension-1.2.0', 'sample.extension', '1.2.0');
        await createExtensionFolder(
            'sample.extension-1.1.0-beta.1',
            'sample.extension',
            '1.1.0-beta.1',
        );
        await createExtensionFolder('other.extension-2.0.0-universal', 'other.extension', '2.0.0');
        await createExtensionFolder('other.extension-1.9.0-universal', 'other.extension', '1.9.0');
        await createExtensionFolder('test.extension-1.5.0-darwin-arm64', 'test.extension', '1.5.0');
        await createExtensionFolder('test.extension-2.0.0-darwin-arm64', 'test.extension', '2.0.0');

        await fs.writeFile(path.join(tempDir, 'extensions.json'), '{}');
    });

    after(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('returns outdated folders grouped by extension id', async () => {
        const plan = await prepareDeletionPlan(tempDir);
        const targetNames = plan.targets.map((target) => target.folderName).sort();

        deepStrictEqual(targetNames, [
            'other.extension-1.9.0-universal',
            'sample.extension-1.0.0',
            'sample.extension-1.1.0-beta.1',
            'test.extension-1.5.0-darwin-arm64',
        ]);
        strictEqual(plan.targets.length, 4);
        strictEqual(plan.preview.length > 0, true);
    });
});

describe('cleanExtensionCaches.compareVersions', () => {
    it('treats higher numeric segments as newer', () => {
        strictEqual(compareVersions('1.2.0', '1.1.9') > 0, true);
        strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
        strictEqual(compareVersions('2.0.0', '10.0.0') < 0, true);
    });

    it('places release versions above prerelease variants', () => {
        strictEqual(compareVersions('1.0.0', '1.0.0-beta.1') > 0, true);
        strictEqual(compareVersions('1.0.0-beta.2', '1.0.0-beta.1') > 0, true);
    });
});

describe('cleanExtensionCaches.version pattern parsing', () => {
    it('correctly parses extension folders with platform suffixes', async () => {
        const extensionTestCases = [
            {
                dirName: 'ms-python.python-2025.6.1-darwin-arm64',
                name: 'ms-python.python',
                version: '2025.6.1',
            },
            {
                dirName: 'anthropic.claude-code-1.0.120-universal',
                name: 'anthropic.claude-code',
                version: '1.0.120',
            },
            {
                dirName: 'astro-build.astro-vscode-2.15.4-darwin-arm64',
                name: 'astro-build.astro-vscode',
                version: '2.15.4',
            },
            { dirName: 'regular.extension-1.0.0', name: 'regular.extension', version: '1.0.0' },
        ];

        /* eslint-disable no-await-in-loop */
        for (const { dirName, name, version } of extensionTestCases) {
            const tempDirForPlatform = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-test-'));
            const extensionPath = path.join(tempDirForPlatform, dirName);

            await fs.mkdir(extensionPath);
            await fs.writeFile(path.join(extensionPath, 'file.txt'), 'test');
            await fs.writeFile(
                path.join(extensionPath, 'package.json'),
                JSON.stringify({ name, version }, null, 2),
            );

            const plan = await prepareDeletionPlan(tempDirForPlatform);
            // should be able to correctly parse all format of extension directory name
            strictEqual(plan.extensionCount >= 1, true, `Failed to parse: ${dirName}`);

            await fs.rm(tempDirForPlatform, { recursive: true, force: true });
        }
        /* eslint-enable no-await-in-loop */
    });
});
