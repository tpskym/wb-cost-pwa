import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {normalizeZipNames,makeZip,readZip} from '../attachments.js';
function macZip({decomposed=false,descriptor=false}={}){return new Blob([execFileSync('python3',['-c',`import io,zipfile,struct,sys,unicodedata
class Stream(io.BytesIO):
 def seekable(self): return False
 def seek(self,*args): raise OSError()
b=Stream() if ${descriptor?'True':'False'} else io.BytesIO()
name='Фото/Зелёный ёжик.txt'
if ${decomposed?'True':'False'}: name=unicodedata.normalize('NFD',name)
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr(name,'кириллица и фото')
 z.writestr('Исходники/модель.txt','source')
v=bytearray(b.getvalue())
for signature,flag in [(b'PK\\x03\\x04',6),(b'PK\\x01\\x02',8)]:
 pos=0
 while True:
  i=v.find(signature,pos)
  if i<0:break
  struct.pack_into('<H',v,i+flag,struct.unpack_from('<H',v,i+flag)[0]&~0x800)
  pos=i+4
sys.stdout.buffer.write(v)`])]);}
function inspect(blob){return blob.arrayBuffer().then(buffer=>JSON.parse(execFileSync('python3',['-c',`import io,zipfile,json,sys
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 print(json.dumps([{'name':i.filename,'flags':i.flag_bits,'method':i.compress_type,'text':z.read(i).decode('utf-8')} for i in z.infolist()]))`],{input:Buffer.from(buffer),encoding:'utf8'})));}
test('Mac ZIP names get explicit UTF-8 and retain compressed bytes and contents',async()=>{for(const descriptor of [false,true]){const source=macZip({decomposed:true,descriptor}),fixed=await normalizeZipNames(source),files=await inspect(fixed);assert.notEqual(fixed,source);assert.equal(files[0].name,'Фото/Зелёный ёжик.txt');assert.equal(files[0].text,'кириллица и фото');assert.ok(files.every(file=>file.flags&0x800));assert.ok(files.every(file=>file.method===8));assert.equal(files[1].text,'source');assert.equal(await normalizeZipNames(fixed),fixed);}});
test('normal app ZIP remains byte-identical and readable by backup parser',async()=>{const zip=await makeZip([{name:'Фото/зелёный.png',blob:new Blob(['image'])}]);assert.equal(await normalizeZipNames(zip),zip);assert.equal(await (await readZip(zip)).get('Фото/зелёный.png').text(),'image');});
test('malformed ZIP cannot be returned as a repaired archive',async()=>{await assert.rejects(()=>normalizeZipNames(new Blob(['bad'])));const bytes=new Uint8Array(await macZip().arrayBuffer());bytes[0]=0;await assert.rejects(()=>normalizeZipNames(new Blob([bytes])));});
