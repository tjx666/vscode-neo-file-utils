import os from 'node:os';

import vscode from 'vscode';

const isInsidersVersion = vscode.version.toLowerCase().includes('insider');
const home = os.homedir();
const allExtensionsFolder = isInsidersVersion
    ? `${home}/.vscode-insiders/extensions`
    : `${home}/.vscode/extensions`;

export { home, allExtensionsFolder };
