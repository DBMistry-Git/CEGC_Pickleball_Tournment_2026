/* Courtside Brackets: app. Needs engine.js loaded first. */

/* ---------------- app ---------------- */
const SKILL=['','New to it','A few times','Regular'];
const FORMATS={
  single:{label:'Single elimination',hint:'Lose once and you are out. Byes fill the bracket when the entrant count is not a power of two.'},
  double:{label:'Double elimination',hint:'Everyone gets a second life through a losers bracket. A grand final with a reset match decides the champion.'},
  rr:{label:'Round robin',hint:'Every entrant plays every other entrant once. Ranked by points, then score difference.'},
  swiss:{label:'Swiss',hint:'A fixed number of rounds. Each round pairs entrants with similar records and avoids rematches.'}
};
function fresh(){
  /* CEGC Pickleball Tournament 2026: doubles entrants from the registration sheet.
     Experience: 1 = never played, 2 = a few times, 3 = regularly. Partners who did not fill in the form default to 2. */
  const nE=()=>({format:'single',seeding:'random',swissRounds:0,qual:4,style:'fair',second:false,t:null});
  const S={name:'CEGC Pickleball Tournament 2026',teamSize:2,players:[],teams:[],apart:[],scheme:'num2',ev:'doubles',E:{doubles:nE(),singles:nE()},sched:{courts:2,start:'16:30',len:20,rest:true,slots:[]},uid:1,tab:'teams',sample:false};
  const add=(n,s)=>{const p={id:'p'+(S.uid++),name:n,skill:s};S.players.push(p);return p.id};
  const pairs=[[['Ryan Burrows',3],['Kevin Donnelly',2]],[['Hitarth Thakkar',2],['Ajeet Singh',2]],[['Mahmud Hussain Masum',3],['Abdulla Hasan',2]],
    [['Shekhar Shinde',1],['Tanay Jawdekar',2]],[['Md Majidur Rahman',2],['Md Imam Hossain',2]],[['Virginia Lopez',2],['Ana Carolina Silva Barbeta',2]]];
  pairs.forEach(pr=>{const ids=pr.map(x=>add(x[0],x[1]));S.teams.push({id:'t'+(S.uid++),members:ids})});
  const solo={};
  [['Isaac Doughan',2],['Aleah Treiterer',2],['Abby Mapili',3],['Allison Korpi',3],['Vincent Copeland',3],['Trace Pearce',3],['Satchit Nagpal',3]].forEach(x=>solo[x[0]]=add(x[0],x[1]));
  S.apart.push([solo['Abby Mapili'],solo['Aleah Treiterer']]);
  return S;
}
/* ----- state, persistence, read-only vs edit mode -----
   Viewers get the published state.json in read-only mode.
   Add #edit to the address to edit. Edits live in this browser (a draft) until you download
   state.json and commit it to the repo. */
const VKEY='courtside-view-v1',DKEY='courtside-draft-v1';
let SV='court',RO=!/(^|[#&?])edit\b/.test(location.hash+location.search),META={rev:0,at:null},PUB=null,pubSig='',pollT=null;
let S=fresh();
let msg='',confirmReset=false,confirmRoll=false;
function sharedState(){const o=JSON.parse(JSON.stringify(S));delete o.tab;delete o.ev;return o}
function validState(o){return !!(o&&o.S&&o.S.players&&o.S.E&&o.S.sched)}
async function fetchPublished(){
  try{const r=await fetch('state.json?'+Date.now(),{cache:'no-store'});if(!r.ok)return null;const o=await r.json();return validState(o)?o:null}catch(e){return null}
}
function readDraft(){try{const d=JSON.parse(localStorage.getItem(DKEY)||'null');return validState(d)?d:null}catch(e){return null}}
function adopt(o){const tab=S&&S.tab,ev=S&&S.ev;S=JSON.parse(JSON.stringify(o.S));S.tab=tab||'teams';S.ev=ev||'doubles';META={rev:o.rev||0,at:o.at||null}}
function isDirty(){return !RO&&JSON.stringify(sharedState())!==pubSig}
function save(){
  try{localStorage.setItem(VKEY,JSON.stringify({tab:S.tab,ev:S.ev,sv:SV}))}catch(e){}
  if(!RO)try{localStorage.setItem(DKEY,JSON.stringify({rev:META.rev,at:META.at,S:sharedState()}))}catch(e){}
}
function schedulePublish(){}
function syncText(){
  if(RO)return 'View only'+(META.at?' · updated '+new Date(META.at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'');
  return isDirty()?'Draft in this browser · not published':'Matches the published version';
}
function paintSync(){
  const el=document.getElementById('sync');if(el)el.textContent=syncText();
  const t=document.getElementById('tools');
  if(t)t.innerHTML=RO?'':`<button class="btn small primary" data-act="pub"${pubBusy?' disabled':''}>${pubBusy?'Publishing…':'Publish to site'}</button><button class="btn small" data-act="dl">Download state.json</button><button class="btn small" data-act="discard">Discard draft</button><button class="btn small" data-act="tok">${ghToken()?'Forget token':'Set token'}</button>`;
}
function downloadState(){
  const rev=Math.max(META.rev||0,PUB?PUB.rev||0:0)+1;
  const st={rev,at:new Date().toISOString(),S:sharedState()};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(st,null,1)+'\n'],{type:'application/json'}));
  a.download='state.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  note('Downloaded state.json. Replace the file in the repo, then commit and push to publish.');
}
/* ----- one-click publish: writes state.json to the repo through the GitHub API -----
   Needs a fine-grained token (Contents: read and write on this one repo). It is kept only in this
   browser's localStorage and is sent only to api.github.com. */
