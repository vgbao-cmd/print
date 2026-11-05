import type {Tier} from './shared';
// Original procedural motifs: no recordings, samples or third-party melodies.
export const THEMES:Record<Tier,{notes:number[];tempo:number;wave:'sine'|'triangle'}>={
 classic:{notes:[0],tempo:.3,wave:'sine'},glow:{notes:[12,16,19,24],tempo:.19,wave:'sine'},
 bloom:{notes:[0,7,12,16,12,7],tempo:.38,wave:'sine'},love:{notes:[0,4,7,12,7,4,9,7],tempo:.19,wave:'sine'},
 royal:{notes:[0,0,7,12,16,19,12,7],tempo:.28,wave:'triangle'},rainbow:{notes:[0,7,12,19,16,12,7,14],tempo:.19,wave:'sine'},
 legendary:{notes:[-12,-5,0,3,7,10,7,3],tempo:.32,wave:'triangle'},fame:{notes:[0,4,7,12,16,19,24,19,16,12,7,12],tempo:.19,wave:'sine'}
};
