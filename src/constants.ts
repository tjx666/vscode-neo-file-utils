import os from 'node:os';

import vscode from 'vscode';

import { getCurrentIDE } from './utils/ide';

const isInsidersVersion = vscode.version.toLowerCase().includes('insider');
const home = os.homedir();

// infer extensions folder based on current IDE
const ide = getCurrentIDE();
const ideFolder = ide === 'vscode' && isInsidersVersion ? '.vscode-insiders' : `.${ide}`;
const allExtensionsFolder = `${home}/${ideFolder}/extensions`;

export { allExtensionsFolder, home };
