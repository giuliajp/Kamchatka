import {act,screen} from '@testing-library/react';
import type {Root} from 'react-dom/client';
import {expect,it} from 'vitest';
it('mounts the organizer login in the browser root',async()=>{
 const element=document.createElement('div');element.id='root';document.body.append(element);let root:Root;
 await act(async()=>{root=(await import('../src/main')).appRoot;});expect(screen.getByRole('heading',{name:'Вход организатора'})).toBeVisible();act(()=>root.unmount());element.remove();
},15000);
