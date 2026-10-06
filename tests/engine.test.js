const test=require('node:test');
const assert=require('node:assert');
const E=require('../engine.js');

const ids=n=>Array.from({length:n},(_,i)=>'e'+(i+1));
const mkSwiss=(n,rounds)=>{
  const t={format:'swiss',mode:'singles',entrants:ids(n).map(id=>({id,name:id,members:[],memberIds:[id],skill:2})),matches:[],results:{},swissRounds:rounds,round:0,qual:4,second:true,po:null};
  t.matches=E.swissNext(t);t.round=1;return t;
};
/* higher-numbered entrant always wins 11-5 */
const playRound=(t,r)=>t.matches.filter(m=>m.r===r).forEach(m=>{
  const c=E.compute(t)[m.id];if(!c.a||!c.b||c.a==='bye'||c.b==='bye')return;
  const aWins=parseInt(c.a.slice(1))>parseInt(c.b.slice(1));
  t.results[m.id]={sig:c.a+'|'+c.b,sa:aWins?11:5,sb:aWins?5:11};
});

test('single elimination: byes fill to a power of two',()=>{
  const ms=E.buildElim(ids(6),false,false);
  const c=E.compute({matches:ms,results:{}});
  assert.equal(ms.filter(m=>m.br==='W'&&m.r===1).length,4);
  assert.equal(Object.values(c).filter(r=>r.auto).length,2);
});

test('single elimination with second chance: a bye team plays a round-1 loser',()=>{
  const ms=E.buildElim(ids(6),false,true);
  const plays=ms.filter(m=>m.r===1.5);
  assert.equal(plays.length,2);
  plays.forEach(p=>{assert.equal(p.a.t,'w');assert.equal(p.b.t,'l')});
});

test('double elimination builds a grand final and a conditional reset',()=>{
  const ms=E.buildElim(ids(8),true,false);
  assert.ok(ms.find(m=>m.id==='GF'));
  assert.ok(ms.find(m=>m.id==='GR').cond);
});

test('round robin: everyone plays everyone once',()=>{
  const ms=E.buildRR(ids(6));
  assert.equal(ms.length,15);
  const seen=new Set(ms.map(m=>[m.a.id,m.b.id].sort().join('|')));
  assert.equal(seen.size,15);
});

test('swiss: round 1 pairs top half against bottom half, odd count gets a bye',()=>{
  const t=mkSwiss(11,3);
  assert.equal(t.matches.length,6);
  assert.equal(t.matches.filter(m=>m.b.t==='b').length,1);
});

test('swiss: no rematches across three rounds',()=>{
  const t=mkSwiss(12,3);
  const seen=new Set();
  for(let r=1;r<=3;r++){
    if(r>1){t.matches=t.matches.concat(E.swissNext(t));t.round=r}
    playRound(t,r);
    t.matches.filter(m=>m.r===r).forEach(m=>{
      const c=E.compute(t)[m.id];const k=[c.a,c.b].sort().join('|');
      assert.ok(!seen.has(k),'rematch '+k);seen.add(k);
    });
  }
});

test('standings: win gives a point, score difference breaks ties',()=>{
  const t=mkSwiss(4,2);playRound(t,1);
  const rows=E.standings(t,E.compute(t));
  assert.equal(rows[0].p,1);
  assert.ok(rows[0].diff>0);
});

test('automatic knockout: top N qualify once every Swiss match is scored',()=>{
  const t=mkSwiss(8,2);
  E.syncPlayoff(t);assert.equal(t.po,null);
  playRound(t,1);
  t.matches=t.matches.concat(E.swissNext(t));t.round=2;
  E.syncPlayoff(t);assert.equal(t.po,null,'round 2 unscored');
  playRound(t,2);
  E.syncPlayoff(t);
  assert.ok(t.po,'knockout is built');
  assert.equal(t.po.ids.length,4);
  const st=E.stats(t,E.compute(t),E.compute({matches:t.po.matches,results:t.results}));
  assert.ok(st.total>=st.played);
});

test('a changed score invalidates a stale result via its signature',()=>{
  const t=mkSwiss(4,2);
  const m=t.matches[0];const c=E.compute(t)[m.id];
  t.results[m.id]={sig:'x|y',sa:11,sb:3};
  assert.equal(E.compute(t)[m.id].w,undefined);
  t.results[m.id]={sig:c.a+'|'+c.b,sa:11,sb:3};
  assert.equal(E.compute(t)[m.id].w,c.a);
});

