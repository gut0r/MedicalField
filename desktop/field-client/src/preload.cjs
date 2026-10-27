const { contextBridge } = require('electron/renderer');

const storageArgument = process.argv.find((argument) => argument.startsWith('--medicalfield-storage='));
const storagePath = storageArgument ? decodeURIComponent(storageArgument.slice('--medicalfield-storage='.length)) : '';

contextBridge.exposeInMainWorld('medicalFieldDesktop', Object.freeze({
  isDesktop: true,
  storagePath,
  inspectShortcut: 'Ctrl+Shift+I',
}));
