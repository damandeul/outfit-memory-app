import {describe,it,expect} from 'vitest';
import {matchesGarment,matchesOutfit} from './search';
import type {Garment,Outfit} from './types';
const garment={name:'린넨 셔츠',note:'출근용 유니클로',category:'TOP',color:'BLACK',seasons:['SUMMER']} as Garment;
describe('검색',()=>{
 it('색상 별칭과 계절, 메모를 함께 검색한다',()=>{expect(matchesGarment(garment,'블랙 여름 출근')).toBe(true);expect(matchesGarment(garment,'검정 겨울')).toBe(false)});
 it('초성과 띄어쓰기를 지원한다',()=>{expect(matchesGarment(garment,'ㄹㄴㅅㅊ')).toBe(true);expect(matchesGarment(garment,'린넨셔츠')).toBe(true);expect(matchesGarment(garment,'')).toBe(true)});
 it('사계절 옷을 개별 계절로 찾는다',()=>expect(matchesGarment({...garment,seasons:['ALL']},'겨울')).toBe(true));
 it('기록의 과거 옷 이름과 메모, 날짜를 검색한다',()=>{const outfit={contextName:'목요일 댄스',note:'발표회',localDate:'2026-11-10',items:[{name:'예전 셔츠',category:'TOP',color:'BLACK'}]} as Outfit;expect(matchesOutfit(outfit,'댄스 검정 발표회')).toBe(true);expect(matchesOutfit(outfit,'예전셔츠 2026-11')).toBe(true);expect(matchesOutfit(outfit,'원피스')).toBe(false)});
});
