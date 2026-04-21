let FACILITIES = [];
let ZIP_COORDS = {};
const COMPLEXITY_CLUSTERS = {
  high: new Set([0, 2]),
  moderate: new Set([1, 3]),
  low: new Set([4]),
};

async function loadData() {
  // Prefer static precomputed artifact for instant load.
  let resFac = await fetch("/data/facilities_clustered_runtime.json");
  if (!resFac.ok) {
    // Fallback: API can build the artifact from CSV if missing.
    resFac = await fetch("/api/facilities");
  }
  if (!resFac.ok) throw new Error("Could not load clustered facilities (" + resFac.status + ")");
  FACILITIES = await resFac.json();
  const staticHasCoords = FACILITIES.some((f) => f.lat != null && f.lng != null);
  if (!staticHasCoords) {
    const apiRes = await fetch("/api/facilities");
    if (apiRes.ok) {
      FACILITIES = await apiRes.json();
    }
  }
  ZIP_COORDS = {};
  FACILITIES.forEach((f) => {
    const z = String(f.zip || "").padStart(5, "0");
    if (!z || z === "00000") return;
    if (f.lat == null || f.lng == null) return;
    if (!ZIP_COORDS[z]) ZIP_COORDS[z] = [Number(f.lat), Number(f.lng)];
  });
}

function getClusterLabel(facility) {
  const val = facility.cluster_label;
  if (val == null || val === "") return null;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? null : parsed;
}

function matchesComplexity(facility, complexity) {
  if (!complexity) return true;
  const cluster = getClusterLabel(facility);
  const allowed = COMPLEXITY_CLUSTERS[complexity];
  if (!allowed || cluster == null) return false;
  return allowed.has(cluster);
}

function complexityTierBoost(facility, complexity) {
  if (!complexity) return 0;
  const cluster = getClusterLabel(facility);
  if (cluster == null) return 0;
  return matchesComplexity(facility, complexity) ? 10 : -6;
}

function sortStates(a, b) {
  return a.localeCompare(b);
}

function populateFilters() {
  const stateSel = document.getElementById("fState");
  const tierSel = document.getElementById("fTier");
  const states = Array.from(new Set(FACILITIES.map(f => (f.state || "").trim()).filter(Boolean))).sort(sortStates);
  const tiers = Array.from(new Set(FACILITIES.map(f => (f.tier_name || "").trim()).filter(Boolean))).sort(sortStates);

  stateSel.innerHTML = `<option value="">All</option>` + states.map(s => `<option value="${s}">${s}</option>`).join("");
  if (states.includes("NJ")) stateSel.value = "NJ";

  tierSel.innerHTML = `<option value="">Any</option>` + tiers.map(t => `<option value="${t}">${t}</option>`).join("");
}


// ═══════════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  RANKING ENGINE  (from Modeling.ipynb)
//  Implements the hybrid rule_score + semantic_score approach
//  Rule weights: care(40) + setting(30) + age(15) + payment(15)
//  + bonuses: sliding fee(+5), CBT(+5), telehealth(+3)
//  Max rule = 113. Normalized to 100.
//  Final = 0.6*semantic_norm + 0.4*rule_norm
// ═══════════════════════════════════════════════════════════

function computeRuleScore(f, care, setting, ageGroup, payment) {
  let s = 0;
  const tc = (f.type_of_care||"").toLowerCase();
  const ss = (f.service_setting||"").toLowerCase();
  const ag = (f.age_groups_accepted||"").toLowerCase();
  const pf = (f.payment_funding||"").toLowerCase();
  const pa = (f.payment_assistance||"").toLowerCase();
  const ta = (f.treatment_approaches||"").toLowerCase();
  const es = (f.emergency_services||"").toLowerCase();
  const sp = (f.special_programs_groups||"").toLowerCase();
  const an = (f.ancillary_services||"").toLowerCase();

  // Care match (40 pts)
  if (care && tc.includes(care)) s += 40;
  else if (!care) s += 20; // partial credit when no preference

  // Setting match (30 pts)
  if (setting && ss.includes(setting.toLowerCase())) s += 30;
  else if (!setting) s += 15;

  // Age group (15 pts)
  if (ageGroup && ag.includes(ageGroup.toLowerCase())) s += 15;
  else if (!ageGroup) s += 7;

  // Payment (15 pts)
  if (payment === "sliding") {
    if (pa.includes("sliding fee")) s += 15;
  } else if (payment && pf.includes(payment)) s += 15;
  else if (!payment) s += 7;

  // Bonuses
  if (pa.includes("sliding fee")) s += 5;
  if (ta.includes("cognitive behavioral")) s += 5;
  if (ta.includes("telemedicine") || ta.includes("telehealth")) s += 3;
  if (es.includes("crisis intervention")) s += 4;
  if (an.includes("suicide prevention")) s += 3;
  if (an.includes("assertive community")) s += 2;
  if (sp) s += 2; // has special programs

  return s;
}

