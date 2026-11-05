import {describe,it,expect} from 'vitest';
import {paperFrame,ROW,strips} from '../src/paper-path';
describe('roll-paper printing path',()=>{
 it('prints avatar, then name, then feeds; the start is an empty sheet',()=>{
  expect(paperFrame(0,1,3000)).toMatchObject({image:0,name:0,feed:0,phase:'preparing'});
  expect(paperFrame(.33,1,3000)).toMatchObject({image:.5,name:0,feed:0,phase:'printing'});
  expect(paperFrame(.69,1,3000).name).toBeCloseTo(.5);
  expect(paperFrame(.69,1,3000).image).toBe(1);
  expect(paperFrame(.93,1,3000).feed).toBeGreaterThan(0);
  expect(paperFrame(1,1,3000)).toMatchObject({image:1,name:1,feed:1});
 });
 it('ties the head position to the exact leading edge of each exposed strip',()=>{
  for(const duration of [3000,2000,1000,1500])for(const count of [1,3])for(let p=.081;p<.579;p+=.003){
   // Use local item time, independent of the group index.
   const f=paperFrame(p/count,count,duration),rects=strips(f.image,f.lines,0,450),last=rects.at(-1)!;
   if(!last)continue;
   expect(f.y).toBeGreaterThanOrEqual(last.y);expect(f.y).toBeLessThanOrEqual(last.y+last.h);
   const edge=f.lines&&Math.floor(f.image*f.lines)%2===0?last.x+last.w:last.x;
   expect(f.x*512).toBeCloseTo(edge,6);
  }
 });
 it('feeds three individual rows in one group without replacing older avatars',()=>{
  const end=paperFrame(1,3,1500);expect((end.item+end.feed)*ROW).toBe(3*ROW);
  expect(paperFrame(1/3-.00001,3,1500).feed).toBeCloseTo(1,5);
  expect(paperFrame(1/3,3,1500)).toMatchObject({item:1,feed:0,image:0});
 });
 it('reduces scan complexity at speed while retaining complete color coverage',()=>{
  expect(paperFrame(.3,1,3000).lines).toBe(32);expect(paperFrame(.3,1,2000).lines).toBe(24);expect(paperFrame(.3,1,1000).lines).toBe(16);expect(paperFrame(.3,3,1500).lines).toBe(8);
  for(const lines of [32,24,16,8])expect(strips(1,lines,0,450)).toEqual([{x:0,y:0,w:512,h:450}]);
 });
});
