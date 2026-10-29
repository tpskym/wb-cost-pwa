import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('pdfjs',{recursive:true});
for(const name of ['pdf.min.mjs','pdf.worker.min.mjs'])await copyFile('node_modules/pdfjs-dist/build/'+name,'pdfjs/'+name);
for(const name of ['wasm','standard_fonts','cmaps'])await cp('node_modules/pdfjs-dist/'+name,'pdfjs/'+name,{recursive:true});
