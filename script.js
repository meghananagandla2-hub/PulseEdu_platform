/* Student Success Platform - all data is synthetic and generated in the browser. */
const $ = s => document.querySelector(s);
const W = {acad:.25, att:.15, lms:.10, eng:.10, place:.25, skills:.10, fb:.05};
const LABEL = {acad:"Academics", att:"Attendance", lms:"LMS activity", eng:"Engagement", place:"Placement readiness", skills:"Skills", fb:"Feedback"};
const clamp = (v,a=0,b=100) => Math.max(a, Math.min(b, v));
const avg = a => a.reduce((x,y)=>x+y,0)/(a.length||1);
const median = a => { const s=[...a].sort((x,y)=>x-y); return s.length ? s[Math.floor(s.length/2)] : 0; };
const f0 = v => Math.round(v);

/* ---------- 1. Simulated source systems (messy on purpose) ---------- */
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd = mulberry(2026);
const gauss = () => Math.sqrt(-2*Math.log(rnd()+1e-9))*Math.cos(2*Math.PI*rnd());
const pick = a => a[Math.floor(rnd()*a.length)];

function buildSources(n=240){
  const depts=["CSE","ECE","MECH","CIVIL","MBA"], first=["Aarav","Diya","Rohan","Sneha","Karthik","Ananya","Vikram","Meera","Imran","Pooja","Arjun","Lakshmi","Sai","Nisha","Rahul","Priya","Harsha","Zoya","Varun","Kavya"],
        last=["Reddy","Sharma","Khan","Iyer","Naidu","Patel","Rao","Das","Verma","Nair"];
  const S={students:[],academic:[],attendance:[],lms:[],engagement:[],placement:[],skills:[],feedback:[]};
  const messy=(id,src)=> rnd()<.05 ? " "+id.toLowerCase()+" " : id;           // inconsistent IDs
  const hole=v=> rnd()<.06 ? null : v;                                          // missing values
  const dirty=(v,bad)=> rnd()<.015 ? bad : v;                                   // out-of-range entries
  for(let i=1;i<=n;i++){
    const id="S"+String(i).padStart(4,"0"), dept=pick(depts), sem=pick([3,4,5,6,7]);
    const ab=gauss(), eff=gauss()*.8+ab*.3, drv=gauss()*.8+ab*.35, mood=gauss();
    S.students.push({id,name:pick(first)+" "+pick(last),dept,sem});
    S.academic.push({id:messy(id),cgpa:hole(dirty(+clamp(6.9+.9*ab+.25*eff,4,9.9).toFixed(2),11.2)),backlogs:hole(Math.max(0,Math.round(1.2-1.1*ab-.3*eff+gauss()*.7))),marks:hole(clamp(66+9*ab+3*eff+gauss()*4))});
    S.attendance.push({id:messy(id),overall:hole(dirty(clamp(80+9*eff+3*ab+gauss()*5,35,100),104))});
    S.lms.push({id:messy(id),logins:hole(Math.max(0,Math.round(14+8*eff+gauss()*4))),assign:hole(clamp(70+14*eff+gauss()*8))});
    S.engagement.push({id:messy(id),events:hole(Math.max(0,Math.round(3+2.2*drv+gauss()))),clubs:hole(Math.max(0,Math.round(1.2+.9*drv+gauss()*.5))),hack:hole(Math.max(0,Math.round(1+1.1*drv+gauss()*.6))),certs:hole(Math.max(0,Math.round(1.8+1.3*drv+gauss()*.8)))});
    S.placement.push({id:messy(id),apt:hole(clamp(58+10*drv+5*ab+gauss()*7)),coding:hole(clamp(52+13*drv+6*ab+(dept==="CSE"?8:-4)+gauss()*8)),mock:hole(clamp(55+11*drv+gauss()*9))});
    S.skills.push({id:messy(id),tech:hole(clamp(58+10*drv+6*ab+gauss()*7)),soft:hole(clamp(62+8*drv+gauss()*9))});
    S.feedback.push({id:messy(id),sat:hole(+clamp(3.5+.5*mood+.2*eff,1,5).toFixed(1)),faculty:hole(+clamp(3.6+.4*eff+.2*mood,1,5).toFixed(1))});
  }
  for(let k=0;k<6;k++) S.lms.push({...pick(S.lms)});                          // duplicate rows
  return S;
}