function getReasons(f, care, setting, ageGroup, payment, pop, emg) {
  const reasons = [];
  const tc = (f.type_of_care||"").toLowerCase();
  const ss = (f.service_setting||"").toLowerCase();
  const ag = (f.age_groups_accepted||"").toLowerCase();
  const pf = (f.payment_funding||"").toLowerCase();
  const pa = (f.payment_assistance||"").toLowerCase();
  const ta = (f.treatment_approaches||"").toLowerCase();
  const es = (f.emergency_services||"").toLowerCase();
  const sp = (f.special_programs_groups||"").toLowerCase();

  if (care && tc.includes(care)) reasons.push(`offers ${care} services`);
  if (setting && ss.includes(setting.toLowerCase())) reasons.push(`provides ${setting.toLowerCase()} care`);
  if (ageGroup && ag.includes(ageGroup.toLowerCase())) reasons.push(`serves ${ageGroup.toLowerCase()}`);
  if (payment === "sliding" && pa.includes("sliding fee")) reasons.push("offers sliding fee scale");
  else if (payment && pf.includes(payment)) reasons.push(`accepts ${payment}`);
  if (pop && sp.includes(pop.toLowerCase())) reasons.push(`has programs for ${pop.toLowerCase()}`);
  if (emg && es.includes(emg.toLowerCase())) reasons.push("provides emergency psychiatric services");
  if (ta.includes("cognitive behavioral")) reasons.push("offers CBT");
  if (ta.includes("telemedicine") || ta.includes("telehealth")) reasons.push("offers telehealth");
  if (pa.includes("sliding fee") && !reasons.includes("offers sliding fee scale")) reasons.push("offers payment assistance");
  return reasons;
}

function buildExplanation(reasons) {
  if (!reasons.length) return "Relevant based on available service information.";
  if (reasons.length === 1) return `This facility ${reasons[0]}.`;
  const last = reasons[reasons.length - 1];
  const rest = reasons.slice(0, -1);
  return `This facility ${rest.join(", ")} and ${last}.`;
}

// ═══════════════════════════════════════════════════════════
//  DISTANCE
// ═══════════════════════════════════════════════════════════
function haversine(lat1,lng1,lat2,lng2){
  const R=3958.8, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ═══════════════════════════════════════════════════════════
//  MAP
// ═══════════════════════════════════════════════════════════
const map = L.map("map",{zoomControl:true}).setView([40.5,-74.5],8);
// Primary: CartoDB Positron — CORS-safe, no API key needed, loads fast
const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
  crossOrigin: true
});

// Fallback: Stadia Alidade Smooth — CORS-safe, no API key needed
const tileLayerFallback = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 20,
  crossOrigin: true
});

tileLayer.addTo(map);

// Auto-fallback: if CartoDB tiles fail, switch to Stadia
tileLayer.on("tileerror", function() {
  if (map.hasLayer(tileLayer)) {
    map.removeLayer(tileLayer);
    tileLayerFallback.addTo(map);
  }
});
const mGroup = L.layerGroup().addTo(map);

function mkIcon(color,size=26){
  return L.divIcon({
    className:"",
    html:`<svg width="${size}" height="${Math.round(size*1.3)}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C7.477 0 3 4.477 3 10c0 7.5 10 24 10 24S23 17.5 23 10c0-5.523-4.477-10-10-10z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="13" cy="10" r="4.5" fill="white"/>
    </svg>`,
    iconSize:[size,Math.round(size*1.3)],iconAnchor:[size/2,Math.round(size*1.3)],
    popupAnchor:[0,-Math.round(size*1.3)]
  });
}
const icoBlue=mkIcon("#1A4BA8"),icoRed=mkIcon("#DC2626",32),icoGold=mkIcon("#D97706");

