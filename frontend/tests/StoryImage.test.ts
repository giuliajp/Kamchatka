import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createStoryImages,wrapStoryText,raceStoryHeading} from '../src/api/storyImage';
const card={heading:'Авача · 2026',title:'Алиса Иванова',lines:['Нарта, 8 собак','Итоговое время за гонку: —','Место в дисциплине: —','Не выводить'],action:'Открыть участника'};
const ctx={fillStyle:'',font:'',textAlign:'',textBaseline:'',fillRect:vi.fn(),drawImage:vi.fn(),fillText:vi.fn(),beginPath:vi.fn(),roundRect:vi.fn(),fill:vi.fn(),measureText:vi.fn((text:string)=>({width:Array.from(text).length*20}))};
let decode=vi.fn().mockResolvedValue(undefined);const load=vi.fn().mockResolvedValue([]);
beforeEach(()=>{
 vi.clearAllMocks();decode=vi.fn().mockResolvedValue(undefined);load.mockResolvedValue([]);
 vi.stubGlobal('Image',class{src='';naturalWidth=1080;naturalHeight=1920;decode(){return decode(this.src);}});
 Object.defineProperty(document,'fonts',{configurable:true,value:{load}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(function(this:HTMLCanvasElement){return `data:image/png;base64,${this.width}x${this.height}`;});
});
afterEach(()=>{vi.unstubAllGlobals();Reflect.deleteProperty(document,'fonts');});
it('wraps Russian words, splits long tokens and bounds lines with an ellipsis',()=>{
 const measure=(value:string)=>Array.from(value).length;
 expect(wrapStoryText(' Алиса Иванова ',measure,14,2)).toEqual(['Алиса Иванова']);
 expect(wrapStoryText('Алиса Иванова',measure,7,2)).toEqual(['Алиса','Иванова']);
 expect(wrapStoryText('Оченьдлинноеслово',measure,5,2)).toEqual(['Очень','длин…']);
 expect(wrapStoryText('',measure,7,2)).toEqual([]);
 expect(wrapStoryText('abc def',()=>100,1,1)).toEqual(['…']);
});
it('renders the actual card data and exports two correctly sized PNGs using only local assets',async()=>{
 const result=await createStoryImages(card);expect(result).toEqual({background:'data:image/png;base64,1080x1920',sticker:'data:image/png;base64,720x128'});
 expect(decode.mock.calls.map(([url])=>url)).toEqual(['/figma/map-screen/b5483.png','/figma/map-screen/5b9db.svg']);expect(ctx.drawImage).toHaveBeenCalledTimes(2);
 const text=ctx.fillText.mock.calls.map(([value])=>value).join(' ');expect(text).toContain('Алиса Иванова');expect(text).toContain('Итоговое время за гонку: —');expect(text).not.toContain('Не выводить');expect(text).toContain('Открыть участника');
});
it('falls back to a solid background, text logo and system font when optional resources fail',async()=>{
 decode.mockRejectedValue(new Error('image unavailable'));load.mockRejectedValue(new Error('font unavailable'));await createStoryImages(card);expect(ctx.drawImage).not.toHaveBeenCalled();expect(ctx.fillRect).toHaveBeenCalledWith(0,0,1080,1920);expect(ctx.fillText).toHaveBeenCalledWith('Берингия · Авача',72,240);expect(ctx.font).toContain('system-ui');
});
it('reports unavailable Canvas instead of returning an empty image',async()=>{
 vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);await expect(createStoryImages(card)).rejects.toThrow('Не удалось подготовить изображение');
});

it('includes the season once even when the API race name already contains its year',()=>{
 expect(raceStoryHeading('Авача',2026)).toBe('Авача · 2026');expect(raceStoryHeading('Гонка Авача 2026',2026)).toBe('Гонка Авача 2026');
});
