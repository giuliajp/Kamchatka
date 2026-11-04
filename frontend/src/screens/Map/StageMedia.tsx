import { useRef } from 'react';
import { ModalCard } from '@vkontakte/vkui';
import { useRoute } from '../../hooks/useRoute';
import { closeRoute, updateRoute } from '../../api/navigation';
export interface StageMediaViewModel {
  description:string;
  video?:{poster:string;url?:string;title:string};
  photos:{id:string;url:string;caption:string}[];
}
export function StageMedia({media}:{media:StageMediaViewModel}){
 const route=useRoute();const pointer=useRef(0);
 const index=media.photos.findIndex(photo=>photo.id===route.photo);
 const photo=media.photos[index];
 const select=(index:number)=>updateRoute({view:'stage-gallery',photo:media.photos[index].id});
 const close=()=>closeRoute({view:undefined,photo:undefined});
 return <div className="stage-report"><p>{media.description}</p>{media.video && <section><h2>{media.video.title}</h2>{media.video.url ? <video className="stage-video" controls poster={media.video.poster} src={media.video.url} preload="none"/> : <figure className="stage-video-unavailable"><img src={media.video.poster} alt=""/><figcaption>Видео будет доступно после публикации</figcaption></figure>}</section>}
 <section><h2>Фотографии этапа</h2>{media.photos.length ? <><button className="stage-gallery__main" onClick={()=>select(0)} aria-label="Открыть галерею этапа"><img src={media.photos[0].url} alt={media.photos[0].caption}/></button><div className="stage-gallery__grid">{media.photos.slice(1,6).map((photo,index)=><button key={photo.id} onClick={()=>select(index+1)} aria-label={`Открыть фото ${index+2}`}><img src={photo.url} alt=""/></button>)}<button className="text-action" onClick={()=>select(0)}>Все фотографии · {media.photos.length}</button></div></> : <p>Фотографии пока не опубликованы.</p>}</section>
 {route.view==='stage-gallery' && <ModalCard className="stage-gallery-dialog" open onClose={close} dismissButtonMode="inside" dismissLabel="Закрыть галерею" title="Фотографии этапа" aria-label="Галерея этапа" onKeyDown={e=>{if(e.key==='ArrowRight'&&index<media.photos.length-1)select(index+1);if(e.key==='ArrowLeft'&&index>0)select(index-1);}}>{photo ? <><img className="stage-photo" src={photo.url} alt={photo.caption} onPointerDown={e=>{pointer.current=e.clientX;}} onPointerUp={e=>{const distance=e.clientX-pointer.current;if(distance< -50&&index<media.photos.length-1)select(index+1);if(distance>50&&index>0)select(index-1);}}/><p>{photo.caption}</p><div className="content-actions"><button disabled={index<=0} onClick={()=>select(index-1)}>Предыдущее</button><span aria-live="polite">{index+1} / {media.photos.length}</span><button disabled={index>=media.photos.length-1} onClick={()=>select(index+1)}>Следующее</button></div></> : <p>Фотография не найдена.</p>}</ModalCard>}
 </div>;
}
