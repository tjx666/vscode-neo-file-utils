import { strictEqual } from 'node:assert';
import * as path from 'node:path';

import { findCommonBaseDirectory } from '../src/features/batchMergeConflict';

describe('findCommonBaseDirectory', () => {
    describe('edge cases', () => {
        it('should return empty string for empty array', () => {
            const result = findCommonBaseDirectory([]);
            strictEqual(result, '');
        });

        it('should return parent directory for single file', () => {
            const filePath = path.join('workspace', 'src', 'app.ts');
            const result = findCommonBaseDirectory([filePath]);
            const expected = path.join('workspace', 'src');
            strictEqual(result, expected);
        });
    });

    describe('same directory', () => {
        it('should return common directory for files in same folder', () => {
            const files = [
                path.join('workspace', 'src', 'components', 'Header.tsx'),
                path.join('workspace', 'src', 'components', 'Footer.tsx'),
                path.join('workspace', 'src', 'components', 'Button.tsx'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('workspace', 'src', 'components');
            strictEqual(result, expected);
        });
    });

    describe('different subdirectories', () => {
        it('should return common parent for files in different subdirectories', () => {
            const files = [
                path.join('workspace', 'src', 'components', 'Header.tsx'),
                path.join('workspace', 'src', 'utils', 'auth.ts'),
                path.join('workspace', 'src', 'services', 'api.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('workspace', 'src');
            strictEqual(result, expected);
        });

        it('should handle mixed depth paths', () => {
            const files = [
                path.join('workspace', 'src', 'components', 'ui', 'Button.tsx'),
                path.join('workspace', 'src', 'utils', 'helpers.ts'),
                path.join('workspace', 'src', 'index.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('workspace', 'src');
            strictEqual(result, expected);
        });
    });

    describe('different project areas', () => {
        it('should return project root for files in different main directories', () => {
            const files = [
                path.join('workspace', 'src', 'components', 'Header.tsx'),
                path.join('workspace', 'tests', 'Header.test.ts'),
                path.join('workspace', 'docs', 'README.md'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = 'workspace';
            strictEqual(result, expected);
        });

        it('should handle very different paths', () => {
            const files = [
                path.join('project', 'frontend', 'src', 'app.tsx'),
                path.join('project', 'backend', 'src', 'server.ts'),
                path.join('project', 'shared', 'types.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = 'project';
            strictEqual(result, expected);
        });
    });

    describe('deeply nested paths', () => {
        it('should handle deeply nested file structures', () => {
            const files = [
                path.join('workspace', 'src', 'features', 'auth', 'components', 'LoginForm.tsx'),
                path.join('workspace', 'src', 'features', 'auth', 'services', 'authApi.ts'),
                path.join('workspace', 'src', 'features', 'auth', 'hooks', 'useAuth.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('workspace', 'src', 'features', 'auth');
            strictEqual(result, expected);
        });

        it('should find root when paths diverge early', () => {
            const files = [
                path.join('workspace', 'frontend', 'src', 'very', 'deep', 'nested', 'file1.ts'),
                path.join('workspace', 'backend', 'src', 'another', 'deep', 'nested', 'file2.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = 'workspace';
            strictEqual(result, expected);
        });
    });

    describe('identical paths', () => {
        it('should handle identical file paths', () => {
            const filePath = path.join('workspace', 'src', 'app.ts');
            const files = [filePath, filePath, filePath];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('workspace', 'src');
            strictEqual(result, expected);
        });
    });

    describe('real-world scenarios', () => {
        it('should handle typical merge conflict scenario', () => {
            const files = [
                path.join('my-app', 'src', 'components', 'Header.js'),
                path.join('my-app', 'src', 'utils', 'auth.js'),
                path.join('my-app', 'tests', 'components', 'Header.test.js'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = 'my-app';
            strictEqual(result, expected);
        });

        it('should handle git merge conflicts in feature branch', () => {
            const files = [
                path.join('project', 'src', 'features', 'userProfile', 'ProfilePage.tsx'),
                path.join('project', 'src', 'features', 'userProfile', 'ProfileForm.tsx'),
                path.join('project', 'src', 'features', 'userProfile', 'api', 'profileApi.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('project', 'src', 'features', 'userProfile');
            strictEqual(result, expected);
        });

        it('should handle cross-cutting concern files', () => {
            const files = [
                path.join('app', 'src', 'shared', 'types', 'User.ts'),
                path.join('app', 'src', 'shared', 'utils', 'validation.ts'),
                path.join('app', 'src', 'shared', 'constants', 'api.ts'),
            ];
            const result = findCommonBaseDirectory(files);
            const expected = path.join('app', 'src', 'shared');
            strictEqual(result, expected);
        });
    });

    describe('edge cases with special paths', () => {
        it('should handle root-level files', () => {
            const files = ['package.json', 'README.md', 'tsconfig.json'];
            const result = findCommonBaseDirectory(files);
            const expected = '.';
            strictEqual(result, expected);
        });

        it('should handle mix of root and nested files', () => {
            const files = ['package.json', path.join('src', 'index.ts')];
            const result = findCommonBaseDirectory(files);
            const expected = '.';
            strictEqual(result, expected);
        });
    });
});
