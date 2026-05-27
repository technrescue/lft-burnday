import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import jsPDF from "jspdf";

const SUPABASE_URL = "https://udpagyykfhgpcewohzkm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcGFneXlrZmhncGNld29oemttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODM5NDcsImV4cCI6MjA5NTQ1OTk0N30.MHHD1zW1nSuSyVYdQVgh3rtAiGJTBzsa3YtvmUIoKGY";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Constants ─────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  "1) Burn Plan Reviewed?","2) Radio Check Ch.1 & 2","3) Pump Operator Ready?",
  "4) Attack & Back-up lines flowed?","5) Nozzle Pattern Checked?","6) Instructor-in-Charge Ready?",
  "7) Attack Team Ready?","8) Back-up Team Ready?","9) Search Team Ready?",
  "10) Ignition Team Ready?","11) Safety Ready?","12) EMS Officer Ready & in-service?",
  "13) Accountability good?"
];
const TS_NA_LABELS = ["Search Making Entry","Victim(s) Removed","Search Complete"];
const TS_LABELS = [
  "Checklist Complete","Fire Started","Attack Making Entry","Fire Under Control",
  "Search Making Entry","Victim(s) Removed","Search Complete","Evolution Complete"
];
const TEMP_LABELS = ["T1","T2","T3","T4"];
const POSITIONS = ["Instructor-in-Charge","Safety Officer","Ignition","Ignition's Safety","EMS Officer"];
const TEAM_NAMES = ["Attack Team","Back-Up Team","Search Team","Extra Team"];
const SCENARIOS = Array.from({length:12},(_,i)=>String(i+1));

const nowTime = () => {
  const n = new Date();
  return [n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,"0")).join(":");
};
const mkEvoData = (num) => ({
  evo_number: String(num).padStart(2,"0"),
  scenario: "1",
  date: new Date().toISOString().split("T")[0],
  positions: Object.fromEntries(POSITIONS.map(p=>[p,""])),
  checklist: Object.fromEntries(CHECKLIST_ITEMS.map(k=>[k,false])),
  timestamps: Object.fromEntries(TS_LABELS.map(k=>[k,""])),
  temps: Object.fromEntries(TEMP_LABELS.map(k=>[k,""])),
  teams: Object.fromEntries(TEAM_NAMES.map(t=>[t,{lfi1:"",lfi2:"",members:["","","","",""]}])),
});