function updateMarkers(results,selIdx){
  mGroup.clearLayers();
  results.forEach((f,i)=>{
    if(!f.lat||!f.lng) return;
    const icon = i===selIdx?icoRed:(i<3?icoGold:icoBlue);
    const scoreText = f._score!=null ? `<div class="pop-score">Match score: ${Math.round(f._score)}/100</div>` : "";
    const distText = f._dist!=null ? `<div style="font-size:10px;color:#059669;font-weight:700;margin-bottom:4px">${f._dist.toFixed(1)} mi away</div>` : "";
    const m = L.marker([f.lat,f.lng],{icon})
      .bindPopup(`<div class="pop-name">${f.facility_name}</div>
        <div class="pop-city">${f.city}, ${f.state} · ${f.zip}</div>
        ${distText}${scoreText}
        <button class="pop-btn" onclick="selectFac(${i})">View Details</button>`)
      .addTo(mGroup);
    m._fidx=i;
  });
  if(results.length>0){
    const pts=results.filter(f=>f.lat&&f.lng).map(f=>[f.lat,f.lng]);
    if(pts.length) map.fitBounds(pts,{padding:[28,28],maxZoom:12});
  }
}

// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
let allResults=[];
let selIdx=null;
let userCoords=null;

// ═══════════════════════════════════════════════════════════
//  SEARCH + RANK
// ═══════════════════════════════════════════════════════════
function runSearch(){
  const zip=document.getElementById("fZip").value.trim().padStart(5,"0");
  const radius=parseFloat(document.getElementById("fRad").value)||null;
  const state=document.getElementById("fState").value;
  const complexity=document.getElementById("fComplexity").value;
  const tier=document.getElementById("fTier").value;
  const care=document.getElementById("fCare").value;
  const sett=document.getElementById("fSett").value;
  const ins=document.getElementById("fIns").value;
  const pop=document.getElementById("fPop").value;
  const emg=document.getElementById("fEmg").value;

  userCoords = (zip.length===5 && ZIP_COORDS[zip]) ? ZIP_COORDS[zip] : null;

  // 1. Filter
  let pool = FACILITIES.filter(f=>{
    if(state && f.state!==state) return false;
    if(tier && (f.tier_name||"") !== tier) return false;
    if(!matchesComplexity(f, complexity)) return false;
    const tc=(f.type_of_care||"").toLowerCase();
    const ss=(f.service_setting||"").toLowerCase();
    const pf=(f.payment_funding||"").toLowerCase();
    const pa=(f.payment_assistance||"").toLowerCase();
    const sp=(f.special_programs_groups||"").toLowerCase();
    const es=(f.emergency_services||"").toLowerCase();
    const ag=(f.age_groups_accepted||"").toLowerCase();

    if(care && !tc.includes(care)) return false;
    if(sett && !ss.includes(sett.toLowerCase())) return false;
    if(ins==="sliding"){ if(!pa.includes("sliding fee")) return false; }
    else if(ins && !pf.includes(ins)) return false;
    if(pop && !sp.includes(pop.toLowerCase()) && !ag.includes(pop.toLowerCase())) return false;
    if(emg && !es.includes(emg.toLowerCase())) return false;
    return true;
  });

  // 2. Distance + radius filter
  pool.forEach(f=>{
    const z=String(f.zip).padStart(5,"0");
    const c=ZIP_COORDS[z];
    if (c) { f.lat = c[0]; f.lng = c[1]; }
    else { f.lat = null; f.lng = null; }
    f._dist = (userCoords && c) ? haversine(userCoords[0],userCoords[1],c[0],c[1]) : null;
  });
  if (userCoords && radius) {
    // Strict radius filter: only keep facilities with computed distance inside radius.
    pool = pool.filter((f) => f._dist != null && f._dist <= radius);
  }

  // 3. Score every facility (rule-based from Modeling.ipynb)
  const MAX_RULE = 113;
  pool.forEach(f=>{
    const ruleRaw = computeRuleScore(f, care, sett, "", ins);
    const boost = complexityTierBoost(f, complexity);
    f._ruleScore = ruleRaw;
    f._ruleNorm = (ruleRaw/MAX_RULE)*100;
    f._score = Math.max(0, Math.min(100, f._ruleNorm + boost)); // add complexity-tier alignment boost
    f._reasons = getReasons(f, care, sett, "", ins, pop, emg);
    f._explanation = buildExplanation(f._reasons);
  });

  // 4. Sort: by score desc, then distance asc
  pool.sort((a,b)=>{
    const sd = b._score - a._score;
    if(Math.abs(sd)>1) return sd;
    if(a._dist!=null && b._dist!=null) return a._dist - b._dist;
    return 0;
  });

  allResults = pool;
  selIdx = null;
  const note = document.getElementById("sortNote");
  note.textContent = userCoords ? "Sorted by match score · distance" : "Sorted by match score (distance unavailable)";
  renderList();
  updateMarkers(allResults, selIdx);
}

