/* Courtside Brackets: tournament engine.
   Pure functions, no DOM. Loaded as a classic script in the browser (functions become globals)
   and as a CommonJS module in Node for the tests. */
function nextPow2(n){let p=1;while(p<n)p*=2;return p}
function seedOrder(size){let o=[1,2];while(o.length<size){const n=o.length*2,nx=[];for(const s of o)nx.push(s,n+1-s);o=nx}return o}
function num(v){if(v===''||v==null)return null;const x=Number(v);return isNaN(x)?null:x}
function buildElim(ids,dbl,second){
  const n=ids.length,size=Math.max(2,nextPow2(n)),k=Math.log2(size),order=seedOrder(size),ms=[];
  const E=s=>s<=n?{t:'e',id:ids[s-1]}:{t:'b'};
  for(let i=0;i<size/2;i++)ms.push({id:'W1-'+(i+1),br:'W',r:1,a:E(order[2*i]),b:E(order[2*i+1])});
  for(let r=2;r<=k;r++)for(let j=1;j<=size/Math.pow(2,r);j++)ms.push({id:'W'+r+'-'+j,br:'W',r,a:{t:'w',m:'W'+(r-1)+'-'+(2*j-1)},b:{t:'w',m:'W'+(r-1)+'-'+(2*j)}});
  if(second&&!dbl){
    /* Second chance: each team without a round-1 game plays the loser of a real round-1 match; the winner takes the bye team's place in round 2. */
    const w1=ms.filter(m=>m.br==='W'&&m.r===1),isBye=m=>m.a.t==='b'||m.b.t==='b';
    const idx=m=>w1.indexOf(m),pod=m=>Math.floor(idx(m)/2);
    const byes=w1.filter(isBye),real=w1.filter(m=>!isBye(m));
    const seedOf=m=>{const s=m.a.t==='e'?m.a.id:m.b.id;return ids.indexOf(s)};
    byes.sort((x,y)=>seedOf(y)-seedOf(x));
    const used=new Set(),plays=[];
    for(const B of byes){
      const free=real.filter(r=>!used.has(r.id));if(!free.length)break;
      let pick=free.filter(r=>pod(r)!==pod(B));if(!pick.length)pick=free;
      pick=shuffle(pick);
      pick.sort((x,y)=>Math.abs(pod(y)-pod(B))-Math.abs(pod(x)-pod(B)));
      const R=pick[0];used.add(R.id);
      const P={id:'P'+(plays.length+1),br:'W',r:1.5,a:{t:'w',m:B.id},b:{t:'l',m:R.id}};
      plays.push(P);
      ms.forEach(m=>{if(m.r===2&&m.br==='W'){if(m.a.t==='w'&&m.a.m===B.id)m.a={t:'w',m:P.id};if(m.b.t==='w'&&m.b.m===B.id)m.b={t:'w',m:P.id}}});
    }
    const at=ms.findIndex(m=>m.r>=2);ms.splice(at<0?ms.length:at,0,...plays);
  }
  if(dbl){
    let lr=1;
    if(k>=2){
      /* Pair real round-1 losers with each other first. A match against a bye produces no loser, so any
         unavoidable bye in the losers bracket lands on a round-1 loser, never on a team that already had a main-bracket bye. */
      const w1=ms.filter(m=>m.br==='W'&&m.r===1),isBye=m=>m.a.t==='b'||m.b.t==='b';
      const ord=w1.filter(m=>!isBye(m)).concat(w1.filter(isBye));
      for(let j=1;j<=size/4;j++)ms.push({id:'L1-'+j,br:'L',r:1,a:{t:'l',m:ord[2*j-2].id},b:{t:'l',m:ord[2*j-1].id}});
      for(let d=2;d<=k;d++){
        lr++;let cnt=size/Math.pow(2,d);
        for(let j=1;j<=cnt;j++)ms.push({id:'L'+lr+'-'+j,br:'L',r:lr,a:{t:'w',m:'L'+(lr-1)+'-'+j},b:{t:'l',m:'W'+d+'-'+j}});
        if(d<k){lr++;cnt=size/Math.pow(2,d+1);
          for(let j=1;j<=cnt;j++)ms.push({id:'L'+lr+'-'+j,br:'L',r:lr,a:{t:'w',m:'L'+(lr-1)+'-'+(2*j-1)},b:{t:'w',m:'L'+(lr-1)+'-'+(2*j)}});}
      }
    }
    if(dbl){
    ms.push({id:'GF',br:'F',r:1,a:{t:'w',m:'W'+k+'-1'},b:k>=2?{t:'w',m:'L'+lr+'-1'}:{t:'l',m:'W1-1'}});
    ms.push({id:'GR',br:'F',r:2,cond:true,a:{t:'x',m:'GF',s:'a'},b:{t:'x',m:'GF',s:'b'}});
    }
  }
  ms.forEach((m,i)=>m.n=i+1);return ms;
}
/* Fewest-byes single elimination.
   A classic bracket pads to a power of two, so 9 teams would need 7 byes. Here every round pairs as many
   teams as it can and only an odd count produces a bye: at most one per round, never for a team that has
   already had one, and drawn at random instead of going to the top seeds. 13 teams need 2 byes, not 3. */
