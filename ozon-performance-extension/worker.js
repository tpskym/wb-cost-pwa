const ozonHost='https://api-performance.ozon.ru';
const idPattern=/^\d{1,20}$/;
const uuidPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const reportLimit=16*1024*1024;
const validSecret=value=>typeof value==='string'&&value.length>0&&value.length<=2048&&!/\s/.test(value);

function route(message){
 const {operation,body={},token}=message;
 if(operation==='token'){
  if(!validSecret(body.id)||!validSecret(body.secret))return null;
  return ['/api/client/token',{method:'POST',body:JSON.stringify({
   client_id:body.id,client_secret:body.secret,grant_type:'client_credentials'
  })}];
 }
 if(!validSecret(token))return null;
 switch(operation){
 case 'campaigns':
  if(!Number.isSafeInteger(body.page)||body.page<1)return null;
  return ['/api/client/campaign?advObjectType=SKU&pageSize=100&page='+body.page];
 case 'submit': {
  const {campaigns,dateFrom,dateTo}=body;
  if(!Array.isArray(campaigns)||!campaigns.length||campaigns.length>10||
   campaigns.some(id=>typeof id!=='string'||!idPattern.test(id))||
   !datePattern.test(dateFrom)||!datePattern.test(dateTo)||dateFrom>dateTo)return null;
  return ['/api/client/statistics',{method:'POST',body:JSON.stringify({campaigns,dateFrom,dateTo,groupBy:'DATE'})}];
 }
 case 'status':
  return uuidPattern.test(body.uuid)?['/api/client/statistics/'+body.uuid]:null;
 case 'report':
  return uuidPattern.test(body.uuid)?['/api/client/statistics/report?UUID='+body.uuid]:null;
 default:
  return null;
 }
}

async function reportBody(response){
 const reader=response.body.getReader(),chunks=[];
 let length=0;
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  length+=value.length;
  if(length>reportLimit){
   await reader.cancel();
   throw Error('Отчёт слишком большой. Выберите более короткий период.');
  }
  for(let i=0;i<value.length;i+=8192)chunks.push(String.fromCharCode(...value.subarray(i,i+8192)));
 }
 return btoa(chunks.join(''));
}

export async function handleOzonPerformance(message,sender,request=fetch){
 const senderUrl=URL.canParse(sender.url)?new URL(sender.url):null;
 if(sender.frameId!==0||senderUrl?.origin!=='https://tpskym.github.io'||
  !senderUrl.pathname.startsWith('/wb-cost-pwa/')||message?.type!=='workshop-ozon-performance')return;
 if(message.operation==='ping')return {ok:true,data:{version:1}};
 const target=route(message);
 if(!target)return {ok:false,error:'Неизвестный запрос к Ozon Performance API.'};
 const [path,options={}]=target;
 let response;
 try{
  response=await request(ozonHost+path,{
   ...options,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000),
   headers:{
    ...(options.body?{'Content-Type':'application/json'}:{}),
    ...(message.operation!=='token'?{Authorization:'Bearer '+message.token}:{})
   }
  });
 }catch{
  return {ok:false,error:'Ozon Performance API не ответил. Повторите загрузку.'};
 }
 if(!response.ok){await response.body?.cancel();return {ok:false,status:response.status};}
 try{
  const data=message.operation==='report'?await reportBody(response):await response.json();
  return {ok:true,data};
 }catch(error){
  return {ok:false,error:message.operation==='report'&&error.message.startsWith('Отчёт слишком большой')?
   error.message:'Не удалось прочитать ответ Ozon Performance API.'};
 }
}

globalThis.chrome?.runtime?.onMessageExternal.addListener((message,sender,respond)=>{
 handleOzonPerformance(message,sender).then(
  result=>respond(result),
  ()=>respond({ok:false,error:'Расширение не смогло выполнить запрос к Ozon.'})
 );
 return true;
});
