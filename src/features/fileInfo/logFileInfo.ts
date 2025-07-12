import { table } from 'table';

import { logger } from '../../logger';
import { getActiveFile } from '../../utils';
import { getFileInfo } from './getFileInfo';

export async function logFileInfo() {
    const activeFile = await getActiveFile();
    if (!activeFile) return;

    const fileInfo = await getFileInfo(activeFile.fsPath);
    logger.log(table(Object.entries(fileInfo)), true);
}
