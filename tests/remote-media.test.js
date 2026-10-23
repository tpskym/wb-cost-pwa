import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectRemoteMedia,buildRemoteMediaArchive,loadRemoteMedia} from '../remote-media.js';
import {readZip} from '../attachments.js';
test('WB collects full-size photos and video without thumbnails or duplicate URLs',()=>{
 const media=collectRemoteMedia('wb',{photos:[{big:'https://cdn.example.com/1.jpg',c516x688:'https://cdn.example.com/small.jpg'},{big:'https://cdn.example.com/1.jpg'}],video:'https://cdn.example.com/clip.mp4'});assert.deepEqual(media.map(row=>row.url),['https://cdn.example.com/1.jpg','https://cdn.example.com/clip.mp4']);
});
test('Ozon collects photo video and PDF links from ordinary and complex attributes',()=>{
 const media=collectRemoteMedia('ozon',{primary_image:['https://cdn.example.com/1.jpg'],images:['https://cdn.example.com/1.jpg']},{pdf_list:[{name:'Инструкция',file_name:'https://cdn.example.com/a.pdf'}],complex_attributes:[{attributes:[{id:4,values:[{value:'https://cdn.example.com/clip.mp4'}]}]}]},[{id:4,name:'Озон.Видео: ссылка'}]);assert.deepEqual(media.map(row=>row.kind),['photos','documents','video']);
});
test('media ZIP downloads accessible files without API credentials and keeps failed files as links',async()=>{
 const media=[{url:'https://cdn.example.com/1.jpg',kind:'photos',label:'Фото 1'},{url:'https://cdn.example.com/2.mp4',kind:'video',label:'Видео'},{url:'https://cdn.example.com/stream.m3u8',kind:'video',label:'Поток'}],calls=[];
 const result=await buildRemoteMediaArchive({market:'wb',article:'SKU',media},{fetcher:async(url,options)=>{calls.push({url,options});assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);if(url.endsWith('.mp4'))throw Error('Failed to fetch');return new Response('photo-bytes',{headers:{'content-type':'image/jpeg'}});}});
 assert.equal(result.downloaded,1);assert.equal(result.total,3);assert.equal(calls.length,2);const entries=await readZip(result.blob),manifest=JSON.parse(await entries.get('Материалы.json').text());assert.equal(manifest.files[0].status,'downloaded');assert.equal(manifest.files[1].status,'link_only');assert.ok((await entries.get('Ссылки.txt').text()).includes('stream.m3u8'));assert.equal(await entries.get(manifest.files[0].path).text(),'photo-bytes');
});
test('download always reads the exact platform card and never writes or modifies its draft',async()=>{
 const draft={mode:'update',body:JSON.stringify([{nmID:42,vendorCode:'AW'}])},operations=[],result=await loadRemoteMedia('wb',draft,async(operation)=>{operations.push(operation);return {cards:[{nmID:41,vendorCode:'OTHER'},{nmID:42,vendorCode:'AW',photos:[{big:'https://cdn.example.com/a.jpg'}]}],cursor:{total:2}};});assert.deepEqual(operations,['list']);assert.equal(result.article,'AW');assert.equal(result.media.length,1);assert.equal(JSON.parse(draft.body)[0].vendorCode,'AW');
});
test('HTML responses and oversized files are not presented as downloaded media',async()=>{
 const result=await buildRemoteMediaArchive({market:'ozon',article:'SKU',media:[{url:'https://cdn.example.com/page',kind:'video',label:'Видео'}]},{fetcher:async()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})});assert.equal(result.downloaded,0);const entries=await readZip(result.blob);assert.equal(entries.size,3);
});