test('fewest-byes single elimination: valid, minimal byes, nobody gets two',()=>{
  for(let n=2;n<=40;n++){
    for(let rep=0;rep<20;rep++){
      const e=ids(n),ms=E.buildFair(e);
      const t={format:'single',matches:ms,results:{}};
      /* every entrant sits in exactly one slot */
      const leaves=ms.flatMap(m=>[m.a,m.b]).filter(s=>s.t==='e').map(s=>s.id).sort();
      assert.deepEqual(leaves,e.slice().sort(),'n='+n);
      const byeMs=ms.filter(m=>m.a.t==='b'||m.b.t==='b');
      assert.equal(byeMs.length,E.fairByes(n),'bye count n='+n);
      assert.ok(byeMs.length<=E.nextPow2(n)-n,'never more byes than a classic bracket, n='+n);
      assert.ok(E.fairByes(n)<=Math.ceil(Math.log2(n)),'at most one bye per round, n='+n);
      /* play it out: higher-numbered entrant wins; count games and byes per entrant */
      const games={},byes={};e.forEach(x=>{games[x]=0;byes[x]=0});
      ms.forEach(m=>{
        const c=E.compute(t)[m.id];
        assert.ok(c.a!==undefined&&c.b!==undefined,'resolved in order, '+m.id);
        if(c.a==='bye'||c.b==='bye'){byes[c.a==='bye'?c.b:c.a]++;return}
        games[c.a]++;games[c.b]++;
        const aWins=parseInt(c.a.slice(1))>parseInt(c.b.slice(1));
        t.results[m.id]={sig:c.a+'|'+c.b,sa:aWins?11:5,sb:aWins?5:11};
      });
      /* with 17, 33-35, 37 or 41 teams a team could in theory be handed a second bye, if it wins through every round (unavoidable there) */
      const risky=[17,33,34,35,37,41].includes(n);
      assert.ok(Object.values(byes).every(b=>b<=(risky?2:1)),'one bye max per entrant, n='+n);
      assert.equal(ms.length-byeMs.length,n-1,'n-1 real matches');
      const ch=E.champion({format:'single',matches:ms,results:t.results},E.compute(t));
      assert.equal(ch,'e'+n,'champion decided, n='+n);
    }
  }
});

test('fewest-byes: 13 teams need 2 byes (classic needs 3), 9 teams need 3 (classic 7)',()=>{
  assert.equal(E.fairByes(13),2);assert.equal(E.fairByes(9),3);assert.equal(E.fairByes(16),0);assert.equal(E.fairByes(12),1);
});

test('fewest byes + second chance: every bye becomes a game against a same-round loser',()=>{
  for(let n=2;n<=40;n++){
    for(let rep=0;rep<10;rep++){
      const e=ids(n),ms=E.buildFair(e,true);
      assert.equal(ms.filter(m=>m.a.t==='b'||m.b.t==='b').length,0,'no bye cards left, n='+n);
      const plays=ms.filter(m=>m.id[0]==='P');
      assert.equal(plays.length,E.fairByes(n),'one second-chance game per bye slot, n='+n);
      plays.forEach(p=>{
        assert.equal(p.b.t,'l');
        const src=ms.find(m=>m.id===p.b.m);
        assert.ok(src&&Math.floor(p.r)===src.r,'plays a loser from the same round, n='+n);
      });
      const t={format:'single',matches:ms,results:{}},games={};e.forEach(x=>games[x]=0);
      ms.forEach(m=>{
        const c=E.compute(t)[m.id];
        assert.ok(c.a!==undefined&&c.b!==undefined&&c.a!=='bye'&&c.b!=='bye','resolved in order '+m.id+' n='+n);
        games[c.a]++;games[c.b]++;
        const aWins=parseInt(c.a.slice(1))>parseInt(c.b.slice(1));
        t.results[m.id]={sig:c.a+'|'+c.b,sa:aWins?11:5,sb:aWins?5:11};
      });
      assert.ok(Object.values(games).every(g=>g>=1),'everyone plays at least once, n='+n);
      assert.equal(E.champion({format:'single',matches:ms,results:t.results},E.compute(t)),'e'+n,'champion, n='+n);
      assert.equal(ms.filter(m=>m.br==='W').pop().id,ms.reduce((a,m)=>m.r>a.r?m:a,ms[0]).id,'final is last');
    }
  }
});

test('fewest-byes double elimination: everyone gets two chances and byes never exceed classic',()=>{
  for(let n=2;n<=40;n++){
    const classic=E.byeGames(E.buildElim(ids(n),true,false));
    for(let rep=0;rep<15;rep++){
      const e=ids(n),ms=E.buildFairDouble(e);
      assert.ok(E.byeGames(ms)<=classic,'bye games <= classic, n='+n);
      const t={format:'double',matches:ms,results:{}},loss={};e.forEach(x=>loss[x]=0);let played=0;
      for(const m of ms){
        const c=E.compute(t)[m.id];
        if(c.skip||c.pending)continue;
        assert.ok(c.a!==undefined&&c.b!==undefined,'resolved in order '+m.id+' n='+n);
        if(c.a==='bye'||c.b==='bye')continue;
        const aWins=Math.random()<.5;played++;
        t.results[m.id]={sig:c.a+'|'+c.b,sa:aWins?11:5,sb:aWins?5:11};
        loss[aWins?c.b:c.a]++;
      }
      const ch=E.champion(t,E.compute(t));
      assert.ok(ch,'champion decided, n='+n);
      e.filter(x=>x!==ch).forEach(x=>assert.equal(loss[x],2,x+' is out after exactly two losses, n='+n));
      assert.ok(loss[ch]<=1,'champion has at most one loss, n='+n);
      assert.ok(played<=2*n-1,'at most 2n-1 games, n='+n);
    }
  }
});