/* ---------- 2. Integration + cleaning ---------- */
const DQ = {imputed:0, fixed:0, dupes:0, ids:0, rows:{}, missingBySrc:{}};
function integrate(S){
  const idx={};
  S.students.forEach(s=>idx[s.id]={...s});
  Object.keys(S).filter(k=>k!=="students").forEach(src=>{
    const seen=new Set(); DQ.rows[src]=S[src].length; DQ.missingBySrc[src]=0;
    S[src].forEach(r=>{
      const id=r.id.trim().toUpperCase(); if(id!==r.id) DQ.ids++;
      if(seen.has(id)){DQ.dupes++;return;} seen.add(id);
      Object.entries(r).forEach(([k,v])=>{ if(k!=="id") idx[id][k]=v; });
    });
  });
  const rows=Object.values(idx);
  const ranges={cgpa:[0,10],att:[0,100],overall:[0,100]};
  rows.forEach(r=>{ if(r.cgpa>10){r.cgpa=10;DQ.fixed++;} if(r.overall>100){r.overall=100;DQ.fixed++;} });
  const fields=["cgpa","backlogs","marks","overall","logins","assign","events","clubs","hack","certs","apt","coding","mock","tech","soft","sat","faculty"];
  const med={};
  fields.forEach(f=>{ med[f]={}; depts(rows).forEach(d=>med[f][d]=median(rows.filter(r=>r.dept===d&&r[f]!=null).map(r=>r[f]))); });
  rows.forEach(r=>fields.forEach(f=>{ if(r[f]==null){ r[f]=med[f][r.dept]; r._imp=(r._imp||0)+1; DQ.imputed++; } }));
  return rows;
}
const depts = rows => [...new Set(rows.map(r=>r.dept))].sort();

/* ---------- 3. Success Score, risk flags, segments ---------- */
function scoreAll(rows){
  rows.forEach(r=>{
    r.acad = clamp(.7*r.cgpa*10 + .3*r.marks - 6*r.backlogs);
    r.att  = clamp(r.overall);
    r.lms  = clamp(.5*Math.min(r.logins/25,1)*100 + .5*r.assign);
    r.eng  = clamp(Math.min(r.events/8,1)*30 + Math.min(r.clubs/3,1)*20 + Math.min(r.hack/3,1)*25 + Math.min(r.certs/4,1)*25);
    r.place= clamp(.35*r.apt + .35*r.coding + .30*r.mock);
    r.skills=clamp(.6*r.tech + .4*r.soft);
    r.fb   = clamp((r.sat/5*100 + r.faculty/5*100)/2);
    r.score= Object.keys(W).reduce((t,k)=>t+W[k]*r[k],0);
  });
  const mean={}; Object.keys(W).forEach(k=>mean[k]=avg(rows.map(r=>r[k])));
  rows.forEach(r=>{
    r.drivers = Object.keys(W).map(k=>({k, pts:W[k]*(r[k]-mean[k])})).sort((a,b)=>Math.abs(b.pts)-Math.abs(a.pts));
    r.why = [];
    if(r.acad<48) r.why.push(["acad",`Academic component ${f0(r.acad)}/100 (CGPA ${r.cgpa.toFixed(1)}, ${r.backlogs} backlogs)`]);
    if(r.att<70)  r.why.push(["acad",`Attendance ${f0(r.att)}% is below 70%, close to the 75% exam eligibility line`]);
    if(r.backlogs>=3) r.why.push(["acad",`${r.backlogs} active backlogs`]);
    if(r.place<44) r.why.push(["place",`Placement readiness ${f0(r.place)}/100 (aptitude ${f0(r.apt)}, coding ${f0(r.coding)}, mock ${f0(r.mock)})`]);
    if(r.skills<44) r.why.push(["place",`Skills score ${f0(r.skills)}/100`]);
    r.rAcad = r.why.some(w=>w[0]==="acad"); r.rPlace = r.why.some(w=>w[0]==="place");
    r.risk = r.rAcad&&r.rPlace ? "both" : r.rAcad ? "acad" : r.rPlace ? "place" : "none";
    r.seg = r.att<75 && r.lms<50 ? "Disengaged and slipping"
          : r.acad<55 && (r.lms+r.eng)/2>=50 ? "Working hard, needs academic support"
          : r.acad>=68 && r.place<55 ? "High academics, low placement readiness"
          : r.score>=66 && r.place>=62 ? "Placement-ready achievers" : "Steady middle";
  });
  return rows;
}
const SEG = {
  "High academics, low placement readiness":["Aptitude and coding bootcamps, mock interviews, resume clinics."],
  "Working hard, needs academic support":["Peer tutoring, remedial classes, backlog clearing plan. Effort is there; method is not."],
  "Disengaged and slipping":["Mentor call within a week, parent contact, attendance recovery plan, LMS nudges."],
  "Placement-ready achievers":["Fast-track to top recruiters, leadership roles, peer-mentoring others."],
  "Steady middle":["Monitor each term; invite to skill workshops and hackathons."]
};
const ACTIONS = {
  acad:["Assign a faculty mentor and schedule a weekly check-in.","Enrol in remedial classes for failing subjects."],
  att:["Send an attendance warning and set a recovery target before exams."],
  place:["Enrol in aptitude and coding practice with weekly mock tests.","Book two mock interviews this month."],
  lms:["Nudge on pending LMS assignments; check for access problems."],
  eng:["Invite to a club, hackathon or certification drive."],
  skills:["Assign a skill-gap course (technical or soft skills)."],
  fb:["Hold a short feedback conversation to understand dissatisfaction."]
};

