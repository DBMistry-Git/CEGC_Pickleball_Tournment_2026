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
