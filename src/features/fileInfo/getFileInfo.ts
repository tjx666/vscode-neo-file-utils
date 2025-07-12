import fs from 'node:fs/promises';
import path from 'node:path';

import { file as brotliSizeFromFile } from 'brotli-size';
import { fileTypeFromFile } from 'file-type';
// @ts-expect-error maybe we should fix tsconfig
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { gzipSizeFromFile } from 'gzip-size';
import { isBinaryFile } from 'isbinaryfile';
import { lookup } from 'mrmime';

interface Options {
    useIEC?: boolean;
}

interface FileInfo {
    absolutePath: string;
    isSymbolicLink: boolean;
    realPath?: string;
    fileType?: string;
    mime?: string;
    createdTime: string;
    changedTime: string;
    size: number;
    prettySize: string;
    gzipSize: number;
    prettyGzipSize: string;
    brotliSize: number;
    prettyBrotliSize: string;
    tokenCount?: number;
    prettyTokenCount?: string;
}

const DECIMAL_BASE = 1000;
const IEC_BASE = 1024;
const IEC_SUFFIXES = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
const DECIMAL_SUFFIXES = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

function getPrettySize(size: number, base: number, suffixes: string[]) {
    if (size === 0) return '0 bytes';
    if (size === 1) return '1 byte';

    const scale = Math.floor(Math.log(size) / Math.log(base));
    const activeSuffix = suffixes[scale];
    const scaledSize = size / base ** scale;
    // Round size with a decimal precision of 2
    const fixedScale = Math.round(Number(`${scaledSize}e+2`));
    const roundedSize = Number(`${fixedScale}e-2`);
    return `${roundedSize} ${activeSuffix}`;
}

export async function getFilePrettySize(filePath: string) {
    const stats = await fs.stat(filePath);
    return getPrettySize(stats.size, DECIMAL_BASE, DECIMAL_SUFFIXES);
}

/**
 * Format token count with appropriate unit (k for thousands, M for millions)
 */
export function formatTokenCount(count: number): string {
    if (count >= 1000000) {
        // Format with millions (M)
        const scaledSize = count / 1000000;
        // Round with a decimal precision of 2 and remove trailing zeros
        const fixedScale = Math.round(Number(`${scaledSize}e+2`));
        const roundedSize = Number(`${fixedScale}e-2`);
        return `${roundedSize}M`;
    }
    if (count >= 1000) {
        // Format with thousands (k)
        const scaledSize = count / 1000;
        // Round with a decimal precision of 2 and remove trailing zeros
        const fixedScale = Math.round(Number(`${scaledSize}e+2`));
        const roundedSize = Number(`${fixedScale}e-2`);
        return `${roundedSize}k`;
    }
    // Just return the count for numbers less than 1000
    return count.toString();
}

export async function getFileInfo(filePath: string, options?: Options): Promise<FileInfo> {
    const defaultOptions: Required<Options> = {
        useIEC: false,
    };
    options = {
        ...defaultOptions,
        ...options,
    };

    const base = options.useIEC ? IEC_BASE : DECIMAL_BASE;
    const suffixes = options.useIEC ? IEC_SUFFIXES : DECIMAL_SUFFIXES;

    const stats = await fs.stat(filePath);
    const absolutePath = path.normalize(filePath);
    const gzipSize = await gzipSizeFromFile(filePath);
    const brotliSize = await brotliSizeFromFile(filePath);

    let fileType: string | undefined;
    let mime: string | undefined;
    let tokenCount: number | undefined;

    const isBinary = await isBinaryFile(filePath);

    if (isBinary) {
        const fileTypeInfo = await fileTypeFromFile(filePath);
        if (fileTypeInfo) {
            fileType = fileTypeInfo.ext;
            mime = fileTypeInfo.mime;
        }
    } else {
        // 只对非二进制文件计算 token
        try {
            const content = await fs.readFile(filePath, 'utf8');
            tokenCount = countTokens(content);
        } catch (error) {
            console.error(`Error calculating tokens for ${filePath}:`, error);
        }
    }

    if (mime === undefined) {
        mime = lookup(path.extname(filePath)) as string | undefined;
    }

    const fileInfo: FileInfo = {
        absolutePath,
        isSymbolicLink: stats.isSymbolicLink(),
        realPath: undefined,
        createdTime: stats.birthtime.toLocaleString(),
        changedTime: stats.ctime.toLocaleString(),
        fileType,
        mime,
        size: stats.size,
        prettySize: getPrettySize(stats.size, base, suffixes),
        gzipSize,
        prettyGzipSize: getPrettySize(gzipSize, base, suffixes),
        brotliSize,
        prettyBrotliSize: getPrettySize(brotliSize, base, suffixes),
        tokenCount,
        prettyTokenCount: tokenCount ? formatTokenCount(tokenCount) : undefined,
    };

    if (fileInfo.isSymbolicLink) {
        fileInfo.realPath = await fs.realpath(filePath);
    }

    for (const [key, value] of Object.entries(fileInfo)) {
        if (value === undefined) {
            Reflect.deleteProperty(fileInfo, key);
        }
    }

    return fileInfo;
}