/* ---------- 4. State, filters, rendering ---------- */
let ALL, VIEW, sortK="score", sortDir=1;
const state={q:"",dept:"",risk:"",seg:""};
const riskColor=r=>r==="both"?"#8e1f17":r==="acad"?"var(--red)":r==="place"?"var(--amber)":"var(--green)";

function applyFilters(){
  VIEW = ALL.filter(r=>
    (!state.q || (r.name+r.id).toLowerCase().includes(state.q)) &&
    (!state.dept || r.dept===state.dept) &&
    (!state.seg || r.seg===state.seg) &&
    (!state.risk || (state.risk==="any"?r.risk!=="none": state.risk==="none"?r.risk==="none": state.risk==="acad"?r.rAcad:r.rPlace)));
  VIEW.sort((a,b)=> (typeof a[sortK]==="string" ? a[sortK].localeCompare(b[sortK]) : a[sortK]-b[sortK])*sortDir);
  renderAll();
}
function renderAll(){ kpis(); histo(); deptRisk(); scatter(); segs(); insights(); table(); }

function kpis(){
  const n=VIEW.length||1, c=f=>VIEW.filter(f).length;
  const items=[["Students",VIEW.length,""],["Average Success Score",f0(avg(VIEW.map(r=>r.score))),""],
    ["Academic risk",c(r=>r.rAcad)+` (${f0(100*c(r=>r.rAcad)/n)}%)`,"r"],["Placement risk",c(r=>r.rPlace)+` (${f0(100*c(r=>r.rPlace)/n)}%)`,"a"],
    ["Both risks",c(r=>r.risk==="both"),"r"],["Avg attendance",f0(avg(VIEW.map(r=>r.att)))+"%",""]];
  $("#kpis").innerHTML=items.map(i=>`<div class="kpi ${i[2]}"><b>${i[1]}</b><span>${i[0]}</span></div>`).join("");
}
function histo(){
  const bins=Array(8).fill(0); VIEW.forEach(r=>bins[Math.max(0,Math.min(7,Math.floor((r.score-20)/10)))]++);
  const m=Math.max(...bins,1);
  $("#histo").innerHTML=bins.map((b,i)=>`<div title="${b} students"><span>${b}</span><i style="height:${b/m*130}px;${i<3?'background:var(--red)':i<4?'background:var(--amber)':''}"></i><span>${20+i*10}s</span></div>`).join("");
}
function deptRisk(){
  $("#deptRisk").innerHTML=depts(ALL).map(d=>{
    const g=VIEW.filter(r=>r.dept===d), n=g.length||1, p=k=>100*g.filter(r=>r.risk===k).length/n;
    return `<div class="bar"><span>${d}</span><div class="track"><i style="width:${p("both")}%;background:#8e1f17"></i><i style="width:${p("acad")}%;background:var(--red)"></i><i style="width:${p("place")}%;background:var(--amber)"></i></div><span>${f0(100-p("none")-0)}%</span></div>`;}).join("")
    +`<p class="hint">Dark red = both risks, red = academic only, amber = placement only.</p>`;
}
function scatter(){
  const w=640,h=330,m=38,X=v=>m+(v/100)*(w-m-10),Y=v=>h-m-(v/100)*(h-m-10);
  let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Scatter of academic strength vs placement readiness">
  <rect x="${X(68)}" y="${Y(55)-(Y(55)-Y(100))}" width="${X(100)-X(68)}" height="${Y(55)-Y(100)}" fill="none"/>
  <rect x="${X(68)}" y="${Y(55)}" width="${X(100)-X(68)}" height="${Y(0)-Y(55)}" fill="var(--amber)" opacity=".12"/>
  <text x="${X(69)}" y="${Y(8)}" font-size="12" fill="var(--mute)">High academics, low placement readiness</text>
  <line x1="${X(55)}" x2="${X(55)}" y1="${Y(0)}" y2="${Y(100)}" stroke="var(--line)" stroke-dasharray="4"/><line x1="${X(0)}" x2="${X(100)}" y1="${Y(55)}" y2="${Y(55)}" stroke="var(--line)" stroke-dasharray="4"/>
  <line x1="${m}" x2="${w-10}" y1="${h-m}" y2="${h-m}" stroke="var(--mute)"/><line x1="${m}" x2="${m}" y1="${h-m}" y2="10" stroke="var(--mute)"/>
  <text x="${w/2}" y="${h-8}" font-size="12" fill="var(--mute)" text-anchor="middle">Academic component (0-100)</text>
  <text transform="translate(12 ${h/2}) rotate(-90)" font-size="12" fill="var(--mute)" text-anchor="middle">Placement readiness</text>`;
  VIEW.forEach(r=>s+=`<circle cx="${X(r.acad)}" cy="${Y(r.place)}" r="5" fill="${riskColor(r.risk)}" fill-opacity=".75" stroke="#fff" stroke-width=".6" data-id="${r.id}" style="cursor:pointer"><title>${r.name}: Academic ${f0(r.acad)}, Placement ${f0(r.place)}</title></circle>`);
  $("#scatter").innerHTML=s+"</svg>";
  $("#scatter").querySelectorAll("circle").forEach(c=>c.onclick=()=>openStudent(c.dataset.id));
}
function segs(){
  const base=ALL.filter(r=>(!state.dept||r.dept===state.dept));
  $("#segs").innerHTML=Object.keys(SEG).map(k=>{
    const n=base.filter(r=>r.seg===k).length;
    return `<button class="seg ${state.seg===k?"on":""}" data-s="${k}">${k} (${n})<small>${SEG[k][0]}</small></button>`;}).join("");
  $("#segs").querySelectorAll(".seg").forEach(b=>b.onclick=()=>{state.seg=state.seg===b.dataset.s?"":b.dataset.s;$("#fSeg").value=state.seg;applyFilters();});
}
function corr(a,b){const ma=avg(a),mb=avg(b);let n=0,da=0,db=0;a.forEach((x,i)=>{n+=(x-ma)*(b[i]-mb);da+=(x-ma)**2;db+=(b[i]-mb)**2});return n/Math.sqrt(da*db||1)}
function insights(){
  if(VIEW.length<10){$("#insights").innerHTML="<li>Too few students in this filter for reliable insights. Clear a filter.</li>";return;}
  const L=[], v=VIEW, n=v.length;
  const worst=depts(v).map(d=>{const g=v.filter(r=>r.dept===d);return[d,g.filter(r=>r.risk!=="none").length/(g.length||1),g.length]}).filter(x=>x[2]>4).sort((a,b)=>b[1]-a[1])[0];
  if(worst) L.push(`<b>${worst[0]}</b> has the highest share of at-risk students (${f0(worst[1]*100)}%). Start department-level reviews there.`);
  const lowAtt=v.filter(r=>r.att<75), bk=lowAtt.length?avg(lowAtt.map(r=>r.backlogs)):0, bk2=avg(v.filter(r=>r.att>=75).map(r=>r.backlogs));
  L.push(`Students below 75% attendance carry ${bk.toFixed(1)} backlogs on average versus ${bk2.toFixed(1)} for the rest. Attendance is an early warning for academic trouble.`);
  L.push(`LMS activity and academic strength correlate at r = ${corr(v.map(r=>r.lms),v.map(r=>r.acad)).toFixed(2)}. Falling logins are a usable weekly signal.`);
  const hl=v.filter(r=>r.seg.startsWith("High academics")).length;
  L.push(`${hl} students (${f0(100*hl/n)}%) have strong academics but weak placement readiness. Good grades alone do not guarantee placement.`);
  const act=v.filter(r=>r.hack+r.certs>=4), pas=v.filter(r=>r.hack+r.certs<=1);
  if(act.length>3&&pas.length>3) L.push(`Students active in hackathons and certifications score ${f0(avg(act.map(r=>r.place)))} on placement readiness versus ${f0(avg(pas.map(r=>r.place)))} for inactive students.`);
  const top=v.filter(r=>r.risk!=="none").sort((a,b)=>a.score-b.score).slice(0,3).map(r=>r.name).join(", ");
  L.push(`Highest priority for outreach now: ${top||"none flagged"}.`);
  $("#insights").innerHTML=L.map(x=>`<li>${x}</li>`).join("");
}
function table(){
  $("#count").textContent=`(${VIEW.length})`;
  $("#tbl tbody").innerHTML=VIEW.map(r=>`<tr data-id="${r.id}"><td>${r.name}<br><small>${r.id}, sem ${r.sem}</small></td><td>${r.dept}</td>
    <td><div class="sc"><b>${f0(r.score)}</b><i style="width:${r.score*.6}px;background:${r.score<50?"var(--red)":r.score<62?"var(--amber)":"var(--green)"}"></i></div></td>
    <td>${f0(r.acad)}</td><td>${f0(r.att)}%</td><td>${f0(r.place)}</td><td>${f0(r.eng)}</td>
    <td>${r.rAcad?'<span class="tag acad">Academic</span>':""}${r.rPlace?'<span class="tag place">Placement</span>':""}${r.risk==="none"?'<span class="tag ok">On track</span>':""}</td><td>${r.seg}</td></tr>`).join("")
    || `<tr><td colspan="9">No students match these filters. Clear a filter to see more.</td></tr>`;
  $("#tbl tbody").querySelectorAll("tr[data-id]").forEach(tr=>tr.onclick=()=>openStudent(tr.dataset.id));
}
function openStudent(id){
  const r=ALL.find(x=>x.id===id), mx=8;
  $("#detail").innerHTML=`<h2>${r.name}</h2><p class="sub">${r.id} · ${r.dept} · Semester ${r.sem}${r._imp?` · ${r._imp} missing values estimated`:""}</p>
  <div class="kpi ${r.risk==="none"?"":"r"}"><b>${f0(r.score)}<small style="font-size:14px"> / 100</small></b><span>Success Score · ${r.seg}</span></div>
  <h2 style="margin-top:14px">Why this score</h2><p class="hint">Points gained or lost versus the average student, after weighting.</p>
  ${r.drivers.map(d=>{const p=d.pts,wd=Math.min(Math.abs(p)/mx,1)*50;return `<div class="drow"><span>${LABEL[d.k]}</span><div class="div"><i style="${p>=0?`left:50%;width:${wd}%;background:var(--green)`:`right:50%;width:${wd}%;background:var(--red)`}"></i></div><b>${p>0?"+":""}${p.toFixed(1)}</b></div>`}).join("")}
  <h2 style="margin-top:14px">Why flagged</h2>${r.why.length?r.why.map(w=>`<div class="act"><span class="tag ${w[0]}">${w[0]==="acad"?"Academic":"Placement"}</span>${w[1]}</div>`).join(""):"<p>No risk rules triggered.</p>"}
  <h2 style="margin-top:14px">Suggested actions</h2>${suggest(r).map(a=>`<div class="act">${a}</div>`).join("")}
  <h2 style="margin-top:14px">Source data</h2><div class="kv">
  <span>CGPA</span><b>${r.cgpa.toFixed(2)}</b><span>Backlogs</span><b>${r.backlogs}</b><span>Attendance</span><b>${f0(r.att)}%</b><span>LMS logins/mo</span><b>${r.logins}</b>
  <span>Assignments done</span><b>${f0(r.assign)}%</b><span>Events / clubs</span><b>${r.events} / ${r.clubs}</b><span>Hackathons / certs</span><b>${r.hack} / ${r.certs}</b>
  <span>Aptitude / coding</span><b>${f0(r.apt)} / ${f0(r.coding)}</b><span>Mock interview</span><b>${f0(r.mock)}</b><span>Tech / soft skills</span><b>${f0(r.tech)} / ${f0(r.soft)}</b>
  <span>Satisfaction</span><b>${r.sat}/5</b><span>Faculty feedback</span><b>${r.faculty}/5</b></div>`;
  $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden","false");
}
function suggest(r){
  const out=[...SEG[r.seg]]; r.drivers.filter(d=>d.pts<-1.2).slice(0,3).forEach(d=>out.push(ACTIONS[d.k][0]));
  return [...new Set(out)];
}
function exportCSV(){
  const rows=VIEW.filter(r=>r.risk!=="none"), head=["ID","Name","Dept","Sem","Score","Academic risk","Placement risk","Segment","Reasons"];
  const csv=[head,...rows.map(r=>[r.id,r.name,r.dept,r.sem,f0(r.score),r.rAcad,r.rPlace,r.seg,r.why.map(w=>w[1]).join("; ")])].map(a=>a.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="at-risk-students.csv"; a.click();
}
function notes(){
  const srcs={academic:"CGPA, marks, backlogs",attendance:"Overall %",lms:"Logins, assignments",engagement:"Events, clubs, hackathons, certs",placement:"Aptitude, coding, mock",skills:"Technical, soft",feedback:"Satisfaction, faculty"};
  $("#dq").innerHTML=`<p>Each source system keys students slightly differently. We trim and upper-case IDs, drop duplicate rows, cap impossible values, then fill gaps with the department median and record the count per student.</p>
  <table><thead><tr><th>Source</th><th>Fields</th><th>Rows received</th></tr></thead><tbody>${Object.keys(srcs).map(k=>`<tr><td>${k}</td><td>${srcs[k]}</td><td>${DQ.rows[k]}</td></tr>`).join("")}</tbody></table>
  <p><b>${DQ.ids}</b> IDs normalised · <b>${DQ.dupes}</b> duplicate rows removed · <b>${DQ.fixed}</b> out-of-range values capped · <b>${DQ.imputed}</b> missing values estimated.</p>`;
  $("#method").innerHTML=`<p>Success Score = sum of weighted components, each scaled 0-100.</p><table><thead><tr><th>Component</th><th>Weight</th><th>Built from</th></tr></thead><tbody>
  <tr><td>Academics</td><td>25%</td><td>70% CGPA×10 + 30% average marks − 6 points per backlog</td></tr>
  <tr><td>Placement readiness</td><td>25%</td><td>35% aptitude + 35% coding + 30% mock interview</td></tr>
  <tr><td>Attendance</td><td>15%</td><td>Overall attendance %</td></tr>
  <tr><td>LMS activity</td><td>10%</td><td>50% login frequency (25 a month = full) + 50% assignment completion</td></tr>
  <tr><td>Engagement</td><td>10%</td><td>Events, clubs, hackathons, certifications, each capped</td></tr>
  <tr><td>Skills</td><td>10%</td><td>60% technical + 40% soft-skill assessment</td></tr>
  <tr><td>Feedback</td><td>5%</td><td>Student satisfaction and faculty feedback</td></tr></tbody></table>
  <p><b>Academic risk</b>: academic component under 48, attendance under 70%, or 3+ backlogs. <b>Placement risk</b>: placement readiness or skills under 44. Rules are used for flags (so each reason is stated plainly); the score ranks overall health. Weights live in the <code>W</code> object in script.js and can be tuned by the college.</p>`;
}

/* ---------- 5. Boot ---------- */
ALL = scoreAll(integrate(buildSources(240)));
const dl=(sel,first,vals)=>{$(sel).innerHTML=`<option value="">${first}</option>`+vals.map(v=>`<option>${v}</option>`).join("")};
dl("#fDept","All departments",depts(ALL)); dl("#fSeg","All segments",Object.keys(SEG));
$("#q").oninput=e=>{state.q=e.target.value.toLowerCase();applyFilters()};
$("#fDept").onchange=e=>{state.dept=e.target.value;applyFilters()};
$("#fRisk").onchange=e=>{state.risk=e.target.value;applyFilters()};
$("#fSeg").onchange=e=>{state.seg=e.target.value;applyFilters()};
$("#reset").onclick=()=>{Object.assign(state,{q:"",dept:"",risk:"",seg:""});$("#q").value="";["#fDept","#fRisk","#fSeg"].forEach(s=>$(s).value="");applyFilters()};
$("#export").onclick=exportCSV;
$("#close").onclick=()=>{$("#drawer").classList.remove("open")};
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#drawer").classList.remove("open")});
document.querySelectorAll("th[data-k]").forEach(th=>th.onclick=()=>{const k=th.dataset.k;sortDir=sortK===k?-sortDir:(k==="name"||k==="dept"?1:-1);sortK=k;applyFilters()});
notes(); sortDir=1; applyFilters();
