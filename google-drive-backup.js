const API='https://www.googleapis.com/drive/v3/files';
const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
const NAME='Мастерская — полная база.zip';
async function check(response,stage='Запрос к Google Drive'){
 if(response.ok)return response;
 let detail;try{detail=(await response.json()).error;}catch{}
 const reason=detail?.errors?.[0]?.reason||detail?.details?.find(item=>item.reason)?.reason||'',message=typeof detail?.message==='string'?detail.message.slice(0,1500):'';
 let hint=response.status===401?'Подключение Google истекло. Подключитесь снова.':'Повторите запрос. Если ошибка остаётся, проверьте подробности ниже.';
 if(['accessNotConfigured','SERVICE_DISABLED'].includes(reason)||/has not been used|is disabled/i.test(message))hint='В проекте Google Cloud не включён Google Drive API. Откройте ссылку «Включить Google Drive API», выберите проект с вашим Client ID и нажмите «Включить». Затем повторите выгрузку.';
 else if(['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(reason))hint='Google не выдал приложению нужный доступ. Нажмите «Отключить Google», подключитесь снова и разрешите доступ к файлам приложения.';
 else if(['insufficientFilePermissions','appNotAuthorizedToFile'].includes(reason))hint='Нет доступа к облачному файлу. Подключите тот Google-аккаунт и Client ID, с которыми файл был создан. У аккаунта должно быть право редактирования. Новый файл автоматически не создаётся.';
 else if(reason==='storageQuotaExceeded')hint='В Google Drive закончилось место. Освободите место в облаке и очистите корзину либо увеличьте объём хранилища.';
 else if(['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded'].includes(reason))hint='Достигнут лимит запросов Google Drive. Подождите и повторите запрос; проверьте квоты проекта в Google Cloud.';
 else if(reason==='domainPolicy')hint='Доступ к Google Drive запрещён правилами организации. Обратитесь к администратору Google Workspace.';
 else if(response.status===403)hint='Google отклонил запрос. Причина указана в ответе ниже. Проверьте, включён ли Google Drive API в проекте вашего Client ID и разрешён ли доступ выбранному аккаунту.';
 const error=new Error(stage+': ошибка Google Drive '+response.status+'. '+hint+(reason?' Код: '+reason+'.':'')+(message?' Ответ Google: '+message:''));error.status=response.status;error.driveReason=reason;
 const activation=detail?.details?.find(item=>item.metadata?.activationUrl)?.metadata.activationUrl;
 try{const url=new URL(activation);if(url.protocol==='https:'&&['console.cloud.google.com','console.developers.google.com'].includes(url.hostname))error.driveActivationUrl=url.href;}catch{}
 throw error;
}
function auth(token){if(!token)throw Error('Сначала подключите Google Drive');return {Authorization:'Bearer '+token};}
export async function findDriveBackup(token,{fetcher=fetch,fileId=''}={}){if(fileId){const response=await fetcher(API+'/'+encodeURIComponent(fileId)+'?fields=id,name,size,modifiedTime,trashed,appProperties',{headers:auth(token)});if(response.status===404)throw Error('Привязанный файл Google Drive не найден. Восстановите его из корзины или проверьте Google-аккаунт. Новый файл автоматически не создаётся.');const file=await (await check(response,'Проверка облачного файла')).json();if(file.trashed||file.appProperties?.workshopBackup!=='full-v1')throw Error('Привязанный файл не является полной базой «Мастерской»');return file;}const params=new URLSearchParams({q:"trashed = false and appProperties has { key='workshopBackup' and value='full-v1' }",fields:'files(id,name,size,modifiedTime)',orderBy:'modifiedTime desc',pageSize:'1'});const result=await (await check(await fetcher(API+'?'+params,{headers:auth(token)}),'Поиск облачного файла')).json();return result.files?.[0]||null;}
export async function uploadDriveBackup(blob,token,{fetcher=fetch,onProgress=()=>{},fileId=''}={}){
 const headers=auth(token),existing=await findDriveBackup(token,{fetcher,fileId});
 const started=await check(await fetcher(UPLOAD+(existing?'/'+encodeURIComponent(existing.id):'')+'?uploadType=resumable&fields=id,name,size,modifiedTime',{method:existing?'PATCH':'POST',headers:{...headers,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/zip','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({name:NAME,mimeType:'application/zip',appProperties:{workshopBackup:'full-v1'}})}),'Начало выгрузки');
 const session=started.headers.get('Location');if(!session)throw Error('Google Drive не вернул адрес загрузки');
 const url=new URL(session);if(url.origin!=='https://www.googleapis.com')throw Error('Некорректный адрес загрузки Google Drive');
 const chunkSize=8*1024*1024;let offset=0;onProgress(0,blob.size);
 while(offset<blob.size){const end=Math.min(offset+chunkSize,blob.size);const response=await fetcher(session,{method:'PUT',headers:{...headers,'Content-Type':'application/zip','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end)});
 if(response.status===308){const range=response.headers.get('Range'),next=range?Number(range.match(/-(\d+)$/)?.[1])+1:0;if(!Number.isSafeInteger(next)||next<=offset||next>end)throw Error('Google Drive не подтвердил передачу части файла');offset=next;onProgress(offset,blob.size);continue;}
 await check(response,'Передача архива');if(end!==blob.size)throw Error('Google Drive завершил загрузку раньше времени');const file=await response.json();if(!file.id||existing&&file.id!==existing.id)throw Error('Google Drive не подтвердил сохранение файла');onProgress(blob.size,blob.size);return file;
 }
 throw Error('Пустой архив нельзя загрузить');
}
export async function downloadDriveBackup(file,token,{fetcher=fetch}={}){const response=await check(await fetcher(API+'/'+encodeURIComponent(file.id)+'?alt=media',{headers:auth(token)}),'Скачивание архива');const blob=await response.blob();if(file.size!==undefined&&blob.size!==Number(file.size))throw Error('Файл из Google Drive загружен не полностью. Повторите загрузку.');return blob;}

// Cloud exchange excludes the device's print queue, including its archive.
function queueAdditionIds(database){return new Set((database.printQueue||[]).flatMap(job=>(job.batches||[]).map(batch=>batch.additionId).filter(Boolean)));}
export function databaseForCloud(database){const snapshot=stripBackupSecrets(database),ids=queueAdditionIds(database);delete snapshot.printQueue;delete snapshot.filamentStock;if(snapshot.stockAdditions)snapshot.stockAdditions=snapshot.stockAdditions.filter(record=>!ids.has(record.id));return snapshot;}
export function preserveLocalPrintQueue(incoming,local){const database=databaseForCloud(incoming);for(const product of database.products||[]){const current=local.products?.find(row=>row.id===product.id)||local.products?.find(row=>product.sku?.trim()&&row.sku?.trim()===product.sku.trim());if(!current)continue;for(const market of ['wb','ozon']){const rule=current.stockTargets?.[market];if(!rule){if(product.stockTargets)delete product.stockTargets[market];continue;}product.stockTargets??={};product.stockTargets[market]??={minimum:null,normal:null};for(const key of ['minimum','normal'])if(rule[key]!==0&&rule[key]!==undefined)product.stockTargets[market][key]=rule[key];}}database.filamentStock=structuredClone(local.filamentStock||[]);database.printQueue=structuredClone(local.printQueue||[]);const ids=queueAdditionIds(local),records=(local.stockAdditions||[]).filter(record=>ids.has(record.id));if(records.length)database.stockAdditions=[...(database.stockAdditions||[]).filter(record=>!ids.has(record.id)),...structuredClone(records)];return database;}

const secretKey=key=>/^(?:.*token|.*secret|wbtoken|ozonkey|apikey|apikeys|credentials|apicredentials|authorization|password)$/i.test(key.replace(/[-_ ]/g,''));
export function stripBackupSecrets(value){if(Array.isArray(value))return value.map(stripBackupSecrets);if(value&&typeof value==='object'){const result={};for(const [key,item]of Object.entries(value))if(!secretKey(key))result[key]=stripBackupSecrets(item);return result;}return value;}
