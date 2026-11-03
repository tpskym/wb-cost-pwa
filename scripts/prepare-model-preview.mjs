import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
await build({entryPoints:[fileURLToPath(new URL('./model-preview-entry.js',import.meta.url))],outfile:fileURLToPath(new URL('../model-preview-runtime.js',import.meta.url)),bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
