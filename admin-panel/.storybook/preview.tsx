import {useLayoutEffect} from 'react';
import type {Preview} from '@storybook/react-vite';
import stylesheet from '../src/style.css?raw';
function CanvasEnvironment({scale,appearance}:{scale:number;appearance:string}) {
  useLayoutEffect(()=>{const root=document.documentElement;const previous=root.style.fontSize;root.style.fontSize=`${16*scale}px`;return()=>{root.style.fontSize=previous;};},[scale]);
  // Exercise the application's light/dark rules without changing the user's OS theme.
  return <style>{stylesheet.replaceAll(':root[data-theme=dark]',appearance==='dark'?':root':':root[data-theme=storybook-disabled]')}</style>;
}
const preview:Preview={
  tags:['autodocs'],
  globalTypes:{
    textScale:{toolbar:{title:'Текст',icon:'paragraph',items:[{value:1,title:'100%'},{value:2,title:'200%'}]}},
    appearance:{toolbar:{title:'Тема',icon:'paintbrush',items:[{value:'light',title:'Светлая'},{value:'dark',title:'Тёмная'}]}},
  },
  initialGlobals:{textScale:1,appearance:'light'},
  decorators:[(Story,{globals})=><><CanvasEnvironment scale={Number(globals.textScale)} appearance={globals.appearance}/><Story/></>],
  parameters:{layout:'fullscreen',a11y:{test:'error'},viewport:{options:{tablet:{name:'768 px',styles:{width:'768px',height:'1024px'},type:'tablet'},desktop:{name:'1280 px',styles:{width:'1280px',height:'900px'},type:'desktop'},wide:{name:'1920 px',styles:{width:'1920px',height:'1552px'},type:'desktop'}}}},
};
export default preview;