// ── Styles ────────────────────────────────────────────────
const S = {
  app: {fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",fontSize:14,color:"#1a1a1a",background:"#f4f3f0",minHeight:"100vh"},
  clockBar: {background:"#111",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200},
  clockNum: {fontFamily:"'Courier New',monospace",fontSize:30,fontWeight:700,color:"#FFD700",letterSpacing:4},
  clockLbl: {fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2},
  topbar: {background:"#fff",borderBottom:"1px solid #e0ddd8",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  topbarR: {display:"flex",gap:8,alignItems:"center"},
  tabBar: {display:"flex",background:"#fff",borderBottom:"1px solid #e0ddd8",padding:"0 20px",overflowX:"auto"},
  content: {padding:20,maxWidth:980,margin:"0 auto"},
  card: {background:"#fff",border:"1px solid #e0ddd8",borderRadius:12,padding:"16px 20px",marginBottom:14},
  secTitle: {fontSize:11,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #e0ddd8"},
  row: {display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"},
  fg: {display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:120},
  lbl: {fontSize:11,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:"0.06em"},
  input: {fontFamily:"inherit",fontSize:13,color:"#1a1a1a",background:"#fff",border:"1px solid #c8c5be",borderRadius:8,padding:"7px 10px",width:"100%"},
  select: {fontFamily:"inherit",fontSize:13,color:"#1a1a1a",background:"#fff",border:"1px solid #c8c5be",borderRadius:8,padding:"7px 10px",width:"100%"},
  btn: {padding:"7px 14px",borderRadius:8,fontSize:13,border:"1px solid #c8c5be",background:"#fff",color:"#1a1a1a",cursor:"pointer"},
  btnPrimary: {padding:"7px 14px",borderRadius:8,fontSize:13,border:"1px solid #1a1a1a",background:"#1a1a1a",color:"#fff",cursor:"pointer"},
  btnDanger: {padding:"7px 14px",borderRadius:8,fontSize:13,border:"1px solid #A32D2D",background:"#A32D2D",color:"#fff",cursor:"pointer"},
  btnSuccess: {padding:"7px 14px",borderRadius:8,fontSize:13,border:"1px solid #3B6D11",background:"#3B6D11",color:"#fff",cursor:"pointer"},
  btnSm: {padding:"4px 10px",fontSize:11},
  teamBox: {background:"#f4f3f0",border:"1px solid #e0ddd8",borderRadius:8,padding:12},
  teamTitle: {fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#666"},
  tsBtn: {padding:"6px 12px",border:"1px solid #c8c5be",borderRadius:8,fontSize:11,fontWeight:700,background:"#111",color:"#FFD700",cursor:"pointer",whiteSpace:"nowrap"},
  pinCard: {background:"#fff",border:"1px solid #e0ddd8",borderRadius:12,padding:"32px 40px",width:320,textAlign:"center"},
  tag: (type) => {
    const map = {instructor:{bg:"#1a1a1a",color:"#fff"},student:{bg:"#1a1a1a",color:"#fff"},fillin:{bg:"#FFD700",color:"#1a1a1a"},ems:{bg:"#1a4fa8",color:"#fff"}};
    const t = map[type]||map.student;
    return {display:"inline-block",padding:"4px 10px",borderRadius:4,fontSize:12,fontWeight:700,letterSpacing:"0.04em",margin:2,background:t.bg,color:t.color};
  },
};

// ── Clock component ───────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(nowTime());
  useEffect(()=>{
    const iv = setInterval(()=>setTime(nowTime()),1000);
    return ()=>clearInterval(iv);
  },[]);
  return <span style={S.clockNum}>{time}</span>;
}

// ── Toast ─────────────────────────────────────────────────
function Toast({msg}) {
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:13,zIndex:9999}}>{msg}</div>;
}

function useToast() {
  const [msg,setMsg] = useState("");
  const show = useCallback((m,dur=2500)=>{
    setMsg(m);
    setTimeout(()=>setMsg(""),dur);
  },[]);
  return [msg,show];
}

// ── Tag component ─────────────────────────────────────────
function MemberTag({val,type}) {
  if(!val) return null;
  const name = val.includes("|") ? val.split("|")[0] : val;
  const t = val.includes("|") ? val.split("|")[1] : (type||"student");
  return <span style={S.tag(t)}>{name}</span>;
}

// ── PIN Screen ────────────────────────────────────────────
function PinScreen({onLogin}) {
  const [pin,setPin] = useState("");
  const [err,setErr] = useState("");
  const [loading,setLoading] = useState(false);

  const doLogin = async () => {
    if(!pin){setErr("Enter a PIN");return;}
    setLoading(true);setErr("");
    const {data} = await sb.from("app_config").select("key,value");
    const cfg = {};
    (data||[]).forEach(r=>cfg[r.key]=r.value);
    if(pin===cfg.admin_pin) onLogin("admin",cfg);
    else if(pin===cfg.standard_pin) onLogin("standard",cfg);
    else {setErr("Incorrect PIN. Try again.");setPin("");}
    setLoading(false);
  };

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#ffffff"}}>
      <div style={{...S.pinCard,background:"#000000",border:"1px solid #222",textAlign:"center",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
        <img src="/tnr-logo.png" alt="Tech N Rescue Innovations" style={{width:168,height:168,objectFit:"contain",marginBottom:4}}/>
        <div style={{color:"#888",fontSize:12,letterSpacing:"0.08em",marginBottom:12,textTransform:"uppercase"}}>A Tech N Rescue Innovations Product</div>
        <h1 style={{fontSize:20,fontWeight:700,marginBottom:4,color:"#fff"}}>Live Fire Training</h1>
        <p style={{fontSize:12,color:"#999",marginBottom:20}}>Burn Day Manager — Enter PIN</p>
        <input
          type="password" inputMode="numeric" maxLength={8}
          value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&doLogin()}
          style={{...S.input,fontSize:24,letterSpacing:10,textAlign:"center",marginBottom:12,background:"#111",color:"#FFD700",border:"1px solid #444"}}
          placeholder="••••" autoFocus
        />
        <button onClick={doLogin} disabled={loading}
          style={{...S.btnPrimary,width:"100%",padding:11,fontSize:14,fontWeight:600}}>
          {loading?"Checking...":"Enter"}
        </button>
        {err&&<p style={{color:"#ff6b6b",fontSize:12,marginTop:8}}>{err}</p>}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [screen,setScreen] = useState("pin");
  const [role,setRole] = useState(null);
  const [config,setConfig] = useState({});
  const [activeTab,setActiveTab] = useState("evolutions");
  const [rosterTab,setRosterTab] = useState("instructors");
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [toastMsg,showToast] = useToast();

  const [instructors,setInstructors] = useState([]);
  const [students,setStudents] = useState([]);
  const [fillins,setFillins] = useState([]);
  const [savedTeams,setSavedTeams] = useState([]);
  const [burnDay,setBurnDay] = useState(null);
  const [burnDayTitle,setBurnDayTitle] = useState("");
  const [evolutions,setEvolutions] = useState([]);
  const [currentEvoIdx,setCurrentEvoIdx] = useState(0);
  const [history,setHistory] = useState([]);
  const [historyEvos,setHistoryEvos] = useState({});
  const [drafts,setDrafts] = useState([]);
  const [scenarios,setScenarios] = useState([]);
  const [showDraftModal,setShowDraftModal] = useState(false);
  const [showSaveDraft,setShowSaveDraft] = useState(false);
  const [draftName,setDraftName] = useState(burnDayTitle||"");

  const saveTimer = useRef(null);

  const loadAll = useCallback(async (r) => {
    setLoading(true);
    const [iR,sR,fR,tR,bdR,dR,scR] = await Promise.all([
      sb.from("instructors").select("*").order("name"),
      sb.from("students").select("*").order("name"),
      sb.from("fillins").select("*").order("name"),
      sb.from("saved_teams").select("*").order("name"),
      sb.from("burn_days").select("*").eq("status","active").order("created_at",{ascending:false}).limit(1),
      sb.from("drafts").select("*").order("updated_at",{ascending:false}),
      sb.from("burn_scenarios").select("*").order("number"),
    ]);
    setInstructors(iR.data||[]);
    setStudents(sR.data||[]);
    setFillins(fR.data||[]);
    setSavedTeams((tR.data||[]).map(t=>({...t,members:t.members||[]})));
    setDrafts(dR.data||[]);
    setScenarios(scR.data||[]);

    let bd = bdR.data&&bdR.data[0];
    if(!bd){
      const {data} = await sb.from("burn_days").insert({date:new Date().toISOString().split("T")[0],status:"active"}).select().single();
      bd = data;
    }
    setBurnDay(bd);
    setBurnDayTitle(bd.title||"");
    const eR = await sb.from("evolutions").select("*").eq("burn_day_id",bd.id).order("evo_number");
    let evos = eR.data||[];
    if(!evos.length){
      const {data} = await sb.from("evolutions").insert({burn_day_id:bd.id,...mkEvoData(1)}).select().single();
      evos = [data];
    }
    setEvolutions(evos);
    setCurrentEvoIdx(0);
    if(r==="admin"){
      const hR = await sb.from("burn_days").select("*").eq("status","archived").order("archived_at",{ascending:false});
      setHistory(hR.data||[]);
    }
    setLoading(false);
  },[]);

  const handleLogin = useCallback(async (r,cfg) => {
    setRole(r); setConfig(cfg); setScreen("app");
    await loadAll(r);
  },[loadAll]);

  // ── Save Burn Day Title ─────────────────────────────────
  const titleTimer = useRef(null);
  const updateBurnDayTitle = (val) => {
    setBurnDayTitle(val);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async()=>{
      if(burnDay?.id) await sb.from("burn_days").update({title:val}).eq("id",burnDay.id);
    },600);
  };

  // ── Save ────────────────────────────────────────────────
  const saveEvo = useCallback(async (evos,idx) => {
    const evo = evos[idx];
    if(!evo||!evo.id) return;
    setSaving(true);
    await sb.from("evolutions").update({
      scenario:evo.scenario, date:evo.date,
      positions:evo.positions, checklist:evo.checklist,
      timestamps:evo.timestamps, temps:evo.temps, teams:evo.teams,
    }).eq("id",evo.id);
    setSaving(false);
  },[]);

  const schedSave = useCallback((evos,idx) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>saveEvo(evos,idx),800);
  },[saveEvo]);

  // ── Evo mutations ───────────────────────────────────────
  const updEvo = (field,val) => {
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],[field]:val};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const updPos = (pos,val) => {
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],positions:{...e[currentEvoIdx].positions,[pos]:val}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const togCheck = (key) => {
    setEvolutions(prev=>{
      const e=[...prev];
      e[currentEvoIdx]={...e[currentEvoIdx],checklist:{...e[currentEvoIdx].checklist,[key]:!e[currentEvoIdx].checklist[key]}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const stampTime = (label) => {
    const t = nowTime();
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],timestamps:{...e[currentEvoIdx].timestamps,[label]:t}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const updTs = (label,val) => {
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],timestamps:{...e[currentEvoIdx].timestamps,[label]:val}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const updTemp = (label,val) => {
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],temps:{...e[currentEvoIdx].temps,[label]:val}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const finalizeTemp = (label,raw) => {
    const digits = raw.replace(/[^\d]/g,"").slice(0,3);
    const val = digits ? digits+"°F" : "";
    setEvolutions(prev=>{
      const e=[...prev]; e[currentEvoIdx]={...e[currentEvoIdx],temps:{...e[currentEvoIdx].temps,[label]:val}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const updTeam = (team,field,val,mi) => {
    setEvolutions(prev=>{
      const e=[...prev];
      const t={...e[currentEvoIdx].teams[team]};
      if(field==="member"){const m=[...t.members];m[mi]=val;t.members=m;}
      else t[field]=val;
      e[currentEvoIdx]={...e[currentEvoIdx],teams:{...e[currentEvoIdx].teams,[team]:t}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const autoFillTeam = (teamName,savedTeamId) => {
    if(!savedTeamId) return;
    const st = savedTeams.find(t=>t.id===savedTeamId);
    if(!st) return;
    const members = st.members.slice(0,5).map(m=>m.name+"|"+(m.type||"student"));
    while(members.length<5) members.push("");
    setEvolutions(prev=>{
      const e=[...prev];
      e[currentEvoIdx]={...e[currentEvoIdx],teams:{...e[currentEvoIdx].teams,[teamName]:{...e[currentEvoIdx].teams[teamName],members}}};
      schedSave(e,currentEvoIdx); return e;
    });
  };
  const addEvolution = async () => {
    if(!burnDay) return;
    const num = evolutions.length+1;
    const {data} = await sb.from("evolutions").insert({burn_day_id:burnDay.id,...mkEvoData(num)}).select().single();
    setEvolutions(prev=>[...prev,data]);
    setCurrentEvoIdx(evolutions.length);
    showToast(`Evolution ${String(num).padStart(2,"0")} added`);
  };

  // ── Roster CRUD ─────────────────────────────────────────
  const addInstructor = async (name,odps) => {
    if(!name) return;
    const {data} = await sb.from("instructors").insert({name,odps}).select().single();
    setInstructors(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    showToast("Instructor added");
  };
  const removeInstructor = async (id) => {
    await sb.from("instructors").delete().eq("id",id);
    setInstructors(prev=>prev.filter(i=>i.id!==id));
  };
  const addStudent = async (name) => {
    if(!name) return;
    const {data} = await sb.from("students").insert({name}).select().single();
    setStudents(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    showToast("Student added");
  };
  const removeStudent = async (id) => {
    await sb.from("students").delete().eq("id",id);
    setStudents(prev=>prev.filter(s=>s.id!==id));
  };
  const addFillin = async (name) => {
    if(!name) return;
    const {data} = await sb.from("fillins").insert({name}).select().single();
    setFillins(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    showToast("Fill-in added");
  };
  const removeFillin = async (id) => {
    await sb.from("fillins").delete().eq("id",id);
    setFillins(prev=>prev.filter(s=>s.id!==id));
  };
  const createSavedTeam = async (name) => {
    if(!name) return;
    const {data} = await sb.from("saved_teams").insert({name,members:[]}).select().single();
    setSavedTeams(prev=>[...prev,{...data,members:[]}]);
  };
  const removeSavedTeam = async (id) => {
    await sb.from("saved_teams").delete().eq("id",id);
    setSavedTeams(prev=>prev.filter(t=>t.id!==id));
  };
  const addMemberToTeam = async (teamId,val) => {
    if(!val) return;
    const [name,type] = val.split("|");
    const team = savedTeams.find(t=>t.id===teamId);
    if(!team||team.members.find(m=>m.name===name)) return;
    const members = [...team.members,{name,type:type||"student"}];
    await sb.from("saved_teams").update({members}).eq("id",teamId);
    setSavedTeams(prev=>prev.map(t=>t.id===teamId?{...t,members}:t));
  };
  const removeMemberFromTeam = async (teamId,name) => {
    const team = savedTeams.find(t=>t.id===teamId);
    if(!team) return;
    const members = team.members.filter(m=>m.name!==name);
    await sb.from("saved_teams").update({members}).eq("id",teamId);
    setSavedTeams(prev=>prev.map(t=>t.id===teamId?{...t,members}:t));
  };

  // ── Scenarios ───────────────────────────────────────────
  const addScenario = async (number,title,description) => {
    if(!number||!title) return;
    const {data} = await sb.from("burn_scenarios").insert({number:parseInt(number),title,description,pdf_url:""}).select().single();
    setScenarios(prev=>[...prev,data].sort((a,b)=>a.number-b.number));
  };
  const deleteScenario = async (id) => {
    if(!window.confirm("Delete this scenario?")) return;
    // also remove PDF from storage if exists
    const sc = scenarios.find(s=>s.id===id);
    if(sc&&sc.pdf_url){
      const path = sc.pdf_url.split("/scenario-pdfs/")[1];
      if(path) await sb.storage.from("scenario-pdfs").remove([path]);
    }
    await sb.from("burn_scenarios").delete().eq("id",id);
    setScenarios(prev=>prev.filter(s=>s.id!==id));
  };
  const uploadScenarioPDF = async (scenarioId, file) => {
    if(!file) return;
    const path = `scenario_${scenarioId}_${Date.now()}.pdf`;
    // remove old pdf if exists
    const sc = scenarios.find(s=>s.id===scenarioId);
    if(sc&&sc.pdf_url){
      const oldPath = sc.pdf_url.split("/scenario-pdfs/")[1];
      if(oldPath) await sb.storage.from("scenario-pdfs").remove([oldPath]);
    }
    const {error} = await sb.storage.from("scenario-pdfs").upload(path, file, {contentType:"application/pdf"});
    if(error){console.error(error);return;}
    const {data:{publicUrl}} = sb.storage.from("scenario-pdfs").getPublicUrl(path);
    await sb.from("burn_scenarios").update({pdf_url:publicUrl}).eq("id",scenarioId);
    setScenarios(prev=>prev.map(s=>s.id===scenarioId?{...s,pdf_url:publicUrl}:s));
  };
  const removeScenarioPDF = async (scenarioId) => {
    const sc = scenarios.find(s=>s.id===scenarioId);
    if(!sc||!sc.pdf_url) return;
    const path = sc.pdf_url.split("/scenario-pdfs/")[1];
    if(path) await sb.storage.from("scenario-pdfs").remove([path]);
    await sb.from("burn_scenarios").update({pdf_url:""}).eq("id",scenarioId);
    setScenarios(prev=>prev.map(s=>s.id===scenarioId?{...s,pdf_url:""}:s));
  };

  // ── Start New ───────────────────────────────────────────
  const startNew = async () => {
    if(!window.confirm("Clear all evolutions and start fresh? Rosters will not be affected.")) return;
    clearTimeout(saveTimer.current);
    // archive current burn day and create a brand new one
    if(burnDay) await sb.from("burn_days").update({status:"inactive"}).eq("id",burnDay.id);
    const {data:newBD} = await sb.from("burn_days").insert({date:new Date().toISOString().split("T")[0],status:"active",title:""}).select().single();
    const {data:evo} = await sb.from("evolutions").insert({burn_day_id:newBD.id,...mkEvoData(1)}).select().single();
    setBurnDay(newBD); setBurnDayTitle(""); setEvolutions([evo]); setCurrentEvoIdx(0);
    showToast("Started fresh — new burn day created");
  };

  // ── Save Draft ───────────────────────────────────────────
  const saveDraft = async (name) => {
    if(!name.trim()){showToast("Enter a draft name");return;}
    clearTimeout(saveTimer.current);
    await saveEvo(evolutions,currentEvoIdx);
    // fetch latest evolutions from db
    const {data:evos} = await sb.from("evolutions").select("*").eq("burn_day_id",burnDay.id).order("evo_number");
    await sb.from("drafts").insert({
      name:name.trim(),
      burn_day:{...burnDay,title:burnDayTitle},
      evolutions:evos||[],
    });
    const {data:dR} = await sb.from("drafts").select("*").order("updated_at",{ascending:false});
    setDrafts(dR||[]);
    setShowSaveDraft(false); setDraftName("");
    showToast("Draft saved: "+name.trim());
  };

  // ── Open Draft ───────────────────────────────────────────
  const openDraft = async (draft) => {
    // check if current has data worth saving
    const hasData = evolutions.some(e=>
      Object.values(e.positions||{}).some(v=>v) ||
      Object.values(e.checklist||{}).some(v=>v) ||
      Object.values(e.timestamps||{}).some(v=>v)
    );
    if(hasData){
      const save = window.confirm("Save current work as a draft before opening this one?");
      if(save){
        const nm = window.prompt("Name for current draft:",burnDayTitle||"Draft "+new Date().toLocaleTimeString());
        if(nm) await saveDraft(nm);
      }
    }
    // load the draft evolutions into state
    setBurnDay(draft.burn_day);
    setBurnDayTitle(draft.burn_day?.title||draft.name||"");
    setEvolutions(draft.evolutions||[]);
    setCurrentEvoIdx(0);
    setShowDraftModal(false);
    showToast("Draft loaded: "+draft.name);
  };

  const deleteDraft = async (id) => {
    if(!window.confirm("Delete this draft?")) return;
    await sb.from("drafts").delete().eq("id",id);
    setDrafts(prev=>prev.filter(d=>d.id!==id));
    showToast("Draft deleted");
  };

  // ── Finish Burn Day ─────────────────────────────────────
  const finishBurnDay = async () => {
    if(!window.confirm(`Finish burn day and export PDF for all ${evolutions.length} evolution(s)?`)) return;
    clearTimeout(saveTimer.current);
    await saveEvo(evolutions,currentEvoIdx);
    await sb.from("burn_days").update({status:"archived",archived_at:new Date().toISOString()}).eq("id",burnDay.id);
    exportPDF(evolutions,burnDay.date,burnDayTitle);
    showToast("Burn day archived — PDF downloading!",3500);
    const {data:bd} = await sb.from("burn_days").insert({date:new Date().toISOString().split("T")[0],status:"active"}).select().single();
    const {data:evo} = await sb.from("evolutions").insert({burn_day_id:bd.id,...mkEvoData(1)}).select().single();
    if(role==="admin"){
      const hR = await sb.from("burn_days").select("*").eq("status","archived").order("archived_at",{ascending:false});
      setHistory(hR.data||[]);
    }
    setBurnDay(bd);
    setBurnDayTitle(bd.title||""); setEvolutions([evo]); setCurrentEvoIdx(0); setActiveTab("evolutions");
  };

  // ── History ──────────────────────────────────────────────
  const loadHistEvos = async (bdId) => {
    if(historyEvos[bdId]) return;
    const {data} = await sb.from("evolutions").select("*").eq("burn_day_id",bdId).order("evo_number");
    setHistoryEvos(prev=>({...prev,[bdId]:data||[]}));
  };
  const toggleHistEvos = async (bdId) => {
    if(historyEvos[bdId]) setHistoryEvos(prev=>{const c={...prev};delete c[bdId];return c;});
    else await loadHistEvos(bdId);
  };
  const exportHistory = async (bdId,date,title) => {
    await loadHistEvos(bdId);
    exportPDF(historyEvos[bdId]||[],date,title);
  };

  // ── PDF Export ───────────────────────────────────────────
  const exportPDF = (evos,burnDate,bdTitle) => {
    const doc = new jsPDF({orientation:"portrait",unit:"pt",format:"letter"});
    const W=612, m=36, usableW=W-m*2;

    evos.forEach((evo,ei)=>{
      if(ei>0) doc.addPage();
      let y=m;

      // ── Title ──
      doc.setFontSize(14);doc.setFont(undefined,"bold");doc.setTextColor(0);
      doc.text("Live Fire Training Worksheet",W/2,y+10,{align:"center"});
      if(bdTitle){doc.setFontSize(9);doc.setFont(undefined,"normal");doc.text(bdTitle,W/2,y+20,{align:"center"});}
      doc.setLineWidth(0.75);doc.setDrawColor(0);doc.line(m,y+15,W-m,y+15);
      y+=24;

      // ── Evolution # / Scenario # / Date ──
      const hW=usableW/3;
      [["Evolution #",evo.evo_number],["Scenerio #",evo.scenario],["Date",evo.date]].forEach(([lbl,val],i)=>{
        const bx=m+i*hW;
        doc.setDrawColor(0);doc.setLineWidth(0.4);doc.rect(bx,y,hW,16);
        doc.setFont(undefined,"bold");doc.setFontSize(8);
        doc.text(lbl+":",bx+3,y+11);
        doc.setFont(undefined,"normal");
        doc.text(String(val||""),bx+3+doc.getTextWidth(lbl+":")+2,y+11);
      });y+=20;

      // ── Positions — each on its own line, label: name  ODPS #: number ──
      const posData = [
        ["Instructor-in-Charge","Instructor -in-Charge"],
        ["Safety Officer","Safety Officer"],
        ["Ignition","Ignition"],
        ["Ignition's Safety","Ignition's Safety"],
        ["EMS Officer","EMS Officer"],
      ];
      const lineH=16;
      posData.forEach(([key,printLabel])=>{
        const raw=(evo.positions||{})[key]||"";
        const nameOnly=raw.replace(/\s*\(\d+\)\s*$/,"");
        const odpsMatch=raw.match(/\((\d+)\)/);
        doc.setDrawColor(0);doc.setLineWidth(0.4);doc.rect(m,y,usableW,lineH);
        doc.setFont(undefined,"bold");doc.setFontSize(8);doc.setTextColor(0);
        doc.text(printLabel+":",m+3,y+11);
        doc.setFont(undefined,"normal");
        const afterLabel=m+3+doc.getTextWidth(printLabel+":")+3;
        doc.text(nameOnly.slice(0,30),afterLabel,y+11);
        if(odpsMatch){
          doc.setFont(undefined,"bold");
          const odpsLbl="ODPS #:";
          const odpsX=m+usableW*0.68;
          doc.text(odpsLbl,odpsX,y+11);
          doc.setFont(undefined,"normal");
          doc.text(odpsMatch[1],odpsX+doc.getTextWidth(odpsLbl)+2,y+11);
        }
        y+=lineH;
      });y+=4;

      // ── Go/No-Go Checklist ──
      doc.setFont(undefined,"bold");doc.setFontSize(9);doc.setTextColor(0);
      doc.text("Go / No Go Checklist:",m,y+9);y+=13;
      // Original layout: 3 columns, items numbered 1-5, 6-10, 11-13
      const col1=[0,1,2,3,4];
      const col2=[5,6,7,8,9];
      const col3=[10,11,12];
      const ciH=15, ciW=usableW/3;
      const maxRows=Math.max(col1.length,col2.length,col3.length);
      [col1,col2,col3].forEach((colItems,ci)=>{
        colItems.forEach((itemIdx,ri)=>{
          const item=CHECKLIST_ITEMS[itemIdx];
          const bx=m+ci*ciW, by=y+ri*ciH;
          doc.setDrawColor(0);doc.setLineWidth(0.3);doc.rect(bx,by,ciW,ciH);
          const chk=(evo.checklist||{})[item];
          doc.setFontSize(7);doc.setFont(undefined,"normal");doc.text(chk?"[X]":"[ ]",bx+2,by+11);
          doc.setFontSize(7);doc.text(item.slice(0,38),bx+13,by+10);
        });
      });y+=maxRows*ciH+6;

      // ── Timestamps + Temps ──
      doc.setFont(undefined,"bold");doc.setFontSize(9);doc.setTextColor(0);
      doc.text("Timestamps:",m,y+9);
      doc.text("Temps:",m+usableW*0.62,y+9);
      y+=13;

      // Left timestamps col
      const tsLeft=["Checklist Complete","Fire Started","Attack Making Entry","Fire Under Control"];
      const tsRight=["Search Making Entry","Victim(s) Removed","Search Complete","Evolution Complete"];
      const tsH=16, tsLW=usableW*0.285, tsLblW=tsLW*0.62, tsValW=tsLW*0.38;
      const tsRX=m+tsLW+4;

      tsLeft.forEach((lbl,i)=>{
        const by=y+i*tsH;
        doc.setDrawColor(0);doc.setLineWidth(0.3);
        doc.rect(m,by,tsLblW,tsH); doc.rect(m+tsLblW,by,tsValW,tsH);
        doc.setFont(undefined,"bold");doc.setFontSize(6.5);doc.setTextColor(60,60,60);
        doc.text(lbl+":",m+2,by+11);
        doc.setFont(undefined,"normal");doc.setFontSize(8);doc.setTextColor(0);
        doc.text(String((evo.timestamps||{})[lbl]||""),m+tsLblW+2,by+11);
      });

      tsRight.forEach((lbl,i)=>{
        const by=y+i*tsH;
        doc.setDrawColor(0);doc.setLineWidth(0.3);
        doc.rect(tsRX,by,tsLblW,tsH); doc.rect(tsRX+tsLblW,by,tsValW,tsH);
        doc.setFont(undefined,"bold");doc.setFontSize(6.5);doc.setTextColor(60,60,60);
        doc.text(lbl+":",tsRX+2,by+11);
        doc.setFont(undefined,"normal");doc.setFontSize(8);doc.setTextColor(0);
        doc.text(String((evo.timestamps||{})[lbl]||""),tsRX+tsLblW+2,by+11);
      });

      // Temps — stacked label/value boxes to the right
      const tempX=m+usableW*0.62;
      const tempW=(usableW*0.38)/4;
      TEMP_LABELS.forEach((t,i)=>{
        const bx=tempX+i*tempW;
        doc.setDrawColor(0);doc.setLineWidth(0.3);
        doc.rect(bx,y,tempW,tsH);
        doc.rect(bx,y+tsH,tempW,tsH);
        doc.setFont(undefined,"bold");doc.setFontSize(7);doc.setTextColor(60,60,60);
        doc.text(t+" Temp",bx+2,y+11);
        doc.setFont(undefined,"normal");doc.setFontSize(8.5);doc.setTextColor(0);
        doc.text((evo.temps||{})[t]||"",bx+2,y+tsH+11);
      });
      y+=4*tsH+8;

      // ── Teams ──
      doc.setFont(undefined,"bold");doc.setFontSize(9);doc.setTextColor(0);
      doc.text("Teams:",m,y+9);y+=13;
      const tmW=usableW/4;
      const tmHdrH=16, tmLfiH=18, tmMemH=14;
      TEAM_NAMES.forEach((team,ti)=>{
        const bx=m+ti*tmW;
        const td=(evo.teams||{})[team]||{lfi1:"",lfi2:"",members:["","","",""]};
        // Team name header
        doc.setFillColor(220,220,220);doc.setDrawColor(0);doc.setLineWidth(0.5);
        doc.rect(bx,y,tmW,tmHdrH,"FD");
        doc.setFont(undefined,"bold");doc.setFontSize(8);doc.setTextColor(0);
        doc.text(team,bx+tmW/2,y+11,{align:"center"});
        let ty=y+tmHdrH;
        // LFI Instructors
        ["lfi1","lfi2"].forEach((k,li)=>{
          doc.setDrawColor(0);doc.setLineWidth(0.3);doc.rect(bx,ty,tmW,tmLfiH);
          doc.setFont(undefined,"bold");doc.setFontSize(6);doc.setTextColor(80,80,80);
          doc.text("LFI Instructor",bx+2,ty+7);
          doc.setFont(undefined,"normal");doc.setFontSize(7.5);doc.setTextColor(0);
          const lfiName=(td[k]||"").replace(/\s*\(\d+\)$/,"").slice(0,22);
          doc.text(lfiName,bx+2,ty+15);
          ty+=tmLfiH;
        });
        // Members
        (td.members||["","","","",""]).slice(0,5).forEach((mem,mi)=>{
          doc.setDrawColor(0);doc.setLineWidth(0.3);doc.rect(bx,ty,tmW,tmMemH);
          doc.setFont(undefined,"normal");doc.setFontSize(7.5);doc.setTextColor(0);
          doc.text((mem||"").split("|")[0].slice(0,22),bx+2,ty+10);
          ty+=tmMemH;
        });
      });
    });

    const fname = bdTitle ? `LFT_${bdTitle.replace(/\s+/g,"_")}_${burnDate||"export"}.pdf` : `LFT_BurnDay_${burnDate||"export"}.pdf`;
    doc.save(fname);
  };

  // ── Helpers ──────────────────────────────────────────────
  const allStudents = () => [
    ...students.map(s=>({name:s.name,type:"student",id:s.id})),
    ...fillins.map(s=>({name:s.name,type:"fillin",id:s.id})),
  ].sort((a,b)=>a.name.localeCompare(b.name));

  const allChecked = (evo) => CHECKLIST_ITEMS.every(k=>(evo.checklist||{})[k]);

  // ── Render guards ────────────────────────────────────────
  if(screen==="pin") return <PinScreen onLogin={handleLogin}/>;
  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",gap:12,color:"#666"}}>
    <div style={{width:20,height:20,border:"2px solid #e0ddd8",borderTopColor:"#1a1a1a",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
    Loading...
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;

  const evo = evolutions[currentEvoIdx];
  const tabs = ["evolutions","roster","scenarios",...(role==="admin"?["admin"]:[])];

  return (
    <div style={S.app}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        select,input{outline:none}
        select:focus,input:focus{box-shadow:0 0 0 2px rgba(24,95,165,0.3)}
        .tab-btn{padding:10px 14px;font-size:13px;cursor:pointer;border:none;border-bottom:2px solid transparent;color:#666;background:none;white-space:nowrap;font-family:inherit}
        .tab-btn:hover{color:#1a1a1a}
        .tab-btn.active{color:#1a1a1a;border-bottom-color:#1a1a1a;font-weight:600}
        .check-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #e0ddd8;border-radius:8px;background:#f4f3f0;cursor:pointer;font-size:12px;user-select:none;transition:background 0.1s,border-color 0.1s}
        .check-item.checked{background:#EAF3DE;border-color:#639922;color:#3B6D11}
        .hover-row:hover td{background:#f4f3f0}
        .roster-th{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.06em;background:#f4f3f0;padding:8px 12px;text-align:left;border-bottom:1px solid #e0ddd8}
        .roster-td{padding:8px 12px;font-size:13px;border-bottom:1px solid #e0ddd8}
      `}</style>
      <Toast msg={toastMsg}/>

      {/* Clock Bar */}
      <div style={S.clockBar}>
        <div>
          <div style={S.clockLbl}>Current Time</div>
          <LiveClock/>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={S.clockLbl}>Burn Day</div>
          <div style={{color:"#ccc",fontSize:14,fontWeight:600}}>{burnDay?.date||""}</div>
        </div>
      </div>

      {/* Topbar */}
      <div style={S.topbar}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700}}>🔥 Live Fire Training — Burn Day Manager</div>
          <div style={{fontSize:11,color:"#999",marginTop:2}}>
            {evolutions.length} evolution(s){saving?" · Saving…":""}
          </div>
          <input
            type="text"
            placeholder="Burn Day Title (e.g. 2026 High School Level 2)"
            value={burnDayTitle}
            onChange={e=>updateBurnDayTitle(e.target.value)}
            style={{fontSize:13,padding:"4px 10px",border:"1px solid #e0ddd8",borderRadius:6,
              marginTop:6,width:"100%",maxWidth:380,fontFamily:"inherit",color:"#1a1a1a",background:"#f9f8f6"}}
          />
        </div>
        <div style={S.topbarR}>
          <span style={{padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600,...(role==="admin"?{background:"#EAF3DE",color:"#3B6D11"}:{background:"#E6F1FB",color:"#185FA5"})}}>
            {role==="admin"?"Admin":"Standard"}
          </span>
          <button style={S.btn} onClick={()=>{setScreen("pin");setRole(null);}}>Lock</button>
          {activeTab==="evolutions"&&<>
            <button style={{...S.btn}} onClick={()=>{setDraftName(burnDayTitle||"");setShowSaveDraft(true);}}>Save Draft</button>
            <button style={{...S.btn}} onClick={()=>setShowDraftModal(true)}>Open Draft</button>
            <button style={{...S.btn}} onClick={startNew}>Start New</button>
            <button style={S.btnSuccess} onClick={finishBurnDay}>Finish Burn Day →</button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {tabs.map(t=><button key={t} className={`tab-btn${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>
          {t.charAt(0).toUpperCase()+t.slice(1)}
        </button>)}
      </div>

      {/* Content */}
      <div style={S.content}>
        {activeTab==="evolutions"&&<EvoTab scenarios={scenarios}
          evolutions={evolutions} currentEvoIdx={currentEvoIdx} setCurrentEvoIdx={setCurrentEvoIdx}
          evo={evo} allChecked={allChecked} allStudents={allStudents}
          instructors={instructors} savedTeams={savedTeams}
          updEvo={updEvo} updPos={updPos} togCheck={togCheck}
          stampTime={stampTime} updTs={updTs} updTemp={updTemp} finalizeTemp={finalizeTemp}
          updTeam={updTeam} autoFillTeam={autoFillTeam} addEvolution={addEvolution}
        />}
        {activeTab==="roster"&&<RosterTab
          rosterTab={rosterTab} setRosterTab={setRosterTab}
          instructors={instructors} students={students} fillins={fillins} savedTeams={savedTeams}
          allStudents={allStudents}
          addInstructor={addInstructor} removeInstructor={removeInstructor}
          addStudent={addStudent} removeStudent={removeStudent}
          addFillin={addFillin} removeFillin={removeFillin}
          createSavedTeam={createSavedTeam} removeSavedTeam={removeSavedTeam}
          addMemberToTeam={addMemberToTeam} removeMemberFromTeam={removeMemberFromTeam}
        />}
        {activeTab==="scenarios"&&<ScenariosTab scenarios={scenarios} role={role} addScenario={addScenario} deleteScenario={deleteScenario} uploadScenarioPDF={uploadScenarioPDF} removeScenarioPDF={removeScenarioPDF}/>}
        {activeTab==="admin"&&<AdminTab
          history={history} historyEvos={historyEvos}
          toggleHistEvos={toggleHistEvos} exportHistory={exportHistory}
          config={config} setConfig={setConfig} showToast={showToast}
        />}
      </div>
    {/* Footer */}
      <div style={{background:"#000000",borderTop:"1px solid #111",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
        <img src="/tnr-logo.png" alt="Tech N Rescue Innovations" style={{width:95,height:95,objectFit:"contain"}}/>
        <div style={{color:"#666",fontSize:19,letterSpacing:"0.08em"}}>A TECH N RESCUE INNOVATIONS PRODUCT</div>
      </div>

    {/* Save Draft Modal */}
      {showSaveDraft&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:32,width:340,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <h2 style={{fontSize:16,fontWeight:700,marginBottom:16}}>Save Draft</h2>
            <label style={S.lbl}>Draft Name</label>
            <input style={{...S.input,marginTop:6,marginBottom:16}} type="text"
              placeholder="e.g. Morning Session" autoFocus
              value={draftName} onChange={e=>setDraftName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveDraft(draftName)}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={S.btn} onClick={()=>{setShowSaveDraft(false);setDraftName("");}}>Cancel</button>
              <button style={S.btnPrimary} onClick={()=>saveDraft(draftName)}>Save Draft</button>
            </div>
          </div>
        </div>
      )}

      {/* Open Draft Modal */}
      {showDraftModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:32,width:480,maxHeight:"70vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <h2 style={{fontSize:16,fontWeight:700,marginBottom:16}}>Open Draft</h2>
            {!drafts.length&&<p style={{color:"#999",fontSize:13}}>No drafts saved yet.</p>}
            {drafts.map(d=>(
              <div key={d.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #e0ddd8"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{d.name}</div>
                  <div style={{fontSize:11,color:"#999",marginTop:2}}>
                    {d.evolutions?.length||0} evolution(s) · Saved {new Date(d.updated_at).toLocaleString()}
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={S.btnPrimary} onClick={()=>openDraft(d)}>Open</button>
                  <button style={{...S.btnDanger,...S.btnSm}} onClick={()=>deleteDraft(d.id)}>Delete</button>
                </div>
              </div>
            ))}
            <div style={{marginTop:16,textAlign:"right"}}>
              <button style={S.btn} onClick={()=>setShowDraftModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Evolution Tab ─────────────────────────────────────────
function EvoTab({evolutions,currentEvoIdx,setCurrentEvoIdx,evo,allChecked,allStudents,instructors,savedTeams,updEvo,updPos,togCheck,stampTime,updTs,updTemp,finalizeTemp,updTeam,autoFillTeam,addEvolution,scenarios}) {
  const SCENARIOS = Array.from({length:12},(_,i)=>String(i+1));
  if(!evo) return <div style={{padding:40,textAlign:"center",color:"#999"}}>No evolutions yet.</div>;
  const allChk = allChecked(evo);
  const checkedCount = CHECKLIST_ITEMS.filter(k=>(evo.checklist||{})[k]).length;

  const instrOptions = (selected="") => [
    <option key="" value="">-- Select --</option>,
    ...instructors.map(i=><option key={i.id} value={`${i.name} (${i.odps})`} selected={selected===`${i.name} (${i.odps})`}>{i.name} ({i.odps})</option>)
  ];
  const memberOptions = (selected="") => [
    <option key="" value="">-- Select --</option>,
    ...allStudents().map(s=><option key={s.id} value={`${s.name}|${s.type}`} selected={selected===`${s.name}|${s.type}`}>{s.name}{s.type==="fillin"?" (Fill-in)":""}</option>)
  ];

  return <>
    {/* Evo nav */}
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
      {evolutions.map((e,i)=>(
        <button key={e.id} onClick={()=>setCurrentEvoIdx(i)}
          style={{padding:"5px 13px",borderRadius:20,fontSize:12,border:"1px solid #c8c5be",cursor:"pointer",
            ...(i===currentEvoIdx?{background:"#1a1a1a",color:"#fff",fontWeight:600}:{background:"#fff",color:"#666"})}}>
          Evo {e.evo_number}
        </button>
      ))}
      <button style={S.btn} onClick={addEvolution}>+ Add Evolution</button>
    </div>

    {/* Header */}
    <div style={S.card}>
      <div style={S.row}>
        <div style={{...S.fg,maxWidth:110}}>
          <label style={S.lbl}>Evolution #</label>
          <input style={{...S.input,background:"#f4f3f0",color:"#999"}} value={evo.evo_number} readOnly/>
        </div>
        <div style={{...S.fg,maxWidth:200}}>
          <label style={S.lbl}>Scenario #</label>
          <select style={S.select} value={evo.scenario} onChange={e=>updEvo("scenario",e.target.value)}>
            <option value="">-- Select --</option>
            {scenarios && scenarios.length>0
              ? scenarios.map(s=><option key={s.id} value={String(s.number)}>{s.number} — {s.title}</option>)
              : SCENARIOS.map(n=><option key={n} value={n}>{n}</option>)
            }
          </select>
        </div>
        <div style={{...S.fg,maxWidth:200}}>
          <label style={S.lbl}>Date</label>
          <input type="date" style={S.input} value={evo.date} onChange={e=>updEvo("date",e.target.value)}/>
        </div>
      </div>
    </div>

    {/* Positions */}
    <div style={S.card}>
      <div style={S.secTitle}>Assigned Positions</div>
      <div style={S.row}>
        {POSITIONS.map(pos=>{
          const pval=(evo.positions||{})[pos]||"";
          const pcolor=pval?(pos==="EMS Officer"?{background:"#1a4fa8",color:"#fff",fontWeight:600}:{background:"#A32D2D",color:"#fff",fontWeight:600}):{};
          return(
          <div key={pos} style={S.fg}>
            <label style={S.lbl}>{pos}</label>
            <select style={{...S.select,...pcolor}}
              value={pval} onChange={e=>updPos(pos,e.target.value)}>
              {instrOptions(pval)}
            </select>
          </div>
          );
        })}
      </div>
    </div>

    {/* Checklist */}
    <div style={S.card}>
      <div style={S.secTitle}>Go / No-Go Checklist</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:12}}>
        {CHECKLIST_ITEMS.map(item=>(
          <div key={item} className={`check-item${(evo.checklist||{})[item]?" checked":""}`} onClick={()=>togCheck(item)}>
            <input type="checkbox" checked={!!(evo.checklist||{})[item]} onChange={()=>togCheck(item)}
              style={{width:15,height:15,accentColor:"#3B6D11",flexShrink:0}}/>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:"#666"}}>{checkedCount} / {CHECKLIST_ITEMS.length} complete</span>
        <button style={{padding:"13px 26px",fontSize:15,fontWeight:700,border:"none",borderRadius:8,color:"#fff",cursor:"pointer",letterSpacing:"0.03em",
          ...(allChk?{background:"#3B6D11",boxShadow:"0 2px 8px rgba(59,109,17,0.4)"}:{background:"#A32D2D",boxShadow:"0 2px 8px rgba(163,45,45,0.4)"})}}>
          {allChk?"✓ EVOLUTION GO":"⚠ NOT READY — START EVOLUTION"}
        </button>
      </div>
    </div>

    {/* Timestamps */}
    <div style={S.card}>
      <div style={S.secTitle}>Timestamps</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {TS_LABELS.map(label=>{
          const val = (evo.timestamps||{})[label]||"";
          const canNA = TS_NA_LABELS.includes(label);
          const isNA = val==="N/A";
          return (
          <div key={label} style={{display:"flex",flexDirection:"column",gap:4}}>
            <label style={S.lbl}>{label}</label>
            <div style={{display:"flex",gap:6}}>
              <input style={{...S.input,fontFamily:"'Courier New',monospace",flex:1,opacity:isNA?0.5:1}}
                type="text" value={val} placeholder="--:--:--"
                onChange={e=>updTs(label,e.target.value)}/>
              <button style={S.tsBtn} onClick={()=>stampTime(label)}>⏱ Stamp</button>
              {canNA&&<button
                style={{padding:"6px 10px",border:"1px solid #c8c5be",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",
                  ...(isNA?{background:"#A32D2D",color:"#fff",borderColor:"#A32D2D"}:{background:"#f4f3f0",color:"#666"})}}
                onClick={()=>updTs(label,isNA?"":"N/A")}>
                N/A
              </button>}
            </div>
          </div>
          );
        })}
      </div>
    </div>

    {/* Temps */}
    <div style={S.card}>
      <div style={S.secTitle}>Temperatures</div>
      <div style={{display:"flex",gap:10}}>
        {TEMP_LABELS.map(t=>(
          <div key={t} style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
            <label style={S.lbl}>{t} Temp</label>
            <TempInput label={t} value={(evo.temps||{})[t]||""} onUpdate={updTemp} onFinalize={finalizeTemp}/>
          </div>
        ))}
      </div>
    </div>

    {/* Teams */}
    <div style={S.card}>
      <div style={S.secTitle}>Teams</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {TEAM_NAMES.map(team=>{
          const td = (evo.teams||{})[team]||{lfi1:"",lfi2:"",members:["","","",""]};
          return (
            <div key={team} style={S.teamBox}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={S.teamTitle}>{team}</div>
                <select style={{fontSize:11,padding:"3px 6px",border:"1px solid #c8c5be",borderRadius:6,maxWidth:160,fontFamily:"inherit"}}
                  onChange={e=>{autoFillTeam(team,e.target.value);e.target.value="";}}>
                  <option value="">Auto-fill from team...</option>
                  {savedTeams.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              {["lfi1","lfi2"].map((k,li)=>(
                <div key={k} style={{marginBottom:6}}>
                  <label style={{...S.lbl,fontSize:10}}>LFI Instructor {li+1}</label>
                  <select style={{...S.select,...(td[k]?{background:"#A32D2D",color:"#fff",fontWeight:600}:{})}}
                    value={td[k]||""} onChange={e=>updTeam(team,k,e.target.value)}>
                    {instrOptions(td[k]||"")}
                  </select>
                </div>
              ))}
              {[0,1,2,3,4].map(mi=>{
                const mv=(td.members||[])[mi]||"";
                const mtype=mv.includes("|")?mv.split("|")[1]:"student";
                const mcolor=mtype==="fillin"?{background:"#FFD700",color:"#1a1a1a",fontWeight:600}:mv?{background:"#1a1a1a",color:"#fff",fontWeight:600}:{};
                return(
                <div key={mi} style={{marginBottom:6}}>
                  <label style={{...S.lbl,fontSize:10}}>Member {mi+1}</label>
                  <select style={{...S.select,...mcolor}}
                    value={mv} onChange={e=>updTeam(team,"member",e.target.value,mi)}>
                    {memberOptions(mv)}
                  </select>
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  </>;
}

// ── Temp Input (controlled with onBlur finalize) ──────────
function TempInput({label,value,onUpdate,onFinalize}) {
  const [local,setLocal] = useState(value);
  useEffect(()=>setLocal(value),[value]);
  return (
    <input style={{...S.input}} type="text" value={local} placeholder="000°F" maxLength={7}
      onChange={e=>{setLocal(e.target.value);onUpdate(label,e.target.value);}}
      onBlur={e=>{onFinalize(label,e.target.value);}}
    />
  );
}

// ── Roster Tab ────────────────────────────────────────────
function RosterTab({rosterTab,setRosterTab,instructors,students,fillins,savedTeams,allStudents,addInstructor,removeInstructor,addStudent,removeStudent,addFillin,removeFillin,createSavedTeam,removeSavedTeam,addMemberToTeam,removeMemberFromTeam}) {
  const subtabs = ["instructors","students","fillins","teams"];
  return <>
    <div style={{display:"flex",borderBottom:"1px solid #e0ddd8",marginBottom:20,background:"#f4f3f0",margin:"-20px -20px 20px"}}>
      {subtabs.map(t=><button key={t} className={`tab-btn${rosterTab===t?" active":""}`} onClick={()=>setRosterTab(t)}>
        {t.charAt(0).toUpperCase()+t.slice(1)}
      </button>)}
    </div>
    {rosterTab==="instructors"&&<InstructorRoster instructors={instructors} addInstructor={addInstructor} removeInstructor={removeInstructor}/>}
    {rosterTab==="students"&&<StudentRoster students={students} addStudent={addStudent} removeStudent={removeStudent}/>}
    {rosterTab==="fillins"&&<FillinRoster fillins={fillins} addFillin={addFillin} removeFillin={removeFillin}/>}
    {rosterTab==="teams"&&<TeamBuilder savedTeams={savedTeams} allStudents={allStudents} createSavedTeam={createSavedTeam} removeSavedTeam={removeSavedTeam} addMemberToTeam={addMemberToTeam} removeMemberFromTeam={removeMemberFromTeam}/>}
  </>;
}

function InstructorRoster({instructors,addInstructor,removeInstructor}) {
  const [name,setName] = useState(""); const [odps,setOdps] = useState("");
  return <div style={S.card}>
    <div style={S.secTitle}>Instructors</div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <input style={{...S.input,flex:1,minWidth:140}} placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)}/>
      <input style={{...S.input,maxWidth:140}} placeholder="ODPS #" value={odps} onChange={e=>setOdps(e.target.value)}/>
      <button style={S.btnPrimary} onClick={()=>{addInstructor(name,odps);setName("");setOdps("");}}>+ Add</button>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><th className="roster-th">Name</th><th className="roster-th">ODPS #</th><th className="roster-th">Tag</th><th className="roster-th"></th></tr></thead>
      <tbody>{instructors.map(i=><tr key={i.id} className="hover-row">
        <td className="roster-td">{i.name}</td>
        <td className="roster-td">{i.odps}</td>
        <td className="roster-td"><span style={S.tag("instructor")}>{i.name}</span></td>
        <td className="roster-td"><button style={{...S.btnDanger,...S.btnSm}} onClick={()=>removeInstructor(i.id)}>Remove</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function StudentRoster({students,addStudent,removeStudent}) {
  const [name,setName] = useState("");
  return <div style={S.card}>
    <div style={S.secTitle}>Students / Crew</div>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <input style={{...S.input,flex:1}} placeholder="Last, First" value={name} onChange={e=>setName(e.target.value)}/>
      <button style={S.btnPrimary} onClick={()=>{addStudent(name);setName("");}}>+ Add</button>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><th className="roster-th">Name</th><th className="roster-th">Tag</th><th className="roster-th"></th></tr></thead>
      <tbody>{students.map(s=><tr key={s.id} className="hover-row">
        <td className="roster-td">{s.name}</td>
        <td className="roster-td"><span style={S.tag("student")}>{s.name}</span></td>
        <td className="roster-td"><button style={{...S.btnDanger,...S.btnSm}} onClick={()=>removeStudent(s.id)}>Remove</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function FillinRoster({fillins,addFillin,removeFillin}) {
  const [name,setName] = useState("");
  return <div style={S.card}>
    <div style={S.secTitle}>Fill-In Students</div>
    <p style={{fontSize:12,color:"#666",marginBottom:12}}>Fill-ins appear in yellow on the accountability board and are available in all team dropdowns.</p>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <input style={{...S.input,flex:1}} placeholder="Last, First" value={name} onChange={e=>setName(e.target.value)}/>
      <button style={S.btnPrimary} onClick={()=>{addFillin(name);setName("");}}>+ Add</button>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><th className="roster-th">Name</th><th className="roster-th">Tag</th><th className="roster-th"></th></tr></thead>
      <tbody>{fillins.map(s=><tr key={s.id} className="hover-row">
        <td className="roster-td">{s.name}</td>
        <td className="roster-td"><span style={S.tag("fillin")}>{s.name}</span></td>
        <td className="roster-td"><button style={{...S.btnDanger,...S.btnSm}} onClick={()=>removeFillin(s.id)}>Remove</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function TeamBuilder({savedTeams,allStudents,createSavedTeam,removeSavedTeam,addMemberToTeam,removeMemberFromTeam}) {
  const [newName,setNewName] = useState("");
  return <div style={S.card}>
    <div style={S.secTitle}>Saved Teams</div>
    <p style={{fontSize:12,color:"#666",marginBottom:12}}>Build reusable teams. Use the auto-fill dropdown on each evolution team card to instantly populate members.</p>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <input style={{...S.input,flex:1}} placeholder="Team name (e.g. Alpha Crew)" value={newName} onChange={e=>setNewName(e.target.value)}/>
      <button style={S.btnPrimary} onClick={()=>{createSavedTeam(newName);setNewName("");}}>+ Create Team</button>
    </div>
    {savedTeams.map(team=><TeamBuilderCard key={team.id} team={team} allStudents={allStudents} addMemberToTeam={addMemberToTeam} removeMemberFromTeam={removeMemberFromTeam} removeSavedTeam={removeSavedTeam}/>)}
  </div>;
}

function TeamBuilderCard({team,allStudents,addMemberToTeam,removeMemberFromTeam,removeSavedTeam}) {
  const [showPicker,setShowPicker] = useState(false);
  const [selected,setSelected] = useState([]);
  const alreadyIn = team.members.map(m=>m.name);
  const available = allStudents().filter(s=>!alreadyIn.includes(s.name));

  const toggleSel = (val) => {
    setSelected(prev=>prev.includes(val)?prev.filter(v=>v!==val):[...prev,val]);
  };
  const addSelected = () => {
    selected.forEach(val=>addMemberToTeam(team.id,val));
    setSelected([]); setShowPicker(false);
  };

  return <div style={{border:"1px solid #e0ddd8",borderRadius:8,overflow:"hidden",marginBottom:10}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#f4f3f0",borderBottom:"1px solid #e0ddd8"}}>
      <strong style={{fontSize:13}}>{team.name}</strong>
      <button style={{...S.btnDanger,...S.btnSm}} onClick={()=>removeSavedTeam(team.id)}>Delete Team</button>
    </div>
    <div style={{padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:6,minHeight:40}}>
      {team.members.length===0&&<span style={{fontSize:12,color:"#999"}}>No members yet — click Add Members</span>}
      {team.members.map(m=>(
        <span key={m.name} style={{...S.tag(m.type),cursor:"pointer"}} title="Click to remove" onClick={()=>removeMemberFromTeam(team.id,m.name)}>
          {m.name} ✕
        </span>
      ))}
    </div>
    <div style={{padding:"8px 12px",borderTop:"1px solid #e0ddd8"}}>
      {!showPicker
        ? <button style={S.btnPrimary} onClick={()=>setShowPicker(true)}>+ Add Members</button>
        : <div>
            <div style={{maxHeight:200,overflowY:"auto",border:"1px solid #e0ddd8",borderRadius:8,marginBottom:8}}>
              {available.length===0&&<div style={{padding:"10px 12px",fontSize:12,color:"#999"}}>All roster members already added</div>}
              {available.map(s=>{
                const val=`${s.name}|${s.type}`;
                const isSel=selected.includes(val);
                return(
                <div key={s.id} onClick={()=>toggleSel(val)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",cursor:"pointer",borderBottom:"1px solid #f0ede8",
                    background:isSel?"#EAF3DE":"#fff"}}>
                  <input type="checkbox" checked={isSel} onChange={()=>toggleSel(val)} style={{accentColor:"#3B6D11"}}/>
                  <span style={{...S.tag(s.type),margin:0}}>{s.name}</span>
                  {s.type==="fillin"&&<span style={{fontSize:10,color:"#999"}}>(Fill-in)</span>}
                </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#666"}}>{selected.length} selected</span>
              <button style={S.btnPrimary} onClick={addSelected} disabled={!selected.length}>Add {selected.length||""} Members</button>
              <button style={S.btn} onClick={()=>{setShowPicker(false);setSelected([]);}}>Cancel</button>
            </div>
          </div>
      }
    </div>
  </div>;
}


// ── Scenarios Tab ─────────────────────────────────────────
function ScenariosTab({scenarios,role,addScenario,deleteScenario,uploadScenarioPDF,removeScenarioPDF}) {
  const [num,setNum] = useState("");
  const [title,setTitle] = useState("");
  const [desc,setDesc] = useState("");
  const [lightbox,setLightbox] = useState(null); // index into withPDFs

  const withPDFs = scenarios.filter(s=>s.pdf_url);

  const prevSlide = () => setLightbox(i=>(i-1+withPDFs.length)%withPDFs.length);
  const nextSlide = () => setLightbox(i=>(i+1)%withPDFs.length);

  // keyboard nav
  useEffect(()=>{
    if(lightbox===null) return;
    const handler = (e)=>{
      if(e.key==="ArrowRight"||e.key==="ArrowDown") nextSlide();
      if(e.key==="ArrowLeft"||e.key==="ArrowUp") prevSlide();
      if(e.key==="Escape") setLightbox(null);
    };
    window.addEventListener("keydown",handler);
    return ()=>window.removeEventListener("keydown",handler);
  },[lightbox,withPDFs.length]);

  return <>
    {/* Fullscreen lightbox */}
    {lightbox!==null&&withPDFs[lightbox]&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:2000,
        display:"flex",flexDirection:"column"}}>
        {/* Lightbox header */}
        <div style={{background:"#111",padding:"10px 20px",display:"flex",alignItems:"center",
          justifyContent:"space-between",borderBottom:"1px solid #222",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{background:"#A32D2D",color:"#fff",fontWeight:700,fontSize:16,
              padding:"4px 12px",borderRadius:6}}>
              {withPDFs[lightbox].number}
            </span>
            <span style={{color:"#fff",fontWeight:600,fontSize:15}}>{withPDFs[lightbox].title}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{color:"#666",fontSize:12}}>{lightbox+1} of {withPDFs.length}</span>
            <a href={withPDFs[lightbox].pdf_url} target="_blank" rel="noreferrer"
              style={{color:"#4a9fd4",fontSize:12,fontWeight:600,textDecoration:"none"}}>
              Open Full Screen ↗
            </a>
            <button onClick={()=>setLightbox(null)}
              style={{background:"none",border:"1px solid #444",color:"#fff",borderRadius:6,
                padding:"5px 12px",cursor:"pointer",fontSize:13}}>
              ✕ Close
            </button>
          </div>
        </div>
        {/* PDF viewer */}
        <div style={{flex:1,position:"relative",display:"flex",alignItems:"stretch"}}>
          {/* Prev button */}
          <button onClick={prevSlide}
            style={{position:"absolute",left:0,top:0,bottom:0,width:56,background:"rgba(0,0,0,0.4)",
              border:"none",color:"#fff",fontSize:28,cursor:"pointer",zIndex:10,
              display:"flex",alignItems:"center",justifyContent:"center"}}
            disabled={withPDFs.length<=1}>‹</button>
          {/* PDF */}
          <iframe
            key={withPDFs[lightbox].id}
            src={withPDFs[lightbox].pdf_url+"#toolbar=1&navpanes=0"}
            style={{flex:1,border:"none",margin:"0 56px"}}
            title={`Scenario ${withPDFs[lightbox].number}`}
          />
          {/* Next button */}
          <button onClick={nextSlide}
            style={{position:"absolute",right:0,top:0,bottom:0,width:56,background:"rgba(0,0,0,0.4)",
              border:"none",color:"#fff",fontSize:28,cursor:"pointer",zIndex:10,
              display:"flex",alignItems:"center",justifyContent:"center"}}
            disabled={withPDFs.length<=1}>›</button>
        </div>
        {/* Thumbnail strip */}
        <div style={{background:"#111",borderTop:"1px solid #222",padding:"8px 12px",
          display:"flex",gap:8,overflowX:"auto",flexShrink:0}}>
          {withPDFs.map((sc,i)=>(
            <div key={sc.id} onClick={()=>setLightbox(i)}
              style={{flexShrink:0,cursor:"pointer",border:`2px solid ${i===lightbox?"#A32D2D":"#333"}`,
                borderRadius:6,overflow:"hidden",width:80}}>
              <div style={{background:i===lightbox?"#A32D2D":"#222",color:"#fff",
                fontSize:10,fontWeight:700,padding:"2px 0",textAlign:"center"}}>
                #{sc.number}
              </div>
              <iframe src={sc.pdf_url+"#toolbar=0&navpanes=0&scrollbar=0"}
                style={{width:"100%",height:90,border:"none",display:"block",pointerEvents:"none"}}
                title={`thumb ${sc.number}`}/>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* PDF Gallery strip — click to open lightbox */}
    {withPDFs.length>0&&(
      <div style={S.card}>
        <div style={{...S.secTitle,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Scenario PDFs — Click to View</span>
          <button style={{...S.btnPrimary,...S.btnSm}} onClick={()=>setLightbox(0)}>
            ▶ Slideshow View
          </button>
        </div>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,scrollSnapType:"x mandatory"}}>
          {withPDFs.map((sc,i)=>(
            <div key={sc.id} onClick={()=>setLightbox(i)}
              style={{flexShrink:0,width:180,scrollSnapAlign:"start",cursor:"pointer",
                border:"2px solid #e0ddd8",borderRadius:8,overflow:"hidden",
                transition:"border-color 0.15s",":hover":{borderColor:"#A32D2D"}}}>
              <div style={{background:"#1a1a1a",color:"#fff",padding:"5px 10px",
                fontSize:11,fontWeight:700,display:"flex",justifyContent:"space-between"}}>
                <span>#{sc.number}</span>
                <span style={{fontWeight:400,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap",maxWidth:90}}>{sc.title}</span>
              </div>
              <iframe src={sc.pdf_url+"#toolbar=0&navpanes=0&scrollbar=0"}
                style={{width:"100%",height:220,border:"none",display:"block",pointerEvents:"none"}}
                title={`Scenario ${sc.number}`}/>
              <div style={{background:"#f4f3f0",padding:"4px 8px",fontSize:10,color:"#666",textAlign:"center"}}>
                Tap to open
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Add new — admin only */}
    {role==="admin"&&<div style={S.card}>
      <div style={S.secTitle}>Add New Scenario</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
        <input style={{...S.input,maxWidth:80}} type="number" placeholder="#" value={num}
          onChange={e=>setNum(e.target.value)}/>
        <input style={{...S.input,flex:1,minWidth:180}} type="text" placeholder="Scenario title"
          value={title} onChange={e=>setTitle(e.target.value)}/>
      </div>
      <textarea
        placeholder="Description — setup, objectives, what crews should expect..."
        value={desc} onChange={e=>setDesc(e.target.value)}
        style={{...S.input,width:"100%",minHeight:80,resize:"vertical",marginBottom:10,fontFamily:"inherit"}}
      />
      <button style={S.btnPrimary}
        onClick={()=>{addScenario(num,title,desc);setNum("");setTitle("");setDesc("");}}>
        + Add Scenario
      </button>
    </div>}

    {!scenarios.length&&<div style={{...S.card,textAlign:"center",color:"#999",fontSize:13,padding:24}}>
      No scenarios yet. Add your first one above.
    </div>}

    {scenarios.map(sc=>(
      <ScenarioCard key={sc.id} sc={sc} role={role}
        deleteScenario={deleteScenario}
        uploadScenarioPDF={uploadScenarioPDF}
        removeScenarioPDF={removeScenarioPDF}
        onView={()=>setLightbox(withPDFs.findIndex(s=>s.id===sc.id))}
      />
    ))}
  </>;
}

function ScenarioCard({sc,role,deleteScenario,uploadScenarioPDF,removeScenarioPDF,onView}) {
  const fileRef = useRef(null);
  const [uploading,setUploading] = useState(false);
  const [dragging,setDragging] = useState(false);

  const handleUpload = async (file) => {
    if(!file||file.type!=="application/pdf") return;
    setUploading(true);
    await uploadScenarioPDF(sc.id, file);
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleUpload(e.dataTransfer.files[0]);
  };

  return (
    <div style={{...S.card,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flex:1}}>
          <span style={{background:"#1a1a1a",color:"#fff",fontWeight:700,fontSize:18,
            padding:"6px 14px",borderRadius:8,minWidth:48,textAlign:"center",flexShrink:0}}>
            {sc.number}
          </span>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{sc.title}</div>
            {sc.description&&<div style={{fontSize:12,color:"#666",marginTop:3,lineHeight:1.5}}>{sc.description}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {sc.pdf_url&&<button style={{...S.btnPrimary,...S.btnSm}} onClick={onView}>View PDF</button>}
          {role==="admin"&&<>
            {sc.pdf_url&&<button style={{...S.btnDanger,...S.btnSm}} onClick={()=>removeScenarioPDF(sc.id)}>Remove PDF</button>}
            <button style={{...S.btnDanger,...S.btnSm}} onClick={()=>deleteScenario(sc.id)}>Delete</button>
          </>}
        </div>
      </div>

      {/* Drag & drop — admin only */}
      {role==="admin"&&(
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          onClick={()=>fileRef.current.click()}
          style={{marginTop:12,border:`2px dashed ${dragging?"#A32D2D":"#c8c5be"}`,
            borderRadius:8,padding:"12px 16px",textAlign:"center",cursor:"pointer",
            background:dragging?"rgba(163,45,45,0.05)":"#f9f8f6",transition:"all 0.15s"}}>
          <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}}
            onChange={e=>handleUpload(e.target.files[0])}/>
          <span style={{fontSize:12,color:dragging?"#A32D2D":"#999"}}>
            {uploading?"Uploading..."
              :dragging?"Drop PDF here"
              :sc.pdf_url?"Drag & drop to replace PDF, or click to browse"
              :"Drag & drop PDF here, or click to browse"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Admin Tab ─────────────────────────────────────────────
function AdminTab({history,historyEvos,toggleHistEvos,exportHistory,config,setConfig,showToast}) {
  const [stdPin,setStdPin] = useState("");
  const [admPin,setAdmPin] = useState("");
  const savePins = async () => {
    if(!stdPin&&!admPin){showToast("No changes");return;}
    if(stdPin) await sb.from("app_config").upsert({key:"standard_pin",value:stdPin});
    if(admPin) await sb.from("app_config").upsert({key:"admin_pin",value:admPin});
    setConfig(prev=>({...prev,...(stdPin?{standard_pin:stdPin}:{}),...(admPin?{admin_pin:admPin}:{})}));
    setStdPin("");setAdmPin("");
    showToast("PINs updated");
  };
  return <>
    <div style={S.card}>
      <div style={S.secTitle}>Burn Day History</div>
      {!history.length?<p style={{fontSize:13,color:"#666",padding:"8px 0"}}>No archived burn days yet.</p>:
        history.map(bd=><div key={bd.id}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #e0ddd8"}}>
            <div>
              <strong>Burn Day — {bd.title||bd.date}</strong>
              <div style={{fontSize:12,color:"#666",marginTop:2}}>Archived {new Date(bd.archived_at).toLocaleString()}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={S.btn} onClick={()=>toggleHistEvos(bd.id)}>{historyEvos[bd.id]?"Hide":"View"} Evolutions</button>
              <button style={S.btnPrimary} onClick={()=>exportHistory(bd.id,bd.date,bd.title)}>Export PDF</button>
            </div>
          </div>
          {historyEvos[bd.id]&&<div style={{padding:"8px 0 8px 20px",background:"#f4f3f0",borderBottom:"1px solid #e0ddd8"}}>
            {historyEvos[bd.id].map(e=><div key={e.id} style={{fontSize:12,padding:"3px 0",display:"flex",gap:16}}>
              <strong>Evo {e.evo_number}</strong>
              <span>Scenario {e.scenario}</span>
              <span>{e.date}</span>
              <span style={{color:"#666"}}>{Object.values(e.checklist||{}).filter(Boolean).length}/13 checks</span>
            </div>)}
          </div>}
        </div>)
      }
    </div>
    <div style={S.card}>
      <div style={S.secTitle}>Change PINs</div>
      <div style={{display:"flex",gap:10,maxWidth:440,flexWrap:"wrap"}}>
        <div style={S.fg}><label style={S.lbl}>Standard PIN</label><input style={S.input} type="text" placeholder="New PIN" maxLength={8} value={stdPin} onChange={e=>setStdPin(e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Admin PIN</label><input style={S.input} type="text" placeholder="New PIN" maxLength={8} value={admPin} onChange={e=>setAdmPin(e.target.value)}/></div>
        <div style={{...S.fg,justifyContent:"flex-end",paddingTop:18}}><button style={S.btnPrimary} onClick={savePins}>Save PINs</button></div>
      </div>
    </div>
  </>;
}
