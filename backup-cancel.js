// Stop preparation and transfers, but never interrupt an active database commit.
export function waitForBackupTask(task,signal){
 if(!signal)return task;
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason);
  if(signal.aborted){Promise.resolve(task).catch(()=>{});abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(task).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
export async function backupCheckpoint(signal){
 signal?.throwIfAborted();
 await new Promise(resolve=>setTimeout(resolve,0));
 signal?.throwIfAborted();
}