function fairByes(n){let c=n,b=0;while(c>1){if(c%2)b++;c=Math.ceil(c/2)}return b}
function buildFair(ids,second){
  const n=ids.length,ms=[],size=Math.max(2,nextPow2(n));
  let cur=seedOrder(size).filter(s=>s<=n).map(s=>({ref:{t:'e',id:ids[s-1]},had:false})),r=0;
  while(cur.length>1){
    r++;let byeAt=-1;
    if(cur.length%2){
      let pool=cur.map((x,i)=>i).filter(i=>!cur[i].had);
      if(!pool.length)pool=cur.map((x,i)=>i);
      byeAt=pool[Math.floor(Math.random()*pool.length)];
    }
    const rest=cur.filter((x,i)=>i!==byeAt),items=[];
    for(let k=0;k<rest.length;k+=2)items.push({m:{br:'W',r,a:rest[k].ref,b:rest[k+1].ref},had:rest[k].had||rest[k+1].had});
    if(byeAt>=0)items.splice(Math.min(Math.floor(byeAt/2),items.length),0,{m:{br:'W',r,a:cur[byeAt].ref,b:{t:'b'}},had:true});
    items.forEach((it,k)=>{it.m.id='W'+r+'-'+(k+1);ms.push(it.m)});
    cur=items.map(it=>({ref:{t:'w',m:it.m.id},had:it.had}));
  }
  if(second){
    /* Second chance: a team that would get a bye plays the loser of a real match from the same round instead.
       The winner takes the bye team's place in the next round, so nobody gets a free pass. */
    const byes=ms.filter(m=>m.b.t==='b'),plays=[];
    for(const B of byes){
      const real=ms.filter(m=>m.r===B.r&&m.b.t!=='b'&&m.a.t!=='b');if(!real.length)continue;
      const R=real[Math.floor(Math.random()*real.length)];
      const P={id:'P'+(plays.length+1),br:'W',r:B.r+0.5,a:B.a,b:{t:'l',m:R.id}};
      plays.push(P);
      ms.forEach(m=>{if(m.a.t==='w'&&m.a.m===B.id)m.a={t:'w',m:P.id};if(m.b.t==='w'&&m.b.m===B.id)m.b={t:'w',m:P.id}});
      ms.splice(ms.indexOf(B),1);
    }
    ms.push(...plays);ms.sort((x,y)=>x.r-y.r);
  }
  ms.forEach((m,i)=>m.n=i+1);return ms;
}
function buildRR(ids){
  const arr=ids.slice();if(arr.length%2)arr.push(null);
  const n=arr.length,fixed=arr[0],rot=arr.slice(1),ms=[];
  for(let r=0;r<n-1;r++){
    const line=[fixed].concat(rot);let k=1;
    for(let i=0;i<n/2;i++){const a=line[i],b=line[n-1-i];if(a==null||b==null)continue;ms.push({id:'R'+(r+1)+'-'+k,br:'R',r:r+1,a:{t:'e',id:a},b:{t:'e',id:b}});k++}
    rot.unshift(rot.pop());
  }
  ms.forEach((m,i)=>m.n=i+1);return ms;
}
function compute(t){
  const byId={},memo={};t.matches.forEach(m=>byId[m.id]=m);
  function ent(s){
    if(!s)return undefined;
    if(s.t==='e')return s.id==null?'bye':s.id;
    if(s.t==='b')return 'bye';
    const r=res(byId[s.m]);
    if(s.t==='w')return r.w;
    if(s.t==='l')return r.l;
    if(s.t==='x')return s.s==='a'?r.a:r.b;
  }
  function res(m){
    if(memo[m.id])return memo[m.id];
    const o={id:m.id};memo[m.id]=o;
    const a=ent(m.a),b=ent(m.b);o.a=a;o.b=b;
    if(m.cond){const g=res(byId.GF);if(g.w===undefined){o.pending=true;return o}if(g.w===g.a){o.skip=true;return o}}
    if(a==='bye'||b==='bye'){
      o.w=a==='bye'?b:a;o.l='bye';if(a==='bye'&&b==='bye')o.w='bye';
      if(a!==undefined&&b!==undefined)o.auto=true;
      return o;
    }
    if(a&&b){
      const r=t.results[m.id];o.sa=null;o.sb=null;
      if(r&&r.sig===a+'|'+b){
        const sa=num(r.sa),sb=num(r.sb);o.sa=sa;o.sb=sb;let w=null;
        if(sa!=null&&sb!=null&&sa!==sb)w=sa>sb?'a':'b';
        else if(r.mw)w=r.mw;
        else if(sa!=null&&sb!=null)o.draw=true;
        if(w){o.w=w==='a'?a:b;o.l=w==='a'?b:a;o.side=w}
      }
    }
    return o;
  }
  t.matches.forEach(res);return memo;
}
function champion(t,comp){
  if(t.format==='single'){const f=t.matches.filter(m=>m.br==='W').pop();const r=comp[f.id];return r&&r.w&&r.w!=='bye'?r.w:null}
  if(t.format==='double'){
    const g=comp.GF,r=comp.GR;if(!g||g.w===undefined)return null;
    if(g.w===g.a)return g.w;
    return r&&!r.skip&&!r.pending&&r.w?r.w:null;
  }
  return null;
}
function standings(t,comp){
  const row={};t.entrants.forEach((e,i)=>row[e.id]={id:e.id,seed:i,p:0,w:0,d:0,l:0,pf:0,pa:0,opp:[]});
  t.matches.forEach(m=>{
    const r=comp[m.id];if(!r||r.skip)return;const a=r.a,b=r.b;
    if(a==='bye'||b==='bye'){const tm=a==='bye'?b:a;if(tm&&tm!=='bye'){row[tm].w++;row[tm].p+=1}return}
    if(!a||!b)return;
    if(r.w){row[r.w].w++;row[r.w].p+=1;row[r.l].l++}
    else if(r.draw){row[a].d++;row[b].d++;row[a].p+=.5;row[b].p+=.5}
    else return;
    if(r.sa!=null&&r.sb!=null){row[a].pf+=r.sa;row[a].pa+=r.sb;row[b].pf+=r.sb;row[b].pa+=r.sa}
    row[a].opp.push(b);row[b].opp.push(a);
  });
  const rows=Object.values(row);
  rows.forEach(r=>{r.bh=r.opp.reduce((s,o)=>s+row[o].p,0);r.diff=r.pf-r.pa});
  rows.sort((x,y)=>y.p-x.p||y.bh-x.bh||y.diff-x.diff||y.pf-x.pf||x.seed-y.seed);
  return rows;
}
function pairUp(list,played){
  if(!list.length)return [];
  const x=list[0],rest=list.slice(1);
  for(let i=0;i<rest.length;i++){
    const y=rest[i];if(played.has(x+'|'+y))continue;
    const sub=pairUp(rest.filter((_,j)=>j!==i),played);
    if(sub)return [[x,y]].concat(sub);
  }
  return null;
}
function swissNext(t){
  const comp=compute(t),st=standings(t,comp),played=new Set(),hadBye=new Set();
  t.matches.forEach(m=>{const r=comp[m.id];if(!r)return;
    if(r.a==='bye'||r.b==='bye'){const tm=r.a==='bye'?r.b:r.a;if(tm&&tm!=='bye')hadBye.add(tm)}
    else if(r.a&&r.b){played.add(r.a+'|'+r.b);played.add(r.b+'|'+r.a)}});
  let order=st.map(x=>x.id);const round=t.round+1;let byeId=null;
  if(order.length%2){
    for(let i=order.length-1;i>=0;i--)if(!hadBye.has(order[i])){byeId=order[i];break}
    if(byeId==null)byeId=order[order.length-1];
    order=order.filter(x=>x!==byeId);
  }
  let pairs;
  if(round===1){const h=order.length/2;pairs=order.slice(0,h).map((x,i)=>[x,order[h+i]])}
  else pairs=pairUp(order,played)||pairUp(order,new Set());
  const ms=pairs.map((p,i)=>({id:'S'+round+'-'+(i+1),br:'S',r:round,a:{t:'e',id:p[0]},b:{t:'e',id:p[1]}}));
  if(byeId!=null)ms.push({id:'S'+round+'-'+(pairs.length+1),br:'S',r:round,a:{t:'e',id:byeId},b:{t:'b'}});
  let n=t.matches.length;ms.forEach(m=>m.n=++n);
  return ms;
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function allComp(t){const c=compute(t);if(t.po)Object.assign(c,compute({matches:t.po.matches,results:t.results}));return c}
function stageDone(t,comp){
  return t.matches.length>0&&t.matches.every(m=>{const r=comp[m.id];return r.w||r.auto||r.draw})&&(t.format==='rr'||t.round>=t.swissRounds);
}
function syncPlayoff(t){
  if(!(t.qual>=2)||(t.format!=='rr'&&t.format!=='swiss'))return;
  const comp=compute(t);
  if(!stageDone(t,comp)){t.po=null;return}
  const top=standings(t,comp).slice(0,t.qual).map(r=>r.id);
  if(t.po&&t.po.ids.join()===top.join())return;
  const ms=buildElim(top,false,!!t.second),base=t.matches.length;
  ms.forEach(m=>m.n+=base);
  t.po={ids:top,matches:ms};
}
function stats(t,comp,pc){
  const el=t.format==='single'||t.format==='double';
  let mp=0,mt=0,pp=0,pt=0;
  const scan=(ms,c,elim,add)=>ms.forEach(m=>{const r=c[m.id];if(!r||r.skip||(m.cond&&r.pending)||r.auto||r.w==='bye')return;add.t++;if(r.w||(!elim&&r.draw))add.p++});
  const a={p:0,t:0},b={p:0,t:0};
  scan(t.matches,comp,el,a);if(t.po)scan(t.po.matches,pc,true,b);
  if(t.format==='swiss')a.t=Math.max(a.t,Math.floor(t.entrants.length/2)*t.swissRounds);
  let total=a.t+b.t;if(t.qual>=2&&!t.po)total+=t.qual-1;
  return {played:a.p+b.p,total};
}

if(typeof module!=='undefined'&&module.exports){module.exports={nextPow2,seedOrder,num,buildElim,buildFair,fairByes,buildRR,compute,champion,standings,pairUp,swissNext,shuffle,allComp,stageDone,syncPlayoff,stats};}
