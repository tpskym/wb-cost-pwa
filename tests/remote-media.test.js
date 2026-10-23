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
test('rich content images include desktop mobile and nested sources, excluding product links and video',async()=>{
 const {richContentImages}=await import('../remote-media.js');const content={content:[{widgetName:'raTextImage',blocks:[{img:{src:'https://cdn.example.com/desktop.jpg',srcMobile:'https://cdn.example.com/mobile.webp'},link:'https://example.com/product'}]},{widgetName:'raVideo',src:'https://cdn.example.com/video.mp4',poster:'https://cdn.example.com/poster.jpg'},{images:['https://cdn.example.com/desktop.jpg','https://cdn.example.com/extra.jpg']}]};
 assert.deepEqual(richContentImages(JSON.stringify(content)),['https://cdn.example.com/desktop.jpg','https://cdn.example.com/mobile.webp','https://cdn.example.com/poster.jpg','https://cdn.example.com/extra.jpg']);assert.deepEqual(richContentImages('{bad-json'),[]);
 const media=collectRemoteMedia('ozon',{}, {attributes:[{id:99,values:[{value:JSON.stringify(content)}]}]},[{id:99,name:'Рич-контент JSON'}]);assert.equal(media.length,4);assert.ok(media.every(file=>file.kind==='rich-content'));
});
test('rich images get a separate archive folder and WB links can be supplied manually',async()=>{
 const {addManualRichImages}=await import('../remote-media.js'),source=addManualRichImages({market:'wb',article:'SKU',media:[]},'https://cdn.example.com/rich.png\nhttps://cdn.example.com/rich.png');assert.equal(source.media.length,1);const result=await buildRemoteMediaArchive(source,{fetcher:async()=>new Response('rich-image',{headers:{'content-type':'image/png'}})}),entries=await readZip(result.blob);assert.ok([...entries.keys()].some(path=>path.startsWith('rich-content/')));assert.throws(()=>addManualRichImages(source,'javascript:alert(1)'),/HTTPS/);
});
test('direct links can be opened and copied from the editor without downloading files',async()=>{
 const {JSDOM}=await import('jsdom'),{renderRemoteMediaLinks}=await import('../remote-media.js'),dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');renderRemoteMediaLinks(root,{market:'ozon',media:[{url:'https://cdn.example.com/rich.jpg',kind:'rich-content',label:'Изображение <script>'},{url:'javascript:alert(1)',kind:'photos',label:'Недопустимо'}]});
 assert.equal(root.querySelectorAll('a').length,1);assert.equal(root.querySelector('a').href,'https://cdn.example.com/rich.jpg');assert.equal(root.querySelector('a').target,'_blank');assert.ok(root.querySelector('a').rel.includes('noreferrer'));assert.equal(root.querySelector('script'),null);await root.querySelector('li button').onclick();assert.equal(root.querySelector('textarea').value,'https://cdn.example.com/rich.jpg');assert.ok(root.querySelector('[role="status"]').textContent.includes('Ctrl+C'));
});
test('WB public rich content uses the exact photo shard and resolves extensionless image sources',async()=>{
 const {wbRichContentURL,loadWBRichContent}=await import('../remote-media.js'),card={nmID:1682159548,photos:[{big:'https://basket-50.wbbasket.ru/vol16821/part1682159/1682159548/images/big/1.webp?x=1'}]},expected='https://basket-50.wbbasket.ru/vol16821/part1682159/1682159548/info/ru/rich_v1.json';assert.equal(wbRichContentURL(card),expected);
 assert.equal(wbRichContentURL({...card,nmID:42}),null);assert.equal(wbRichContentURL({nmID:42,photos:[{big:'https://attacker.example/vol0/part0/42/images/1.jpg'}]}),null);
 const content={content:[{type:'gallery',blocks:[{image:{src:'https://content-02.wbbasket.ru/uuid/1'}},{image:{src:'https://content-02.wbbasket.ru/uuid/1'}}]}],preview:{src:'https://content-02.wbbasket.ru/uuid/cover'}};
 const fetcher=async(url,options)=>{assert.equal(url,expected);assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);assert.equal(options.mode,'cors');return Response.json(content);};
 const rich=await loadWBRichContent(card,{fetcher});assert.equal(rich.status,'loaded');assert.deepEqual(rich.images,['https://content-02.wbbasket.ru/uuid/1.webp','https://content-02.wbbasket.ru/uuid/cover.webp']);
 const draft={mode:'update',body:JSON.stringify([{nmID:card.nmID}])},source=await loadRemoteMedia('wb',draft,async()=>({cards:[{...card,vendorCode:'AW'}]}),{fetcher});assert.equal(source.media.filter(file=>file.kind==='rich-content').length,2);
 const archive=await buildRemoteMediaArchive(source,{fetcher:async()=>new Response('image',{headers:{'content-type':'image/webp'}})}),entries=await readZip(archive.blob);assert.equal([...entries.keys()].filter(path=>path.startsWith('rich-content/')&&path.endsWith('.webp')).length,2);assert.equal(JSON.parse(await entries.get('Материалы.json').text()).richContent.status,'loaded');
});
test('WB rich content failure is reported without losing ordinary media',async()=>{
 const {loadWBRichContent}=await import('../remote-media.js'),card={nmID:42,photos:[{big:'https://basket-01.wbbasket.ru/vol0/part0/42/images/big/1.webp'}]};
 assert.equal((await loadWBRichContent(card,{fetcher:async()=>new Response('',{status:404})})).status,'missing');
 for(const fetcher of [async()=>{throw Error('Failed to fetch');},async()=>Response.json({error:'bad'}),async()=>new Response('too big',{headers:{'content-length':'6000000'}})]){const source=await loadRemoteMedia('wb',{mode:'update',body:'[{"nmID":42}]'},async()=>({cards:[card]}),{fetcher});assert.equal(source.richContent.status,'error');assert.equal(source.media.length,1);}
});
test('rich content text keeps WB headings before paragraphs and lists in block order',async()=>{
 const {richContentText,loadWBRichContent}=await import('../remote-media.js');const data={content:[{type:'gallery',blocks:[{text:{data:'Первый абзац'},image:{src:'https://cdn.example.com/a'},header:{data:'Заголовок 1'}},{header:{data:'Заголовок 2'},text:{data:'<p>Второй &amp; текст</p><p>Новая строка</p>'}}]},{type:'list',blocks:[{header:{data:'Комплект'},bullets:[{text:{data:'Подставка'}},{text:{data:'Инструкция'}}]}]}]};
 const expected='Заголовок 1\n\nПервый абзац\n\nЗаголовок 2\n\nВторой & текст\nНовая строка\n\nКомплект\n\nПодставка\nИнструкция';assert.equal(richContentText(data),expected);assert.equal(richContentText('{broken'), '');
 const result=await loadWBRichContent({nmID:42,photos:[{big:'https://basket-01.wbbasket.ru/vol0/part0/42/images/1.webp'}]},{fetcher:async()=>Response.json(data)});assert.equal(result.text,expected);assert.deepEqual(result.data,data);
});
test('Ozon text-only rich content is available for copying and ZIP even without images',async()=>{
 const content={content:[{widgetName:'raTextBlock',title:{content:['Заголовок Ozon']},text:{content:['Первый абзац','Второй абзац']},style:{color:'red'}}]},encoded=JSON.stringify(content),source=await loadRemoteMedia('ozon',{mode:'update',body:'{"items":[{"offer_id":"AW"}]}'},async op=>op==='info'?{items:[{offer_id:'AW'}]}:{result:[{offer_id:'AW',attributes:[{id:11254,values:[{value:encoded}]}],rich_content:content}]});
 assert.equal(source.richContent.text,'Заголовок Ozon\n\nПервый абзац\nВторой абзац');assert.equal(source.richContent.data.length,1);assert.equal(source.media.length,0);
 const archive=await buildRemoteMediaArchive(source),files=await readZip(archive.blob);assert.equal(await files.get('rich-content/Тексты с заголовками.txt').text(),source.richContent.text);assert.deepEqual(JSON.parse(await files.get('rich-content/Исходные данные.json').text()),[content]);
 const {JSDOM}=await import('jsdom'),{renderRemoteMediaLinks}=await import('../remote-media.js'),dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');renderRemoteMediaLinks(root,source);assert.equal(root.querySelector('textarea').value,source.richContent.text);await root.querySelector('details details button').onclick();assert.equal(root.querySelector('.direct-media-copy-text').value,source.richContent.text);
});