const TKEY='courtside-gh-token-v1',RKEY='courtside-gh-repo-v1';
let pubBusy=false;
function ghToken(){try{return localStorage.getItem(TKEY)||''}catch(e){return ''}}
function ghRepo(){
  const m=location.hostname.match(/^([^.]+)\.github\.io$/i),seg=location.pathname.split('/')[1];
  if(m&&seg)return m[1]+'/'+decodeURIComponent(seg);
  try{return localStorage.getItem(RKEY)||''}catch(e){return ''}
}
function setToken(){
  if(ghToken()){
    if(confirm('Remove the saved GitHub token from this browser?')){try{localStorage.removeItem(TKEY)}catch(e){}note('Token removed from this browser.')}
    return;
  }
  const t=(prompt('Paste your GitHub token. It stays in this browser only.')||'').trim();
  if(!t)return;
  try{localStorage.setItem(TKEY,t);note('Token saved in this browser. Press Publish to site.')}catch(e){note('Could not save the token because browser storage is blocked.')}
}
function ghFail(status){
  if(status===401)return 'Could not publish: GitHub rejected the token (wrong or expired). Use Forget token, then Set token.';
  if(status===403||status===404)return 'Could not publish: no permission. The token needs Contents: Read and write on this repo, and the repo name must be right.';
  if(status===409||status===422)return 'Could not publish: the file changed while publishing. Press Publish to site again.';
  return 'Could not publish: GitHub answered with error '+status+'.';
}
async function publishState(){
  if(pubBusy)return;
  if(!ghToken()){setToken();render();return}
  let repo=ghRepo();
  if(!repo){
    repo=(prompt('Repo to publish to, written as owner/name')||'').trim();
    if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){note('Need the repo written as owner/name.');render();return}
    try{localStorage.setItem(RKEY,repo)}catch(e){}
  }
  pubBusy=true;note('Publishing…');render();
  const api='https://api.github.com/repos/'+repo+'/contents/state.json';
  const H={Authorization:'Bearer '+ghToken(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  try{
    let sha,remoteRev=0;
    const g=await fetch(api+'?t='+Date.now(),{headers:H,cache:'no-store'});
    if(g.ok){
      const j=await g.json();sha=j.sha;
      try{remoteRev=JSON.parse(decodeURIComponent(escape(atob(String(j.content||'').replace(/\s/g,''))))).rev||0}catch(e){}
    }else if(g.status!==404){note(ghFail(g.status));return}
    if(remoteRev>(META.rev||0)&&!confirm('The published version (rev '+remoteRev+') is newer than the one this draft started from (rev '+(META.rev||0)+'). Publish anyway and replace it?')){note('Publish cancelled.');return}
    const rev=Math.max(META.rev||0,remoteRev)+1,st={rev,at:new Date().toISOString(),S:sharedState()};
    const body={message:'Update tournament (rev '+rev+')',content:btoa(unescape(encodeURIComponent(JSON.stringify(st,null,1)+'\n')))};
    if(sha)body.sha=sha;
    const r=await fetch(api,{method:'PUT',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){note(ghFail(r.status));return}
    PUB=st;META={rev,at:st.at};pubSig=JSON.stringify(sharedState());
    note('Published rev '+rev+'. The public page updates in about a minute.');
  }catch(e){
    note('Could not publish: no connection to GitHub.');
  }finally{
    pubBusy=false;render();
  }
}
function discardDraft(){
  if(!confirm('Discard this draft and go back to the published state.json?'))return;
  try{localStorage.removeItem(DKEY)}catch(e){}
  adopt(PUB||{rev:0,at:null,S:fresh()});pubSig=JSON.stringify(sharedState());note('Draft discarded.');
}
function startPolling(){
  if(!/^https?:/.test(location.protocol))return;
  clearInterval(pollT);
  pollT=setInterval(async()=>{
    const o=await fetchPublished();
    if(o&&(o.rev!==META.rev||o.at!==META.at)){adopt(o);render()}
  },30000);
}
async function boot(){
  document.getElementById('app').innerHTML='<p class="hint">Loading…</p>';
  PUB=await fetchPublished();
  const d=RO?null:readDraft();
  adopt(d||PUB||{rev:0,at:null,S:fresh()});
  try{const v=JSON.parse(localStorage.getItem(VKEY)||'null');if(v){if(v.tab)S.tab=v.tab;if(v.ev&&S.E[v.ev])S.ev=v.ev;if(v.sv==='time')SV='time'}}catch(e){}
  render();
  pubSig=d?(PUB?JSON.stringify(PUB.S):''):JSON.stringify(sharedState());
  paintSync();
  if(RO)startPolling();
}
const E=()=>S.E[S.ev],isD=()=>S.ev==='doubles',sty=()=>E().style||'fair',dsty=()=>sty()==='classic'?'classic':'fair';
let SM={};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pid=()=>'p'+(S.uid++), tid=()=>'t'+(S.uid++);
const P=id=>S.players.find(p=>p.id===id);
const assigned=()=>new Set(S.teams.flatMap(t=>t.members));
const unassigned=()=>{const a=assigned();return S.players.filter(p=>!a.has(p.id))};
function teamName(t,i){
  if(t.custom)return t.custom;
  const k=S.teamSize;
  if(S.scheme==='num2'){let s='';for(let j=1;j<=k;j++)s+=(i*k+j);return 'Team '+s}
  if(S.scheme==='names'&&t.members.length)return t.members.map(m=>(P(m)||{}).name).join(' & ');
  return 'Team '+(i+1);
}
function skillOptions(sel){return [1,2,3].map(v=>`<option value="${v}"${v===sel?' selected':''}>${SKILL[v]}</option>`).join('')}
function note(m){msg=m}

/* ----- views ----- */
function render(){
  save();
  const ae=document.activeElement;let fkey=null;
  if(ae&&ae.closest&&ae.closest('#app')){if(ae.id)fkey='#'+ae.id;else if(ae.dataset&&ae.dataset.m&&ae.dataset.chg==='score')fkey='[data-chg="score"][data-m="'+ae.dataset.m+'"][data-s="'+ae.dataset.s+'"]'}
  const tabs=RO?[['bracket','Bracket'],['schedule','Schedule'],['teams','Teams']]:[['players','Players'],['teams','Teams'],['bracket','Bracket'],['schedule','Schedule']];
  if(!tabs.some(t=>t[0]===S.tab))S.tab=tabs[0][0];
  document.body.classList.toggle('ro',RO);
  const cnt={players:S.players.length,teams:S.teams.length};
  document.getElementById('tabs').innerHTML=tabs.map(t=>`<button class="tab" data-act="tab" data-tab="${t[0]}"${S.tab===t[0]?' aria-current="page"':''}>${t[1]}${cnt[t[0]]!=null?` <span class="cnt">${cnt[t[0]]}</span>`:''}</button>`).join('');
  const v=S.tab==='players'?playersView():S.tab==='teams'?(RO?teamsRO():teamsView()):S.tab==='schedule'?scheduleView():bracketView();
  const app=document.getElementById('app');
  app.innerHTML=(msg?`<div class="notice${/could not|not enough|need|must|every/i.test(msg)?' warn':''}" role="status"><span>${esc(msg)}</span><button class="btn small" data-act="dismiss">Dismiss</button></div>`:'')+v;
  if(fkey){const el=app.querySelector(fkey);if(el){el.focus();if(el.select&&el.tagName==='INPUT'&&el.type==='number')el.select()}}
  afterRender();
}

function afterRender(){
  if(RO){
    document.querySelectorAll('#app input,#app select,#app textarea,#app button').forEach(el=>{if(el.dataset.act!=='ev'&&el.dataset.act!=='sv')el.disabled=true});
  }
  paintSync();schedulePublish();
}
function teamsRO(){
  const un=unassigned();
  return `<section class="card"><header><h2>Teams (${S.teams.length})</h2></header>${S.teams.length?`<div class="teams">${S.teams.map((t,i)=>`<div class="team"><div class="tname-ro">${esc(teamName(t,i))}</div><ul>${t.members.map(m=>`<li><span>${esc((P(m)||{}).name||'?')}</span></li>`).join('')}</ul></div>`).join('')}</div>`:'<p class="hint">No teams yet.</p>'}</section>`
  +(un.length?`<section class="card"><header><h3>Waiting for a partner</h3></header><div class="chips">${un.map(p=>`<span class="chip plain">${esc(p.name)}</span>`).join('')}</div></section>`:'');
}
function playersView(){
  const asg={};S.teams.forEach((t,i)=>t.members.forEach(m=>asg[m]=teamName(t,i)));
  return `
  ${S.sample?`<div class="notice"><span>These are example players. Clear them to enter your own.</span><button class="btn small" data-act="clearPlayers">Clear all players</button></div>`:''}
  <div class="grid2">
  <section class="card"><header><h2>Tournament</h2></header>
    <div class="field"><label for="tName">Name</label><input type="text" id="tName" data-chg="tname" value="${esc(S.name)}"></div>
    <div class="field"><label for="tsize">Players per doubles team</label><select id="tsize" data-chg="tsize">${[2,3,4].map(n=>`<option${n===S.teamSize?' selected':''}>${n}</option>`).join('')}</select></div>
    <p class="hint">Everyone added here can play in both events. Build the doubles teams on the Teams tab. Untick Singles for anyone who is only playing doubles.</p>
  </section>
  <section class="card"><header><h2>Add players</h2></header>
    <form id="addForm" class="row">
      <div class="field" style="flex:1;min-width:10rem"><label for="pName">Name</label><input type="text" id="pName" autocomplete="off" placeholder="Full name"></div>
      <div class="field"><label for="pSkill">Experience</label><select id="pSkill">${skillOptions(2)}</select></div>
      <button class="btn primary" style="align-self:flex-end">Add</button>
    </form>
    <details><summary>Paste a list</summary>
      <div class="field" style="margin-top:.6rem"><label for="bulk">One name per line, optional experience 1-3 after a comma</label>
      <textarea id="bulk" rows="5" placeholder="Dana Reyes, 3&#10;Lee Chen&#10;Omar Ali, 1"></textarea></div>
      <button class="btn" style="margin-top:.5rem" data-act="bulkAdd">Add all</button>
    </details>
  </section></div>
  <section class="card"><header><h2>Players (${S.players.length})</h2><span class="hint">${S.players.filter(p=>p.singles!==false).length} in singles. Experience is used by the “most experienced first” seeding.</span></header>
    ${S.players.length?`<ul class="list">${S.players.map(p=>`<li><span class="nm">${esc(p.name)}</span>
      <span class="pill${asg[p.id]?' on':''}">${asg[p.id]?esc(asg[p.id]):'No team'}</span>
      <label class="chk"><input type="checkbox" data-chg="psingles" data-id="${p.id}" aria-label="Plays singles: ${esc(p.name)}"${p.singles!==false?' checked':''}> Singles</label>
      <select aria-label="Experience for ${esc(p.name)}" data-chg="pskill" data-id="${p.id}">${skillOptions(p.skill)}</select>
      <button class="x" aria-label="Remove ${esc(p.name)}" data-act="rmPlayer" data-id="${p.id}">×</button></li>`).join('')}</ul>`:'<p class="hint">No players yet. Add the first one above.</p>'}
  </section>`;
}

function teamsView(){
  const un=unassigned(),k=S.teamSize,full=S.teams.filter(t=>t.members.length===k).length;
  const opt=un.map(p=>`<option value="${p.id}">${esc(p.name)} (${SKILL[p.skill]})</option>`).join('');
  return `
  <section class="card"><header><h2>Pre-formed teams</h2></header>
    <p class="hint">For players who signed up with a partner. One team per line, names split by &amp;. New names are added as players.</p>
    <textarea id="pre" rows="4" placeholder="Ryan Burrows &amp; Kevin Donnelly&#10;Hitarth Thakkar &amp; Ajeet Singh"></textarea>
    <div class="row"><button class="btn" data-act="addPre">Add teams</button><button class="btn" data-act="addEmpty">Add empty team</button></div>
  </section>
  <section class="card"><header><h2>Teams (${S.teams.length})</h2><div class="row"><span class="hint">${full} of ${S.teams.length} full</span>
      <div class="field"><label for="dScheme">Team labels</label><select id="dScheme" data-chg="scheme">
        <option value="num2"${S.scheme==='num2'?' selected':''}>Team 12, Team 34, Team 56…</option>
        <option value="seq"${S.scheme==='seq'?' selected':''}>Team 1, Team 2, Team 3…</option>
        <option value="names"${S.scheme==='names'?' selected':''}>Member names</option></select></div></div></header>
    ${S.teams.length?`<div class="teams">${S.teams.map((t,i)=>`<div class="team">
      <input type="text" class="tname" aria-label="Team name" data-chg="teamname" data-id="${t.id}" value="${esc(teamName(t,i))}">
      <ul>${t.members.map(m=>`<li><span>${esc((P(m)||{}).name||'?')}</span><button class="x" aria-label="Remove from team" data-act="rmMember" data-t="${t.id}" data-p="${m}">×</button></li>`).join('')}</ul>
      ${t.members.length<k?`<select aria-label="Add member to ${esc(teamName(t,i))}" data-chg="addMember" data-t="${t.id}"><option value="">Add member…</option>${opt}</select>`:''}
      <button class="btn small danger" data-act="delTeam" data-id="${t.id}" style="align-self:flex-start">Remove team</button></div>`).join('')}</div>`:'<p class="hint">No teams yet. Paste pre-formed teams, or add an empty team and pick its members.</p>'}
    ${S.teams.some(t=>t.custom)?`<button class="btn small" style="align-self:flex-start" data-act="resetNames">Reset custom names</button>`:''}
  </section>
  ${un.length?`<section class="card"><header><h3>Not on a team yet</h3></header><div class="chips">${un.map(p=>`<span class="chip plain">${esc(p.name)}</span>`).join('')}</div></section>`:''}`;
}

let entMap={},numMap={};
function entHtml(id){
  const e=entMap[id];if(!e)return esc(id);
  const mem=e.members&&e.members.length?e.members.join(' & '):'';
  return `<span class="en">${esc(e.name)}</span>`+(mem&&mem!==e.name?`<span class="em">${esc(mem)}</span>`:'');
}
function pendLabel(s){
  if(!s)return '';
  if(s.t==='w')return 'Winner of M'+numMap[s.m];
  if(s.t==='l')return 'Loser of M'+numMap[s.m];
  if(s.t==='x')return s.s==='a'?'Winners-bracket champion':'Losers-bracket champion';
  return '';
}
function matchCard(m,r,elim){
  const editable=r.a&&r.b&&r.a!=='bye'&&r.b!=='bye';
  const ready=editable&&!r.w&&!(r.draw&&!elim);
  const rows=['a','b'].map(s=>{
    const id=r[s],won=r.w&&r.w===id&&id!=='bye',lost=r.l&&r.l===id&&id!=='bye';
    const label=id==='bye'?'<span class="bye">BYE</span>':id?entHtml(id):`<span class="pend">${esc(pendLabel(m[s]))}</span>`;
    const sc=r['s'+s];
    return `<div class="slot${won?' won':''}${lost?' lost':''}"><button class="nmb" tabindex="-1" data-act="win" data-m="${m.id}" data-s="${s}"${editable?'':' disabled'} title="${editable?'Mark as winner':''}">${label}</button>${editable?`<input type="number" class="sc" min="0" inputmode="numeric" aria-label="Score" data-chg="score" data-m="${m.id}" data-s="${s}" value="${sc==null?'':sc}">`:''}</div>`;
  }).join('');
  const tie=r.draw&&elim?'<div class="slot"><span class="pend">Tied. Mark a winner.</span></div>':'';
  const si=SM[S.ev+':'+m.id],when=si&&!r.auto?`<div class="when">Slot ${si.slot+1} · ${esc(cname(si.court))} · ${slotTime(si.slot)}</div>`:'';
  return `<div class="match${r.auto?' auto':''}${ready?' ready':''}${(r.w||r.draw&&!elim)&&!r.auto?' done':''}"><span class="mno">M${m.n}</span>${rows}${tie}${when}</div>`;
}
function colTitle(br,r,maxR,m){
  if(br==='W'&&r%1!==0)return 'Second chance';
  if(br==='W'){const d=maxR-r;return d===0?'Final':d===1?'Semifinals':d===2?'Quarterfinals':'Round '+r}
  if(br==='L')return 'Losers round '+r;
  return m.id==='GF'?'Grand final':'Reset match';
}
function elimSections(ms,comp,groups){
  return groups.map(([br,title])=>{
    const part=ms.filter(m=>m.br===br),rounds={};
    part.forEach(m=>{const r=comp[m.id];if(r.skip||(r.w==='bye'&&r.a==='bye'&&r.b==='bye'))return;if(m.cond&&r.pending)return;(rounds[m.r]=rounds[m.r]||[]).push(m)});
    const maxR=Math.max(0,...part.map(m=>Math.floor(m.r)));
    const cols=Object.keys(rounds).map(Number).sort((a,b)=>a-b).map(rn=>{
      const list=rounds[rn];
      return `<div class="col"><div class="coltitle">${colTitle(br,rn,maxR,list[0])}</div>${list.map(m=>matchCard(m,comp[m.id],true)).join('')}</div>`;
    }).join('');
    const gr=br==='F'&&comp.GR&&comp.GR.pending?'<p class="hint">A reset match appears only if the losers-bracket finalist wins the grand final.</p>':'';
    return `<div class="sect">${title?`<h3>${title}</h3>`:''}<div class="scroller"><div class="cols">${cols}</div></div>${gr}</div>`;
  }).join('');
}
function upNext(t,comp,pc){
  const rows=[];
  const el=t.format==='single'||t.format==='double';
  const scan=(ms,c,elim)=>ms.forEach(m=>{const r=c[m.id];if(r&&!r.skip&&!r.w&&!r.auto&&!(r.draw&&!elim)&&r.a&&r.b&&r.a!=='bye'&&r.b!=='bye')rows.push({n:m.n,a:r.a,b:r.b})});
  scan(t.matches,comp,el);if(t.po)scan(t.po.matches,pc,true);
  rows.sort((x,y)=>x.n-y.n);
  if(!rows.length)return '';
  const nm=id=>esc((entMap[id]||{name:id}).name);
  return `<section class="card"><header><h3>Up next</h3><span class="hint">${rows.length} ready to play</span></header><ul class="list">${rows.slice(0,6).map(x=>`<li><span class="mn">M${x.n}</span><span class="nm">${nm(x.a)} <span class="vs">vs</span> ${nm(x.b)}</span></li>`).join('')}</ul></section>`;
}
function bracketView(){return evSwitch()+bracketBody()}
function bracketBody(){
  SM=schedMap();
  if(!E().t)return RO?'<section class="card"><p class="hint">This bracket has not been created yet.</p></section>':setupView();
  const t=E().t;syncPlayoff(t);
  const comp=compute(t);
  entMap={};t.entrants.forEach(e=>entMap[e.id]=e);numMap={};t.matches.forEach(m=>numMap[m.id]=m.n);
  let pc=null;
  if(t.po){pc=compute({matches:t.po.matches,results:t.results});t.po.matches.forEach(m=>numMap[m.id]=m.n)}
  let champ=null,body='';
  if(t.format==='single'||t.format==='double'){
    champ=champion(t,comp);
    body=elimSections(t.matches,comp,t.format==='double'?[['W','Winners bracket'],['L','Losers bracket'],['F','Finals']]:[['W','']]);
  }else{
    const rows=standings(t,comp),q=t.qual||0,done=stageDone(t,comp);
    const anyPlayed=t.matches.some(m=>{const r=comp[m.id];return (r.w||r.draw)&&!r.auto});
    const cut=q&&anyPlayed&&rows[q-1]&&rows[q]&&['p','bh','diff','pf'].every(k=>rows[q-1][k]===rows[q][k]);
    const byRound={};t.matches.forEach(m=>(byRound[m.r]=byRound[m.r]||[]).push(m));
    const tb=`<div class="tbl"><table><thead><tr><th>#</th><th>${t.mode==='teams'?'Team':'Player'}</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>PF</th><th>PA</th><th>+/-</th>${t.format==='swiss'?'<th>Buch.</th>':''}${q?'<th></th>':''}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${q&&i<q?'qual':''}${q&&i===q-1?' cut':''}"><td>${i+1}</td><td>${entHtml(r.id)}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td><b>${r.p}</b></td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff>0?'+':''}${r.diff}</td>${t.format==='swiss'?`<td>${r.bh}</td>`:''}${q?`<td>${anyPlayed?(i<q?`<span class="pill on">${done?'Qualified':'In'}</span>`:(done?'<span class="pill">Out</span>':'')):''}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
    let ctl='';
    if(t.format==='swiss'){
      const cur=t.matches.filter(m=>m.r===t.round),rdone=cur.every(m=>{const r=comp[m.id];return r.w||r.auto||r.draw});
      ctl=`<div class="row"><span class="pill on">Round ${t.round} of ${t.swissRounds}</span><button class="btn primary" data-act="nextRound"${t.round>=t.swissRounds||!rdone?' disabled':''}>Generate round ${Math.min(t.round+1,t.swissRounds)}</button>${!rdone?'<span class="hint">Finish every match in this round first.</span>':''}</div>`;
    }
    const rl=Object.keys(byRound).map(Number).sort((a,b)=>a-b).map(rn=>`<div class="sect"><h3>Round ${rn}</h3><div class="rgrid">${byRound[rn].map(m=>matchCard(m,comp[m.id],false)).join('')}</div></div>`).join('');
    const st=stats(t,comp,pc);
    let ko='';
    if(q){
      ko=t.po
        ?`<section class="card"><header><h2>Knockout</h2><span class="pill on">Top ${q} qualified</span></header>${elimSections(t.po.matches,pc,[['W','']])}</section>`
        :`<section class="card"><header><h2>Knockout</h2><span class="pill">Top ${q} qualify</span></header><p class="hint">The knockout is built automatically, seeded by standing, once every match in this stage has a score. ${st.played} of ${st.total} matches are played so far.</p></section>`;
    }
    if(t.po)champ=champion({format:'single',matches:t.po.matches},pc);
    else if(!q&&done)champ=rows[0].id;
    body=`<section class="card"><header><h2>Standings</h2>${q?`<span class="hint">Top ${q} qualify for the knockout</span>`:''}</header>${ctl}${tb}${cut?`<p class="hint warn">Position ${q} and ${q+1} are level on every tiebreak. Entry order decides for now; a changed score will separate them.</p>`:''}</section>${ko}<div class="rounds">${rl}</div>`;
  }
  return head(t,champ,stats(t,comp,pc))+upNext(t,comp,pc)+body;
}
function head(t,champ,st){
  const pct=st.total?Math.min(100,Math.round(100*st.played/st.total)):0;
  const c=champ?entMap[champ]:null;
  return `<section class="card"><header><div><h2>${esc(t.name)}</h2><p class="hint">${FORMATS[t.format].label}${t.format==='single'?(t.style==='second'||(!t.style&&t.second)?' + second chance':t.style==='fair'?' · fewest byes':t.style==='fairsecond'?' · fewest byes + second chance':''):t.format==='double'&&t.style==='fair'?' · fewest byes':''}${t.qual?' + top '+t.qual+' knockout':''} · ${t.entrants.length} ${t.mode==='teams'?'teams':'players'}</p></div>
    <div class="row">${confirmReset?`<span class="hint">This clears every result.</span><button class="btn danger" data-act="resetT">Yes, reset</button><button class="btn" data-act="cancelReset">Keep going</button>`:confirmRoll?`<span class="hint">This clears every result.</span><button class="btn danger" data-act="doReroll">Yes, re-roll</button><button class="btn" data-act="cancelRoll">Keep going</button>`:`<button class="btn" data-act="reroll">Re-roll draw</button><button class="btn" data-act="askReset">Edit setup</button>`}</div></header>
    <div class="prog" role="progressbar" aria-label="Matches played" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <p class="hint">${st.played} of ${st.total} matches played</p></section>
    ${c?`<div class="champ"><span class="lbl">Champion</span><b>${esc(c.name)}</b>${c.members.length&&c.members.join(' & ')!==c.name?`<span>${esc(c.members.join(' & '))}</span>`:''}</div>`:''}`;
}
function doubleHint(n){
  if(n<3)return '';
  const id=Array.from({length:n},(_,i)=>'x'+i);
  try{
    const f=byeGames(buildFairDouble(id)),c=byeGames(buildElim(id,true,false));
    return dsty()==='fair'?` With ${n} ${isD()?'teams':'players'} this has ${f} bye game${f===1?'':'s'} (a classic bracket has ${c}). Each round pairs as many as it can, and byes go to a random ${isD()?'team':'player'} that has not had one.`:` With ${n} ${isD()?'teams':'players'} this has ${c} bye game${c===1?'':'s'}; a fewest-byes bracket has ${f}.`;
  }catch(e){return ''}
}
function setupView(){
  const n=isD()?S.teams.length:S.players.filter(p=>p.singles!==false).length;
  const auto=Math.max(1,Math.ceil(Math.log2(Math.max(2,n))));
  const staged=E().format==='rr'||E().format==='swiss';
  const qmax=Math.min(n,16),qsel=E().qual>=2?Math.min(E().qual,qmax):0;
  const qopts=['<option value="0"'+(qsel===0?' selected':'')+'>None, standings only</option>'].concat(Array.from({length:Math.max(0,qmax-1)},(_,i)=>i+2).map(v=>`<option value="${v}"${qsel===v?' selected':''}>Top ${v}</option>`)).join('');
  return `<section class="card"><header><h2>Set up the ${isD()?'doubles':'singles'} bracket</h2><span class="pill">${n} ${isD()?'teams':'players'} ready</span></header>
    <div class="row">
      <div class="field"><label for="fmt">Format</label><select id="fmt" data-chg="format">${Object.keys(FORMATS).map(k=>`<option value="${k}"${E().format===k?' selected':''}>${FORMATS[k].label}</option>`).join('')}</select></div>
      <div class="field"><label for="seeding">Seeding</label><select id="seeding" data-chg="seeding">
        <option value="random"${E().seeding==='random'?' selected':''}>Random</option>
        <option value="order"${E().seeding==='order'?' selected':''}>Order entered</option>
        <option value="skill"${E().seeding==='skill'?' selected':''}>Most experienced first</option></select></div>
      ${E().format==='swiss'?`<div class="field"><label for="srounds">Swiss rounds</label><input type="number" id="srounds" min="1" max="12" data-chg="srounds" value="${E().swissRounds||auto}" style="width:6rem"></div>`:''}
      ${staged?`<div class="field"><label for="qual">Qualify for knockout</label><select id="qual" data-chg="qual">${qopts}</select></div>`:''}
    </div>
    ${E().format==='single'?`<div class="field"><label for="style">Bracket style</label><select id="style" data-chg="style">
        <option value="fair"${sty()==='fair'?' selected':''}>Fewest byes (fairest)</option>
        <option value="fairsecond"${sty()==='fairsecond'?' selected':''}>Fewest byes + second chance</option>
        <option value="second"${sty()==='second'?' selected':''}>Second chance (classic bracket)</option>
        <option value="classic"${sty()==='classic'?' selected':''}>Classic (pads to a power of two)</option></select></div>`:E().format==='double'?`<div class="field"><label for="style">Bracket style</label><select id="style" data-chg="style">
        <option value="fair"${dsty()==='fair'?' selected':''}>Fewest byes (fairest)</option>
        <option value="classic"${dsty()==='classic'?' selected':''}>Classic (pads to a power of two)</option></select></div>`:''}
    <p class="hint">${FORMATS[E().format].hint}${E().format==='double'?doubleHint(n):''}${E().format==='single'?(sty()==='fairsecond'?` With ${n} ${isD()?'teams':'players'} the fair bracket has ${fairByes(n)} bye slot${fairByes(n)===1?'':'s'}. Each one becomes a game: the ${isD()?'team':'player'} that would get the bye plays the loser of a match from the same round, and the winner moves on, so nobody gets a free pass.`:sty()==='fair'?` With ${n} ${isD()?'teams':'players'} this needs ${fairByes(n)} bye${fairByes(n)===1?'':'s'} (a classic bracket needs ${nextPow2(Math.max(2,n))-n}). At most one bye per round, a ${isD()?'team':'player'} is not given two, and byes are drawn at random instead of going to the top seeds.`:sty()==='second'?' Instead of a free pass, a team without a round-1 game plays a round-1 loser, and the winner moves on.':' Byes go to the top seeds so the bracket fills to a power of two.'):''}${staged&&qsel?` The top ${qsel} then qualify automatically as soon as every match has a score, seeded by standing, and play a single-elimination knockout.`:''}</p>
    ${isD()&&unassigned().length?`<p class="hint">${unassigned().length} player${unassigned().length>1?'s are':' is'} not on a team yet and will not be entered.</p>`:''}
    <div class="row"><button class="btn primary" data-act="start">Start tournament</button></div>
  </section>`;
}

/* ----- schedule ----- */
function allMatchesOf(t){return t.matches.concat(t.po?t.po.matches:[])}
function evInfo(ev){
  const t=S.E[ev].t;if(!t)return null;
  const comp=allComp(t),ent={};t.entrants.forEach(e=>ent[e.id]=e);
  return {ev,t,comp,ent,elim:t.format==='single'||t.format==='double'};
}
function schedKeys(){const s=new Set();S.sched.slots.forEach(sl=>sl.items.forEach(i=>s.add(i.ev+':'+i.id)));return s}
function schedMap(){const m={};S.sched.slots.forEach((sl,si)=>sl.items.forEach(i=>m[i.ev+':'+i.id]={slot:si,court:i.court}));return m}
function slotTime(i){
  const p=(S.sched.start||'09:00').split(':').map(Number);
  const t=p[0]*60+p[1]+i*S.sched.len;let hh=Math.floor(t/60)%24;const mm=t%60,ap=hh>=12?'PM':'AM';hh=hh%12||12;
  return hh+':'+String(mm).padStart(2,'0')+' '+ap;
}
function readyMatches(){
  const keys=schedKeys(),out=[];
  ['doubles','singles'].forEach(ev=>{
    const I=evInfo(ev);if(!I)return;
    allMatchesOf(I.t).forEach(m=>{
      const r=I.comp[m.id];if(!r||r.skip||r.w||r.auto)return;
      if(!r.a||!r.b||r.a==='bye'||r.b==='bye')return;
      const isPo=!!(I.t.po&&I.t.po.matches.indexOf(m)>=0);
      if(r.draw&&!(I.elim||isPo))return;
      if(keys.has(ev+':'+m.id))return;
      out.push({ev,id:m.id,n:m.n,r:m.r,a:r.a,b:r.b,players:I.ent[r.a].memberIds.concat(I.ent[r.b].memberIds)});
    });
  });
  return out;
}
/* Court-centric scheduling. Each slot is a row of courts. Doubles are placed first; courts left over go to singles whose players are free.
   A team keeps its court from the previous slot when it can, and courts marked closed are skipped. */
const cname=c=>((S.sched.names||{})[c])||('Court '+c);
function openCourts(){const o=[];for(let i=1;i<=S.sched.courts;i++)if(!(S.sched.off||[]).includes(i))o.push(i);return o}
function placeCourts(chosen,prev,open){
  const free=open.slice(),out=[],rest=[];
  chosen.forEach(c=>{
    const it=prev?prev.items.find(it=>it.players.some(p=>c.players.includes(p))):null;
    const k=it?free.indexOf(it.court):-1;
    if(k>=0){free.splice(k,1);out.push({c,court:it.court})}else rest.push(c);
  });
  rest.forEach(c=>out.push({c,court:free.shift()}));
  return out.sort((x,y)=>x.court-y.court);
}
function buildSlot(quiet){
  const sc=S.sched,cands=readyMatches(),open=openCourts();
  if(!open.length){note('Every court is closed. Open at least one court.');return false}
  if(!cands.length){if(!quiet)note('Nothing is ready to schedule. Enter results to unlock the next round.');return false}
  const prev=sc.slots.length?sc.slots[sc.slots.length-1]:null,tired=new Set();
  if(sc.rest&&prev)prev.items.forEach(it=>it.players.forEach(p=>tired.add(p)));
  const busy=new Set(),chosen=[],ord=(a,b)=>a.r-b.r||a.n-b.n,rested=c=>!c.players.some(p=>tired.has(p));
  const take=list=>{for(const c of list){if(chosen.length>=open.length)return;if(c.players.some(p=>busy.has(p)))continue;chosen.push(c);c.players.forEach(p=>busy.add(p))}};
  take(cands.filter(c=>c.ev==='doubles'&&rested(c)).sort(ord));
  take(cands.filter(c=>c.ev==='singles'&&rested(c)).sort(ord));
  if(chosen.length<open.length){take(cands.filter(c=>c.ev==='doubles').sort(ord));take(cands.filter(c=>c.ev==='singles').sort(ord))}
  sc.slots.push({items:placeCourts(chosen,prev,open).map(x=>({ev:x.c.ev,id:x.c.id,court:x.court,players:x.c.players}))});
  if(!quiet){
    const d=chosen.filter(c=>c.ev==='doubles').length,s=chosen.length-d;
    note('Slot '+sc.slots.length+' built: '+d+' doubles and '+s+' singles match'+(s===1?'':'es')+'.');
  }
  return true;
}
function buildAll(){
  let n=0;while(n<60&&buildSlot(true))n++;
  note(n?('Scheduled '+n+' slot'+(n===1?'':'s')+' with every match that is ready.'):'Nothing is ready to schedule. Enter results to unlock the next round.');
}
function fillCell(si,court){
  const sc=S.sched,sl=sc.slots[si];if(!sl||sl.items.some(i=>i.court===court))return;
  const busy=new Set(),tired=new Set();
  sl.items.forEach(i=>i.players.forEach(p=>busy.add(p)));
  if(sc.rest&&si>0)sc.slots[si-1].items.forEach(it=>it.players.forEach(p=>tired.add(p)));
  const ord=(a,b)=>a.r-b.r||a.n-b.n,ok=readyMatches().filter(c=>!c.players.some(p=>busy.has(p)));
  const rested=c=>!c.players.some(p=>tired.has(p));
  const pick=ok.filter(c=>c.ev==='doubles'&&rested(c)).sort(ord)[0]||ok.filter(c=>c.ev==='singles'&&rested(c)).sort(ord)[0]
    ||ok.filter(c=>c.ev==='doubles').sort(ord)[0]||ok.filter(c=>c.ev==='singles').sort(ord)[0];
  if(!pick){note('No ready match fits '+cname(court)+' in this slot. Everyone left is already playing or waiting on a result.');return}
  sl.items.push({ev:pick.ev,id:pick.id,court,players:pick.players});
  sl.items.sort((x,y)=>x.court-y.court);
  note('Placed M'+pick.n+' ('+(pick.ev==='doubles'?'doubles':'singles')+') on '+cname(court)+'.');
}
function dropSched(ev){
  S.sched.slots.forEach(sl=>sl.items=sl.items.filter(i=>i.ev!==ev));
  S.sched.slots=S.sched.slots.filter(sl=>sl.items.length);
}
function invalidate(ev){(ev?[ev]:['doubles','singles']).forEach(k=>{S.E[k].t=null;dropSched(k)})}
function scheduleView(){
  const h=scheduleFull();
  if(!RO)return h;
  return h.replace(/^\s*<section class="card">[\s\S]*?<\/section>/,'')||'<section class="card"><p class="hint">No matches have been scheduled yet.</p></section>';
}
function scheduleFull(){
  const sc=S.sched,I={doubles:evInfo('doubles'),singles:evInfo('singles')};
  const ready=readyMatches();
  const info=(ev,id)=>{const X=I[ev];if(!X)return null;const m=allMatchesOf(X.t).find(m=>m.id===id);return m?{X,m,r:X.comp[id]}:null};
  const nm=(X,id)=>esc((X.ent[id]||{name:id}).name);
  const started=!!(S.E.doubles.t||S.E.singles.t);
  const off=new Set(sc.off||[]);
  let maxC=sc.courts;sc.slots.forEach(sl=>sl.items.forEach(i=>{if(i.court>maxC)maxC=i.court}));
  const cols=[];for(let c=1;c<=maxC;c++)cols.push(c);
  const st={},flag={};cols.forEach(c=>st[c]={tot:0,done:0,seen:0});
  sc.slots.forEach((sl,si)=>sl.items.forEach(it=>{
    const q=info(it.ev,it.id),s=st[it.court];if(!q||!s)return;
    s.tot++;if(q.r.w)s.done++;else{s.seen++;if(s.seen<=2)flag[si+':'+it.court]=s.seen===1?'now':'next'}
  }));
  const freeOf=sl=>{const used=new Set();sl.items.forEach(it=>it.players.forEach(p=>used.add(p)));return S.players.filter(p=>!used.has(p.id))};
  const evTxt=ev=>ev==='doubles'?'Doubles':'Singles',evCls=ev=>ev==='doubles'?'d':'s';
  const head=cols.map(c=>{
    const s=st[c],closed=off.has(c),gone=c>sc.courts;
    const title=RO?`<b>${esc(cname(c))}</b>`:`<input type="text" class="cn" aria-label="Name of court ${c}" data-chg="cname" data-c="${c}" value="${esc(cname(c))}">`;
    const tog=RO?(closed?'<span class="hint">Closed</span>':''):`<label class="chk"><input type="checkbox" data-chg="copen" data-c="${c}"${closed?'':' checked'}> Open</label>`;
    return `<div class="cg-h${closed?' off':''}">${title}${tog}<span class="hint">${s.done} of ${s.tot} played${gone?' · court removed':''}</span></div>`;
  }).join('');
  const cell=(sl,si,c)=>{
    const it=sl.items.find(i=>i.court===c),closed=off.has(c);
    if(!it){
      const can=!closed&&c<=sc.courts&&ready.length;
      return `<div class="cg-c empty${closed?' off':''}">${closed?'<span class="hint">Closed</span>':can&&!RO?`<button class="btn small" data-act="fill" data-s="${si}" data-c="${c}">Fill</button>`:'<span class="hint">Open</span>'}</div>`;
    }
    const q=info(it.ev,it.id);if(!q)return `<div class="cg-c empty"></div>`;
    const {X,m,r}=q,f=flag[si+':'+c];
    const mem=id=>{const e=X.ent[id];const t=e&&e.members&&e.members.length?e.members.join(' & '):'';return t&&t!==(e&&e.name)?`<span class="em">${esc(t)}</span>`:''};
    const res=r.w?`<span class="res done">${nm(X,r.w)} won${r.sa!=null&&r.sb!=null?' '+Math.max(r.sa,r.sb)+'–'+Math.min(r.sa,r.sb):''}</span>`:`<span class="res">${f==='now'?'On court now':f==='next'?'Up next':'Waiting for result'}</span>`;
    return `<div class="cg-c ev-${evCls(it.ev)}${r.w?' fin':''}${f?' '+f:''}"><div class="cg-top"><span class="pill ev-${evCls(it.ev)}">${evTxt(it.ev)}</span><span class="mn">M${m.n}</span>${f?`<span class="tag">${f==='now'?'NOW':'NEXT'}</span>`:''}<button class="x" aria-label="Take this match off the court" data-act="unitem" data-s="${si}" data-c="${c}">×</button></div><div class="cg-t1${r.w===r.a?' w':''}"><span class="en">${nm(X,r.a)}</span>${mem(r.a)}</div><div class="vs">vs</div><div class="cg-t1${r.w===r.b?' w':''}"><span class="en">${nm(X,r.b)}</span>${mem(r.b)}</div>${res}</div>`;
  };
  const grid=`<div class="cg" role="region" aria-label="Court board" tabindex="0"><div class="cgrid" style="grid-template-columns:5.5rem repeat(${cols.length},minmax(12rem,1fr))"><div class="cg-h cg-corner"></div>${head}${sc.slots.map((sl,si)=>{
    const fr=freeOf(sl);
    return `<div class="cg-t"><b>${slotTime(si)}</b><span class="hint">Slot ${si+1}</span><span class="hint" title="${esc(fr.map(p=>p.name).join(', ')||'Nobody')}">${fr.length} free</span></div>${cols.map(c=>cell(sl,si,c)).join('')}`;
  }).join('')}</div></div>`;
  const list=sc.slots.map((sl,si)=>{
    const rows=sl.items.map(it=>{
      const q=info(it.ev,it.id);if(!q)return '';
      const {X,m,r}=q;
      const res=r.w?`<span class="res done">${nm(X,r.w)} won${r.sa!=null&&r.sb!=null?' '+Math.max(r.sa,r.sb)+'–'+Math.min(r.sa,r.sb):''}</span>`:`<span class="res">Waiting for result</span>`;
      return `<li><span class="court">${esc(cname(it.court))}</span><span class="pill ev-${evCls(it.ev)}">${evTxt(it.ev)}</span><span class="mn">M${m.n}</span><span class="nm">${nm(X,r.a)} <span class="vs">vs</span> ${nm(X,r.b)}</span>${res}</li>`;
    }).join('');
    const fr=freeOf(sl);
    return `<section class="card slot-card"><header><h3>Slot ${si+1} · ${slotTime(si)}</h3><span class="hint">${sl.items.length} of ${openCourts().length} courts in use</span></header><ul class="list sl">${rows}</ul>${fr.length?`<p class="hint"><b>Free this slot (${fr.length}):</b> ${fr.map(p=>esc(p.name)).join(', ')}</p>`:''}</section>`;
  }).join('');
  const none=started?'<p class="hint">No slots yet. Press “Schedule next slot” to place the first matches on the courts.</p>':'<p class="hint">Start the doubles or singles event on the Bracket tab first.</p>';
  const tog=`<div class="vtog" role="group" aria-label="Schedule view"><button data-act="sv" data-v="court" aria-pressed="${SV==='court'}">By court</button><button data-act="sv" data-v="time" aria-pressed="${SV==='time'}">By time</button></div>`;
  const board=sc.slots.length?(SV==='court'?`<section class="card"><header><h2>Court board</h2>${tog}</header>${grid}<p class="hint"><span class="pill ev-d">Doubles</span> <span class="pill ev-s">Singles</span> The first unfinished match on each court is marked NOW.</p></section>`
    :`<section class="card"><header><h2>By time</h2>${tog}</header></section>${list}`):`<section class="card"><header><h2>Court board</h2></header>${none}</section>`;
  return `<section class="card"><header><h2>Court schedule</h2><span class="pill${ready.length?' on':''}">${ready.length} ready to play</span></header>
    <p class="hint">Each row is a time slot and each column a court. Doubles fill the courts first; leftover courts go to singles whose players are free. A team stays on its court when it can. Rename or close courts in the column headers, or press Fill on an empty court to place the best ready match there.</p>
    <div class="row">
      <div class="field"><label for="courts">Courts</label><input type="number" id="courts" min="1" max="12" data-chg="sched" data-k="courts" value="${sc.courts}" style="width:5rem"></div>
      <div class="field"><label for="sstart">First match</label><input type="time" id="sstart" data-chg="sched" data-k="start" value="${esc(sc.start)}"></div>
      <div class="field"><label for="slen">Minutes per slot</label><input type="number" id="slen" min="5" max="120" step="5" data-chg="sched" data-k="len" value="${sc.len}" style="width:6rem"></div>
    </div>
    <label class="row" style="gap:.4rem"><input type="checkbox" id="srest" data-chg="sched" data-k="rest"${sc.rest?' checked':''}> Avoid back-to-back matches for the same player</label>
    <div class="row"><button class="btn primary" data-act="slot"${started?'':' disabled'}>Schedule next slot</button><button class="btn" data-act="slotall"${started?'':' disabled'}>Schedule all ready</button><button class="btn" data-act="addslot"${started?'':' disabled'}>Add empty slot</button><button class="btn" data-act="unslot"${sc.slots.length?'':' disabled'}>Remove last slot</button></div>
  </section>${board}`;
}
function evSwitch(){
  const b=ev=>{
    const t=S.E[ev].t;let sub='Not started';
    if(t){const c=compute(t),pc=t.po?compute({matches:t.po.matches,results:t.results}):null,st=stats(t,c,pc);sub=st.played+' of '+st.total+' played'}
    return `<button class="segb" data-act="ev" data-ev="${ev}" aria-pressed="${S.ev===ev}"><b>${ev==='doubles'?'Doubles':'Singles'}</b><span>${sub}</span></button>`;
  };
  return `<div class="seg" role="group" aria-label="Event">${b('doubles')}${b('singles')}</div>`;
}

/* ----- actions ----- */
function startTournament(force){
  let ents;
  if(isD()){
    const bad=S.teams.filter(t=>t.members.length!==S.teamSize);
    if(bad.length){note('Every team needs '+S.teamSize+' players before you start. Fill or remove the incomplete teams.');return render()}
    ents=S.teams.map((t,i)=>({id:t.id,name:teamName(t,i),memberIds:t.members.slice(),members:t.members.map(m=>(P(m)||{}).name),skill:t.members.reduce((s,m)=>s+(P(m)||{skill:2}).skill,0)/Math.max(1,t.members.length)}));
  }else ents=S.players.filter(p=>p.singles!==false).map(p=>({id:p.id,name:p.name,members:[],memberIds:[p.id],skill:p.skill}));
  if(ents.length<2){note('You need at least 2 '+(isD()?'teams':'players')+' to start.');return render()}
  if(E().seeding==='random'||force)ents=shuffle(ents);
  if(E().seeding==='skill')ents=shuffle(ents).sort((a,b)=>b.skill-a.skill);
  const ids=ents.map(e=>e.id),f=E().format;
  const t={name:S.name+(isD()?' · Doubles':' · Singles'),format:f,mode:isD()?'teams':'singles',entrants:ents,matches:[],results:{},second:sty()==='second',style:f==='double'?dsty():sty(),po:null};
  t.qual=(f==='rr'||f==='swiss')&&E().qual>=2&&ents.length>=3?Math.min(E().qual,ents.length):0;
  if(f==='single'){t.matches=sty()==='fair'||sty()==='fairsecond'?buildFair(ids,sty()==='fairsecond'):buildElim(ids,false,t.second)}
  else if(f==='double')t.matches=dsty()==='fair'?buildFairDouble(ids):buildElim(ids,true);
  else if(f==='rr')t.matches=buildRR(ids);
  else{t.swissRounds=Math.max(1,Math.min(12,E().swissRounds||Math.ceil(Math.log2(Math.max(2,ids.length)))));t.round=0;t.matches=swissNext(t);t.round=1}
  dropSched(S.ev);E().t=t;S.tab='bracket';confirmReset=false;confirmRoll=false;note('');render();window.scrollTo(0,0);
}
function act(a,d){
  if(RO&&a!=='tab'&&a!=='ev'&&a!=='sv')return;
  if(a!=='dismiss')msg=msg&&a==='tab'?'':msg;
  switch(a){
    case 'tab':S.tab=d.tab;confirmReset=false;confirmRoll=false;msg='';break;
    case 'dismiss':msg='';break;
    case 'ev':S.ev=d.ev;confirmReset=false;confirmRoll=false;msg='';break;
    case 'slot':buildSlot();break;
    case 'unslot':S.sched.slots.pop();msg='';break;
    case 'slotall':buildAll();break;
    case 'addslot':S.sched.slots.push({items:[]});msg='';break;
    case 'fill':fillCell(+d.s,+d.c);break;
    case 'unitem':{const sl=S.sched.slots[+d.s];if(sl){sl.items=sl.items.filter(i=>i.court!==+d.c);if(!sl.items.length&&+d.s===S.sched.slots.length-1)S.sched.slots.pop()}msg='';break}
    case 'sv':SV=d.v==='time'?'time':'court';break;
    case 'pub':publishState();return;
    case 'tok':setToken();break;
    case 'dl':downloadState();break;
    case 'discard':discardDraft();break;
    case 'clearPlayers':S.players=[];S.teams=[];S.apart=[];S.sample=false;invalidate();break;
    case 'rmPlayer':invalidate();S.players=S.players.filter(p=>p.id!==d.id);S.teams.forEach(t=>t.members=t.members.filter(m=>m!==d.id));S.apart=S.apart.filter(r=>!r.includes(d.id));break;
    case 'bulkAdd':{
      const v=document.getElementById('bulk').value.split('\n').map(s=>s.trim()).filter(Boolean);let c=0;
      v.forEach(line=>{const m=line.match(/^(.*?)(?:\s*,\s*([1-3]))?$/);const nm=m[1].trim();if(nm){S.players.push({id:pid(),name:nm,skill:m[2]?+m[2]:2,singles:true});c++}});
      if(c)S.sample=false;note(c?c+' players added.':'Paste at least one name.');break}
    case 'addEmpty':S.teams.push({id:tid(),members:[]});invalidate('doubles');break;
    case 'addPre':{
      const lines=document.getElementById('pre').value.split('\n').map(s=>s.trim()).filter(Boolean);let c=0;
      lines.forEach(line=>{
        const names=line.split(/\s*(?:&|\/|\+|\band\b)\s*/i).map(s=>s.trim()).filter(Boolean).slice(0,S.teamSize);
        const ids=names.map(nm=>{let p=S.players.find(p=>p.name.toLowerCase()===nm.toLowerCase());if(!p){p={id:pid(),name:nm,skill:2};S.players.push(p)}return p.id});
        const taken=assigned();const mem=ids.filter(i=>!taken.has(i));
        if(mem.length){S.teams.push({id:tid(),members:mem});c++}
      });
      if(c){S.sample=false;invalidate('doubles')}note(c?c+' teams added.':'Write at least one team, like “Name & Name”.');break}
    case 'delTeam':S.teams=S.teams.filter(t=>t.id!==d.id);invalidate('doubles');break;
    case 'clearTeams':S.teams=[];invalidate('doubles');break;
    case 'resetNames':S.teams.forEach(t=>delete t.custom);break;
    case 'rmMember':{const t=S.teams.find(t=>t.id===d.t);t.members=t.members.filter(m=>m!==d.p);invalidate('doubles');break}
    case 'start':return startTournament();
    case 'reroll':{if(Object.keys(E().t.results).length){confirmRoll=true;break}return startTournament(true)}
    case 'doReroll':return startTournament(true);
    case 'cancelRoll':confirmRoll=false;break;
    case 'askReset':confirmReset=true;break;
    case 'cancelReset':confirmReset=false;break;
    case 'resetT':E().t=null;dropSched(S.ev);confirmReset=false;break;
    case 'nextRound':{const t=E().t;const ms=swissNext(t);t.round++;t.matches=t.matches.concat(ms);break}
    case 'win':{
      const t=E().t,comp=allComp(t),r=comp[d.m];if(!r||!r.a||!r.b)break;
      const cur=t.results[d.m];const same=cur&&cur.sig===r.a+'|'+r.b&&cur.mw===d.s&&cur.sa==null&&cur.sb==null;
      t.results[d.m]=same?{sig:r.a+'|'+r.b}:{sig:r.a+'|'+r.b,mw:d.s};break}
  }
  render();
}
function chg(a,d,el){
  if(RO)return;
  switch(a){
    case 'tname':S.name=el.value.trim()||'Tournament';break;
    case 'psingles':{const p=P(d.id);p.singles=el.checked;invalidate('singles');break}
    case 'cname':{const n=S.sched.names=S.sched.names||{};const v=el.value.trim();if(v&&v!=='Court '+d.c)n[d.c]=v;else delete n[d.c];break}
    case 'copen':{const o=new Set(S.sched.off||[]);if(el.checked)o.delete(+d.c);else o.add(+d.c);S.sched.off=[...o].sort((a,b)=>a-b);break}
    case 'sched':{const k=d.k;S.sched[k]=k==='rest'?el.checked:k==='start'?(el.value||'09:00'):Math.max(1,+el.value||1);break}
    case 'tsize':S.teamSize=+el.value;S.teams=[];invalidate('doubles');note('Team size changed, so the teams were cleared.');break;
    case 'pskill':P(d.id).skill=+el.value;break;
    case 'scheme':S.scheme=el.value;S.teams.forEach(t=>delete t.custom);break;
    case 'teamname':{const t=S.teams.find(t=>t.id===d.id);const i=S.teams.indexOf(t);const v=el.value.trim();if(!v||v===teamName({...t,custom:null},i))delete t.custom;else t.custom=v;break}
    case 'addMember':{if(!el.value)return;const t=S.teams.find(t=>t.id===d.t);if(t.members.length<S.teamSize&&!assigned().has(el.value))t.members.push(el.value);invalidate('doubles');break}
    case 'format':E().format=el.value;break;
    case 'style':E().style=el.value;E().second=el.value==='second';break;
    case 'qual':E().qual=+el.value;break;
    case 'seeding':E().seeding=el.value;break;
    case 'srounds':E().swissRounds=Math.max(1,Math.min(12,+el.value||1));break;
    case 'score':{
      const t=E().t,comp=allComp(t),r=comp[d.m];if(!r||!r.a||!r.b)return;
      const sig=r.a+'|'+r.b,cur=(t.results[d.m]&&t.results[d.m].sig===sig)?t.results[d.m]:{sig};
      cur[d.s==='a'?'sa':'sb']=el.value===''?null:Number(el.value);delete cur.mw;t.results[d.m]=cur;setTimeout(render,0);return}
  }
  render();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act,b.dataset)});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(el)chg(el.dataset.chg,el.dataset,el)});
document.addEventListener('submit',e=>{
  e.preventDefault();
  if(RO)return;
  if(e.target.id==='addForm'){
    const nm=document.getElementById('pName').value.trim();
    if(!nm){note('Type a name first.');return render()}
    S.players.push({id:pid(),name:nm,skill:+document.getElementById('pSkill').value});S.sample=false;msg='';render();
    const i=document.getElementById('pName');if(i)i.focus();
  }
});
boot();
