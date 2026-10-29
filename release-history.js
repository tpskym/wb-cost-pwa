// Add a release here whenever the application version changes. Keep older entries unchanged.
export const releases=[
 ['0.2.159',['Кнопка «История» рядом с версией приложения.','Уведомление об обновлении со ссылкой на изменения.']],
 ['0.2.158',['Промпт для этикеток всей группы: отдельные PDF 58 × 40 мм в ZIP.']],
 ['0.2.157',['Все цвета этикетки выводятся по порядку через дефис с сохранением повторений.']],
 ['0.2.156',['Одинаковые шрифт, высота и отступы кнопок в блоке этикетки.']],
 ['0.2.155',['Промпт для этикетки 58 × 40 мм по образцу с данными текущего товара и русскими названиями цветов.']],
 ['0.2.154',['Очистка сохранённых расчётов выбранного товара с подтверждением и резервной копией.']],
 ['0.2.153',['Цветные образцы в списке выбора катушек, отметка выбранной катушки.']],
 ['0.2.152',['Цвет выбранной катушки рядом с каждым полем материала.']],
 ['0.2.151',['Три поля цвета материала с выбором катушек из остатков филамента.']],
 ['0.2.150',['Минимум филамента, количество для закупки и постоянно видимый список «Нужно докупить».']],
 ['0.2.149',['Разделены расчёт пополнения и кнопка добавления новых деталей на склад.']],
 ['0.2.148',['Окно добавления деталей закрывается после успешного пополнения склада.']],
 ['0.2.147',['Изображения товаров в ценах и расчёт цены WB со скидкой прямо при вводе.']]
];
const SEEN='workshop-release-seen';
export function mountReleaseHistory({root,button,version,storage=localStorage}){
 if(!root||!button)return;
 let seen;try{seen=storage.getItem(SEEN);}catch{}
 const acknowledge=()=>{try{storage.setItem(SEEN,version);}catch{}root.querySelector('.release-update-notice')?.remove();};
 const open=()=>{
  document.querySelector('.release-history-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.className='release-history-dialog';dialog.setAttribute('aria-label','История изменений');
  const head=document.createElement('div');head.className='modal-head';const title=document.createElement('h2');title.textContent='История изменений';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть историю');head.append(title,close);dialog.append(head);
  for(const [number,changes] of releases){const section=document.createElement('section'),h=document.createElement('h3'),list=document.createElement('ul');h.textContent='v'+number+(number===version?' · текущая версия':'');for(const change of changes){const li=document.createElement('li');li.textContent=change;list.append(li);}section.append(h,list);dialog.append(section);}
  const note=document.createElement('p');note.textContent='Подробная история ведётся с версии 0.2.147.';dialog.append(note);
  close.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();button.focus({preventScroll:true});};document.body.append(dialog);dialog.showModal();acknowledge();
 };
 button.onclick=open;
 if(seen!==version){const notice=document.createElement('div');notice.className='release-update-notice';notice.setAttribute('role','status');const text=document.createElement('span');text.textContent=`Приложение обновлено до v${version}. Можно посмотреть, что изменилось.`;const view=document.createElement('button');view.type='button';view.textContent='Посмотреть изменения';view.onclick=open;const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','Скрыть уведомление об обновлении');dismiss.onclick=acknowledge;notice.append(text,view,dismiss);root.prepend(notice);}
}
