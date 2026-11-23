import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('..',import.meta.url));
const license=await readFile(new URL('../node_modules/fflate/LICENSE',import.meta.url),'utf8');
await build({
 absWorkingDir:project,stdin:{contents:"export {unzipSync} from 'fflate';",resolveDir:project},
 outfile:'ozon-report-zip.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof',
 banner:{js:'/*! fflate\n'+license.trim()+'\n*/'}
});
