export type Category='TOP'|'BOTTOM'|'DRESS'|'OUTER'|'SHOES'|'ACCESSORY'; export type Color='BLACK'|'WHITE'|'GRAY'|'BEIGE'|'BROWN'|'NAVY'|'BLUE'|'GREEN'|'RED'|'PINK'|'PURPLE'|'YELLOW'|'ORANGE'|'MULTI'; export type Season='SPRING'|'SUMMER'|'AUTUMN'|'WINTER'|'ALL';
export interface Garment {id:string;name:string;category:Category;color:Color;seasons:Season[];note:string;status:'ACTIVE'|'ARCHIVED';mainMediaId:string|null;photoDataUrl?:string;createdAt:string;updatedAt:string;deletedAt?:string}
export interface Snapshot {garmentId:string;name:string;category:Category;color:Color;photoDataUrl?:string}
export interface Outfit {id:string;localDate:string;contextName:string;contextKey:string;note:string;fullMediaId:string|null;fullPhotoDataUrl?:string;items:Snapshot[];garmentIds:string[];combinationKey:string;status:'DRAFT'|'CONFIRMED';ruleVersion:1;createdAt:string;updatedAt:string;deletedAt?:string}
export interface Recommendation {garmentIds:string[];combinationKey:string;score:number;reasonCodes:string[];lastWorn:Record<string,string|null>}
export interface RecommendInput {contextName:string;targetLocalDate:string;limit:number}
