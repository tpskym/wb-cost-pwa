import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeZip} from '../attachments.js';
const root=new URL('../',import.meta.url),names=['Install.cmd','Install.ps1','Open-WorkshopFile.ps1','Uninstall.cmd','Uninstall.ps1','README.txt'];
const files=await Promise.all(names.map(async name=>{let body=await readFile(new URL('windows-helper/'+name,root),'utf8');body=body.replace(/\r?\n/g,'\r\n');if(name.endsWith('.ps1')||name.endsWith('.txt'))body='\uFEFF'+body;return {name:'Workshop-Windows/'+name,blob:new Blob([body])};}));
await writeFile(fileURLToPath(new URL('workshop-windows.zip',root)),new Uint8Array(await (await makeZip(files)).arrayBuffer()));
