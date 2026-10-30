import {test} from 'node:test';
import assert from 'node:assert/strict';
import {costReportData,imagePagesPdf,openCostReport} from '../cost-report.js';
import {blankProduct,calculateManual} from '../calc.js';
test('cost report uses current calculator and does not mutate products',()=>{const p=blankProduct();p.sku='white';const before=structuredClone(p),report=costReportData([p])[0];assert.equal(report.result.cost,calculateManual(structuredClone(p)).cost);assert.ok(report.result.missing.length);assert.deepEqual(p,before);});
test('PDF page tree and cross reference offsets can be read by PDF.js',async()=>{const {getDocument,GlobalWorkerOptions}=await import('../pdfjs/pdf.min.mjs');GlobalWorkerOptions.workerSrc=new URL('../pdfjs/pdf.worker.min.mjs',import.meta.url).href;const blob=imagePagesPdf([{width:1,height:1,bytes:new Uint8Array([255,216,255,217])},{width:1,height:1,bytes:new Uint8Array([255,216,255,217])}]);assert.equal(blob.type,'application/pdf');const task=getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true}),pdf=await task.promise;assert.equal(pdf.numPages,2);assert.equal((await pdf.getPage(1)).view[2],595.28);await task.destroy();});
test('PDF report reports popup blocking before attempting to render',async()=>{await assert.rejects(openCostReport([],{open:()=>null}),/Разрешите/);});
