import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('..',import.meta.url));
const licenses=await Promise.all(['read-excel-file','fflate'].map(async name=>{
 const license=await readFile(new URL('../node_modules/'+name+'/LICENSE',import.meta.url),'utf8');
 return '/*! '+name+'\n'+license.trim()+'\n*/';
}));
await build({
 absWorkingDir:project,stdin:{contents:"export {default as readSheet,readSheetNames} from 'read-excel-file';",resolveDir:project},
 outfile:'ozon-workbook-runtime.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof',
 banner:{js:licenses.join('\n')}
});