function renderList(){
  const list=document.getElementById("resList");
  const pill=document.getElementById("countPill");
  pill.textContent=allResults.length;

  if(!allResults.length){
    list.innerHTML=`<div class="no-results">No facilities match.<br/>Try broadening your filters or increasing the radius.</div>`;
    return;
  }

  list.innerHTML=allResults.map((f,i)=>{
    const tags=buildTags(f);
    const distHtml=f._dist!=null
      ?`<div class="dist-badge"><div class="dist-mi">${f._dist.toFixed(1)}</div><div class="dist-lbl">mi</div></div>`:"";
    const sc=Math.round(f._score||0);
    const rankCls=i===0?"gold":i===1?"silver":i===2?"bronze":"";
    const pct=Math.min(100,sc);
    const showExp = f._explanation && f._reasons && f._reasons.length > 0;
    return `<div class="fcard${selIdx===i?" active":""}" onclick="selectFac(${i})" data-idx="${i}">
      <div>
        <div class="fc-top">
          <div class="fc-rank${rankCls?" "+rankCls:""}">${i+1}</div>
          <div class="fc-name">${f.facility_name}</div>
        </div>
        <div class="fc-sub">${f.city}, ${f.state} · ${f.zip}</div>
        ${(f.tier_name||"") ? `<div class="fc-explanation"><strong>${f.tier_name}</strong> · Cluster ${f.cluster_label}</div>` : ""}
        <div class="fc-score-bar">
          <div class="score-track"><div class="score-fill" style="width:${pct}%"></div></div>
          <div class="score-label"><span>Match</span><span>${sc}/100</span></div>
        </div>
        ${showExp?`<div class="fc-explanation">${f._explanation}</div>`:""}
        <div class="fc-tags">${tags}</div>
      </div>
      ${distHtml}
    </div>`;
  }).join("");
}

function buildTags(f){
  const s=f.service_setting||"",ta=f.treatment_approaches||"";
  const t=[];
  if(f.tier_name) t.push(`<span class="tag">${f.tier_name}</span>`);
  if(s.includes("Hospital inpatient")) t.push(`<span class="tag inp">Inpatient</span>`);
  if(s.includes("Outpatient")) t.push(`<span class="tag out">Outpatient</span>`);
  if(s.includes("Residential")) t.push(`<span class="tag res">Residential</span>`);
  if(s.includes("Partial")) t.push(`<span class="tag php">PHP</span>`);
  if(f.emergency_services) t.push(`<span class="tag emg">Emergency</span>`);
  if((f.payment_funding||"").toLowerCase().includes("medicaid")) t.push(`<span class="tag mc">Medicaid</span>`);
  if(ta.toLowerCase().includes("telemedicine")||ta.toLowerCase().includes("telehealth")) t.push(`<span class="tag tele">Telehealth</span>`);
  return t.join("");
}

function selectFac(idx){
  selIdx=idx;
  document.querySelectorAll(".fcard").forEach(c=>c.classList.remove("active"));
  const card=document.querySelector(`[data-idx="${idx}"]`);
  if(card){card.classList.add("active");card.scrollIntoView({block:"nearest",behavior:"smooth"});}
  updateMarkers(allResults,selIdx);
  renderDetail(allResults[idx],idx);
  const f=allResults[idx];
  if(f.lat&&f.lng) map.setView([f.lat,f.lng],13);
  mGroup.eachLayer(l=>{if(l._fidx===idx)l.openPopup();});
}