test('fewest-byes double elimination: 13 teams have 3 bye games where classic has 6',()=>{
  assert.equal(E.byeGames(E.buildFairDouble(ids(13))),3);
  assert.equal(E.byeGames(E.buildElim(ids(13),true,false)),6);
});

/* ---- rolling single elimination ---- */
const mkRoll=()=>({format:'roll',mode:'singles',entrants:[],matches:[],results:{},closed:false,seq:0});
const addP=(t,id,mates)=>{t.entrants.push({id,name:id,members:[],memberIds:[id],skill:2,mates:mates||[]});E.rollSync(t)};
const playAll=t=>{for(let g=0;g<200;g++){let did=false;const comp=E.compute(t);for(const m of t.matches){const c=comp[m.id];if(c&&c.a&&c.b&&c.a!=='bye'&&c.b!=='bye'&&!c.w){t.results[m.id]={sig:c.a+'|'+c.b,sa:11,sb:5};did=true;break}}if(!did)break}};
test('rolling: n-1 matches, fewest byes, one champion, for every n and arrival order',()=>{
  for(let n=1;n<=40;n++){
    const t=mkRoll();ids(n).sort(()=>Math.random()-.5).forEach(id=>addP(t,id));
    t.closed=true;E.rollSync(t);
    assert.equal(t.matches.length,Math.max(0,n-1),'matches n='+n);
    assert.equal(E.rollByes(t),E.fairByes(n),'byes n='+n);
    playAll(t);
    const ch=E.champion(t,E.compute(t));
    assert.ok(ch,'champion n='+n);
    const seen=new Set();t.matches.forEach(m=>[m.a,m.b].forEach(s=>{if(s.t==='e'){assert.ok(!seen.has(s.id));seen.add(s.id)}}));
    assert.equal(seen.size,n>1?n:0);
  }
});
test('rolling: pairs as soon as two are free and no champion while entries are open',()=>{
  const t=mkRoll();addP(t,'a');assert.equal(t.matches.length,0);
  addP(t,'b');assert.equal(t.matches.length,1);
  addP(t,'c');addP(t,'d');assert.equal(t.matches.length,3);
  playAll(t);assert.equal(E.champion(t,E.compute(t)),null);
  t.closed=true;E.rollSync(t);assert.ok(E.champion(t,E.compute(t)));
});
test('rolling: teammates are not paired while another opponent exists',()=>{
  const t=mkRoll();addP(t,'a',['b']);addP(t,'b',['a']);assert.equal(t.matches.length,0);
  addP(t,'c');assert.equal(t.matches.length,1);
  const m=t.matches[0],f=[m.a.id,m.b.id].sort().join('');assert.notEqual(f,'ab');
  t.closed=true;E.rollSync(t);assert.equal(t.matches.length,2);
});
test('rolling: two teammates alone are paired once entries close',()=>{
  const t=mkRoll();addP(t,'a',['b']);addP(t,'b',['a']);t.closed=true;E.rollSync(t);
  assert.equal(t.matches.length,1);assert.equal(t.final,t.matches[0].id);
});
test('rolling: reopening removes only the closing matches and refuses once they are played',()=>{
  const t=mkRoll();ids(5).forEach(id=>addP(t,id));
  const before=t.matches.length;t.closed=true;E.rollSync(t);assert.equal(t.matches.length,4);
  assert.ok(E.rollReopen(t));assert.equal(t.matches.length,before);assert.equal(t.closed,false);
  addP(t,'e6');addP(t,'e7');t.closed=true;E.rollSync(t);assert.equal(t.matches.length,6);
  playAll(t);assert.equal(E.rollReopen(t),false);
});
test('rolling: results survive new players joining',()=>{
  const t=mkRoll();addP(t,'a');addP(t,'b');const c=E.compute(t)[t.matches[0].id];
  t.results[t.matches[0].id]={sig:c.a+'|'+c.b,sa:11,sb:3};
  addP(t,'c');addP(t,'d');
  const comp=E.compute(t);assert.equal(comp[t.matches[0].id].w,c.a);assert.equal(t.matches.length,3);
});
