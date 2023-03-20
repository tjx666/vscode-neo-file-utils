# VSCode Neo File Utils

<div align="center">

[![Version](https://img.shields.io/visual-studio-marketplace/v/YuTengjing.vscode-neo-file-utils)](https://marketplace.visualstudio.com/items/YuTengjing.vscode-neo-file-utils/changelog) [![Installs](https://img.shields.io/visual-studio-marketplace/i/YuTengjing.vscode-neo-file-utils)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-neo-file-utils) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/YuTengjing.vscode-neo-file-utils)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-neo-file-utils) [![Rating Star](https://img.shields.io/visual-studio-marketplace/stars/YuTengjing.vscode-neo-file-utils)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-neo-file-utils&ssr=false#review-details) [![Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/YuTengjing.vscode-neo-file-utils)](https://github.com/tjx666/vscode-neo-file-utils)

[![test](https://github.com/tjx666/vscode-neo-file-utils/actions/workflows/test.yml/badge.svg)](https://github.com/tjx666/vscode-neo-file-utils/actions/workflows/test.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](http://makeapullrequest.com) [![Percentage of issues still open](https://isitmaintained.com/badge/open/tjx666/vscode-neo-file-utils.svg)](http://isitmaintained.com/project/tjx666/vscode-neo-file-utils) [![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)

</div>

provide some file utils for vscode.

## Features

### Go to Symbolic Link Real Path

Just right click the explorer menu and select:

- Open Symbolic Link Real File
- Reveal Symbolic Link Real Folder

> **Note:**
> For now, only file and folder under node_modules will show the menu

![Go to Symbolic Link Real Path](https://github.com/tjx666/vscode-neo-file-utils/blob/main/assets/screenshots/go-to-symbolic-link-real-path.gif?raw=true)

### Detect Text File Encoding

Just open a text file and run command `Detect Text File Encoding`.

![Detect Text File Encoding](https://github.com/tjx666/vscode-neo-file-utils/blob/main/assets/screenshots/detect-text-file-enconding.gif?raw=true)

### File Size and Line Count in Status Bar

![File Size and Line Count in Status Bar](https://github.com/tjx666/vscode-neo-file-utils/blob/main/assets/screenshots/statusbar.png?raw=true)

### Open Folder Context Menus for VS Code

I just migrated code from extension: [Open Folder Context Menus for VS Code](https://github.com/chrisdias/vscode-opennewinstance)

### Smart Revert

check [source code](https://github.com/tjx666/vscode-neo-file-utils/blob/main/src/features/smartRevert.ts#L24) for details

### Batch Rename

I just migrated code from extension: [Batch Rename](https://github.com/JannisX11/batch-rename)

## My extensions

- [Open in External App](https://github.com/tjx666/open-in-external-app)
- [VSCode FE Helper](https://github.com/tjx666/vscode-fe-helper)
- [VSCode archive](https://github.com/tjx666/vscode-archive)
- [Modify File Warning](https://github.com/tjx666/modify-file-warning)
- [Adobe Extension Development Tools](https://github.com/tjx666/vscode-adobe-extension-devtools)
- [Scripting Listener](https://github.com/tjx666/scripting-listener)

Check all here: [publishers/YuTengjing](https://marketplace.visualstudio.com/publishers/YuTengjing)

## Thanks

- [filesize](https://github.com/mkxml/vscode-filesize)
- [Select Line Status Bar](https://github.com/tomoki1207/selectline-statusbar)
- [Open Folder Context Menus](https://github.com/chrisdias/vscode-opennewinstance)
- [Batch Rename](https://github.com/JannisX11/batch-rename)
