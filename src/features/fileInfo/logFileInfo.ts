import util from 'node:util';

import { getFileInfo } from './getFileInfo';
import { logger } from '../../logger';
import { getActiveFile } from '../../utils';

export async function logFileInfo() {
    const activeFile = await getActiveFile();
    if (!activeFile) return;

    const fileInfo = await getFileInfo(activeFile.fsPath);
    logger.log(
        util.inspect(fileInfo, {
            compact: false,
            depth: Number.POSITIVE_INFINITY,
        }),
        true,
    );
}
