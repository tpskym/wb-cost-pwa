const API='https://www.googleapis.com/drive/v3/files';
const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
const NAME='Мастерская — полная база.zip';
function check(response){if(!response.ok)throw Error(response.status===401?'Подключение Google истекло. Подключитесь снова.':'Ошибка Google Drive: '+response.status);return response;}
function auth(token){if(!token)throw Error('Сначала подключите Google Drive');return {Authorization:'Bearer '+token};}
export async function findDriveBackup(token,{fetcher=fetch}={}){const params=new URLSearchParams({q:"trashed = false and appProperties has { key='workshopBackup' and value='full-v1' }",fields:'files(id,name,size,modifiedTime)',orderBy:'modifiedTime desc',pageSize:'1'});const result=await check(await fetcher(API+'?'+params,{headers:auth(token)})).json();return result.files?.[0]||null;}
export async function uploadDriveBackup(blob,token,{fetcher=fetch,onProgress=()=>{}}={}){
 const headers=auth(token),existing=await findDriveBackup(token,{fetcher});
 const started=check(await fetcher(UPLOAD+(existing?'/'+encodeURIComponent(existing.id):'')+'?uploadType=resumable&fields=id,name,size,modifiedTime',{method:existing?'PATCH':'POST',headers:{...headers,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/zip','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({name:NAME,mimeType:'application/zip',appProperties:{workshopBackup:'full-v1'}})}));
 const session=started.headers.get('Location');if(!session)throw Error('Google Drive не вернул адрес загрузки');
 const url=new URL(session);if(url.origin!=='https://www.googleapis.com')throw Error('Некорректный адрес загрузки Google Drive');
 const chunkSize=8*1024*1024;let offset=0;onProgress(0,blob.size);
 while(offset<blob.size){const end=Math.min(offset+chunkSize,blob.size);const response=await fetcher(session,{method:'PUT',headers:{...headers,'Content-Type':'application/zip','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end)});
 if(response.status===308){const range=response.headers.get('Range'),next=range?Number(range.match(/-(\d+)$/)?.[1])+1:0;if(!Number.isSafeInteger(next)||next<=offset||next>end)throw Error('Google Drive не подтвердил передачу части файла');offset=next;onProgress(offset,blob.size);continue;}
 check(response);if(end!==blob.size)throw Error('Google Drive завершил загрузку раньше времени');const file=await response.json();if(!file.id||existing&&file.id!==existing.id)throw Error('Google Drive не подтвердил сохранение файла');onProgress(blob.size,blob.size);return file;
 }
 throw Error('Пустой архив нельзя загрузить');
}
export async function downloadDriveBackup(file,token,{fetcher=fetch}={}){const response=check(await fetcher(API+'/'+encodeURIComponent(file.id)+'?alt=media',{headers:auth(token)}));const blob=await response.blob();if(file.size!==undefined&&blob.size!==Number(file.size))throw Error('Файл из Google Drive загружен не полностью. Повторите загрузку.');return blob;}
