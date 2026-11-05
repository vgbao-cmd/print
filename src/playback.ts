import type {Snapshot} from './shared';
export class PlaybackClock {
 private value:number;private real:number;stopped:boolean;
 constructor(private wall:()=>number=Date.now,initial?:number,stopped=false){this.real=wall();this.value=initial??this.real;this.stopped=stopped;}
 now(){return this.value+(this.stopped?0:this.wall()-this.real);}
 stop(){this.value=this.now();this.real=this.wall();this.stopped=true;return this.value;}
 resume(){this.real=this.wall();this.stopped=false;}
 reset(){this.value=this.wall();this.real=this.value;this.stopped=false;}
}
export function playbackNow(state:Pick<Snapshot,'clock'|'sentAt'|'stopped'>,wall=Date.now()){return (state.clock??wall)+(state.stopped?0:Math.max(0,wall-(state.sentAt??wall)));}