function renderDetail(f,idx){
  document.getElementById("dEmpty").style.display="none";
  const el=document.getElementById("dContent");
  el.style.display="block";
  const maps=`https://maps.google.com/?q=${encodeURIComponent((f.address||"")+" "+f.city+" "+f.state)}`;
  const li=str=>{
    if(!str||str==="None") return `<div class="ds-n">Not reported</div>`;
    return str.split(",").map(s=>s.trim()).filter(Boolean).slice(0,7)
      .map(s=>`<div class="ds-i">${s}</div>`).join("");
  };
  const sc=Math.round(f._score||0);
  const bd=f._ruleScore!=null?`
    <div class="d-score-breakdown">
      <div class="dsb-item"><span class="dsb-k">Rule score</span><span class="dsb-v">${Math.round(f._ruleNorm)}/100</span></div>
      <div class="dsb-item"><span class="dsb-k">Combined</span><span class="dsb-v">${sc}/100</span></div>
    </div>`:"";
  el.innerHTML=`
    <div class="d-name">${f.facility_name}</div>
    <div class="d-type">${f.facility_type||"Behavioral health facility"} · ${f.state} · Rank #${idx+1}</div>
    ${f.tier_name?`<div class="d-explanation">Tier: <strong>${f.tier_name}</strong> (cluster ${f.cluster_label})</div>`:""}
    ${f._dist!=null?`<div class="d-dist">📍 ${f._dist.toFixed(1)} mi from ${document.getElementById("fZip").value}</div>`:""}
    <div class="d-score-block">
      <div class="d-score-row"><span class="d-score-title">Match Score</span><span class="d-score-num">${sc}<span style="font-size:12px;font-weight:400;color:var(--muted)">/100</span></span></div>
      ${bd}
    </div>
    ${f._explanation&&f._reasons&&f._reasons.length?`<div class="d-explanation">💡 ${f._explanation}</div>`:""}
    <div class="vbadges">
      <span class="vb g">✓ SAMHSA 2024</span>
      <span class="vb b">Verified data</span>
      ${f.emergency_services?`<span class="vb" style="background:#FEF2F2;color:#991B1B">Emergency services</span>`:""}
    </div>
    <div class="d-addr"><span style="font-size:14px;flex-shrink:0">📍</span><div>${f.address||"Address not listed"}<br/>${f.city}, ${f.state} ${f.zip}</div></div>
    <div class="d-actions">
      <button class="btn-call" onclick="window.location='tel:${f.phone}'">📞 ${f.phone}</button>
      ${f.intake1?`<button class="btn-int" onclick="window.location='tel:${f.intake1}'">📋 Intake</button>`:""}
      <a class="btn-dir" href="${maps}" target="_blank">🗺 Directions</a>
    </div>
    <div class="d-grid">
      <div class="ds"><div class="ds-t">Type of Care</div>${li(f.type_of_care)}</div>
      <div class="ds"><div class="ds-t">Setting</div>${li(f.service_setting)}</div>
      <div class="ds"><div class="ds-t">Emergency Svcs</div>${li(f.emergency_services)}</div>
      <div class="ds"><div class="ds-t">Ages Accepted</div>${li(f.age_groups_accepted)}</div>
      <div class="ds full"><div class="ds-t">Treatment Approaches</div>${li(f.treatment_approaches)}</div>
      <div class="ds"><div class="ds-t">Payment & Insurance</div>${li(f.payment_funding)}${f.payment_assistance?`<div class="ds-i" style="color:#15803D;font-weight:600">✓ ${f.payment_assistance}</div>`:""}</div>
      <div class="ds"><div class="ds-t">Special Programs</div>${li(f.special_programs_groups)}</div>
      <div class="ds full"><div class="ds-t">Ancillary Services</div>${li(f.ancillary_services)}</div>
      ${f.language_services?`<div class="ds"><div class="ds-t">Languages</div>${li(f.language_services)}</div>`:""}
      ${f.recovery_support?`<div class="ds"><div class="ds-t">Recovery Support</div>${li(f.recovery_support)}</div>`:""}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  AI SEARCH (adds semantic-like ranking via Gemini)
// ═══════════════════════════════════════════════════════════
async function runAI(){
  const q=document.getElementById("aiQ").value.trim();
  if(!q) return;
  const btn=document.getElementById("aiBtn");
  const msg=document.getElementById("aiMsg");
  btn.disabled=true;btn.innerHTML=`<span class="spin"></span>`;
  msg.textContent="Analyzing query and ranking...";

  // first run base search to get a pool
  runSearch();
  const pool=allResults.slice(0,60); // send top 60 to AI for re-ranking

  const facList=pool.map((f,i)=>
    `[${i}] ${f.facility_name} (${f.city},${f.state}) | ${f.service_setting} | ${f.type_of_care} | Ins:${f.payment_funding} | Pop:${f.special_programs_groups||"—"} | Tx:${(f.treatment_approaches||"").slice(0,80)}`
  ).join("\n");

  try{
    const system=`You are a behavioral health access navigator. Re-rank facilities for a user query using a hybrid score (semantic fit + rule match). Return ONLY:
MATCHES: comma-separated indices most→least relevant (up to 15)
SCORES: comma-separated 0-100 semantic scores matching each index
REASON: one concise sentence explaining top match`;
    const user_content=`Query: "${q}"\n\nFacilities to rank:\n${facList}`;
    const res=await fetch("/api/ai-rank",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        max_tokens:800,
        system,
        user_content,
      }),
    });
    const data=await res.json();
    if(!res.ok){
      msg.textContent=data.error||("Ask AI failed ("+res.status+")");
      btn.disabled=false;btn.textContent="Run";
      return;
    }
    if(data.error){
      msg.textContent=String(data.error);
      btn.disabled=false;btn.textContent="Run";
      return;
    }
    const txt=data.content?.[0]?.text||"";
    const mLine=txt.match(/MATCHES:\s*([0-9,\s]+)/);
    const sLine=txt.match(/SCORES:\s*([0-9,\s.]+)/);
    const rLine=txt.match(/REASON:\s*(.+)/s);

    if(mLine){
      const idxs=mLine[1].split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n<pool.length);
      const scores=(sLine?sLine[1].split(",").map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n)):[]);
      const MAX_RULE=113;
      const reranked=idxs.map((pi,rank)=>{
        const f={...pool[pi]};
        const sem=scores[rank]!=null?scores[rank]:60;
        const ruleNorm=f._ruleNorm||0;
        f._semanticScore=sem;
        f._score=Math.round(0.6*sem+0.4*ruleNorm); // exact formula from notebook cell 17
        f._explanation=rLine?rLine[1].trim():f._explanation;
        return f;
      });
      allResults=reranked;
      document.getElementById("sortNote").textContent="Sorted by AI hybrid score (semantic + rule)";
      renderList();
      updateMarkers(allResults,null);
      msg.textContent=rLine?rLine[1].trim():`Found ${allResults.length} best-matched facilities.`;
    } else {
      msg.textContent="AI returned no results. Showing rule-based ranking.";
    }
  }catch(e){
    console.error(e);
    msg.textContent="AI unavailable. Showing rule-based ranking instead. ("+(e.message||e)+")";
  }
  btn.disabled=false;btn.textContent="Run";
}

async function initApp() {
  const list = document.getElementById("resList");
  if (list) {
    list.innerHTML = '<div class="no-results">Loading facilities and clusters...</div>';
  }
  try {
    await loadData();
    populateFilters();
  } catch (e) {
    console.error(e);
    if (list) {
      list.innerHTML = '<div class="no-results">Could not load clustered data. Run the app server from <code>backend/</code>: <code>python app.py</code> then open <code>http://127.0.0.1:8080/navigator.html</code><br/><br/>' + String(e.message || e) + "</div>";
    }
    return;
  }
  ["fState","fCare","fSett","fIns","fPop","fEmg","fRad","fComplexity","fTier"].forEach((id)=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener("change",runSearch);
  });
  document.getElementById("aiQ").addEventListener("keydown",e=>{if(e.key==="Enter")runAI();});
  document.getElementById("fZip").addEventListener("input",e=>{
    if(e.target.value.length===5||e.target.value.length===0) runSearch();
  });
  runSearch();
  requestAnimationFrame(() => {
    try {
      map.invalidateSize();
    } catch (_) {}
  });
  window.addEventListener(
    "resize",
    () => {
      try {
        map.invalidateSize();
      } catch (_) {}
    },
    { passive: true }
  );
}

document.addEventListener("DOMContentLoaded", initApp);
