import {normalize} from './domain';
import type {Garment, Outfit} from './types';
const labels: Record<string,string> = {
 TOP:'상의 티셔츠 셔츠 탑', BOTTOM:'하의 바지 스커트 치마', DRESS:'원피스 드레스', OUTER:'아우터 외투 자켓 재킷 코트', SHOES:'신발 슈즈', ACCESSORY:'액세서리 악세서리',
 BLACK:'검정 검은 검정색 블랙', WHITE:'흰색 흰 하양 화이트', GRAY:'회색 그레이', BEIGE:'베이지', BROWN:'갈색 브라운', NAVY:'네이비 남색', BLUE:'파랑 파란 파란색 블루', GREEN:'초록 녹색 그린', RED:'빨강 빨간 빨간색 레드', PINK:'분홍 핑크', PURPLE:'보라 퍼플', YELLOW:'노랑 노란 옐로', ORANGE:'주황 오렌지', MULTI:'다색 멀티',
 SPRING:'봄', SUMMER:'여름', AUTUMN:'가을', WINTER:'겨울', ALL:'사계절 봄 여름 가을 겨울',
};
const initials=(s:string)=>Array.from(s).map(c=>{const n=c.charCodeAt(0)-0xac00;return n>=0&&n<11172?'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(n/588)]:c}).join('');
const compact=(s:string)=>normalize(s).replace(/\s/g,'');
function matches(fields:string[], query:string) {
 const haystack=compact(fields.join(' '));
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>{
  const term=compact(token);
  return haystack.includes(term)||(/^[ㄱ-ㅎ]+$/.test(term)&&initials(haystack).includes(term));
 });
}
const label=(value:string)=>value+' '+(labels[value]??'');
export const matchesGarment=(g:Garment,q:string)=>matches([g.name,g.note,label(g.category),label(g.color),...g.seasons.map(label)],q);
export const matchesOutfit=(o:Outfit,q:string)=>matches([o.contextName,o.note,o.localDate,...o.items.flatMap(i=>[i.name,label(i.category),label(i.color)])],q);
