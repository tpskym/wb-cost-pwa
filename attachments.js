// Binary files stay in IndexedDB; neither files nor file contents are published.
export function openFilesDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('workshop-files-v1',1);req.onupgradeneeded=()=>{const store=req.result.createObjectStore('files',{keyPath:'id'});store.createIndex('owner','owner');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function transaction(mode,action){const db=await openFilesDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);const request=action(tx.objectStore('files'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Операция отменена'));});}finally{db.close();}}
export const listFiles=owner=>transaction('readonly',store=>store.index('owner').getAll(owner));
export const getFile=id=>transaction('readonly',store=>store.get(id));
export const putFile=record=>transaction('readwrite',store=>store.put(record));
export const deleteFile=id=>transaction('readwrite',store=>store.delete(id));
export function safeFilename(name){return name.replace(/[\\/\x00-\x1f]/g,'_').replace(/^\.+/,'_')||'file';}
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Store-only ZIP: standard ZIP reader support, UTF-8 filenames, original bytes preserved.
export async function makeZip(entries){
 const encoder=new TextEncoder(),parts=[],central=[];let offset=0,centralSize=0;
 for(const entry of entries){const name=encoder.encode(entry.name),data=new Uint8Array(await entry.blob.arrayBuffer()),crc=crc32(data);if(name.length>65535||data.length>0xffffffff)throw Error('Файл слишком большой для ZIP');
  const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
  const directory=new Uint8Array(46+name.length),dv=new DataView(directory.buffer);dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x800,true);dv.setUint16(14,33,true);dv.setUint32(16,crc,true);dv.setUint32(20,data.length,true);dv.setUint32(24,data.length,true);dv.setUint16(28,name.length,true);dv.setUint32(42,offset,true);directory.set(name,46);parts.push(local,data);central.push(directory);offset+=local.length+data.length;centralSize+=directory.length;
 }
 if(entries.length>65535||offset+centralSize>0xffffffff)throw Error('Архив слишком большой');
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
