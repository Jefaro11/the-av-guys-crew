import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aajeoloaenfewxololpj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhamVvbG9hZW5mZXd4b2xvbHBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTU2ODEsImV4cCI6MjEwNjE5MTY4MX0.HySD4i9RNaoR62Tt6AVGXZlC3NWvjgSh3_aHNWS-lEI';
const CONFIG_URL = SUPABASE_URL + '/functions/v1/crew-web-config';
const APP_BASE = new URL('./', window.location.href).pathname;

// The browser uses a public Supabase key for Auth/database.
// The VAPID public key returned by crew-web-config is used only for Web Push.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dateFmt = v => { if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
const timeFmt = v => { if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); };
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

let session=null, profile=null, assignments=[], notifications=[], tab='events', pushEnabled=false;

function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.add('hidden'),3500); }
function loading(on,msg){ $('loading').classList.toggle('hidden',!on); if(msg) $('loadingText').textContent=msg; }
function show(id){ ['auth','app','loading'].forEach(x=>$(x).classList.add('hidden')); $(id).classList.remove('hidden'); }
function authLogin(){ $('loginTab').classList.add('active'); $('signupTab').classList.remove('active'); $('nameWrap').classList.add('hidden'); $('authTitle').textContent='Crew access'; $('authSubtitle').textContent='Sign in to see your AV Guys events and crew calls.'; $('authSubmit').textContent='Sign in'; $('signupNote').textContent=''; }
function authSignup(){ $('loginTab').classList.remove('active'); $('signupTab').classList.add('active'); $('nameWrap').classList.remove('hidden'); $('authTitle').textContent='Create your crew account'; $('authSubtitle').textContent='Use the same email address that The AV Guys has on your crew record.'; $('authSubmit').textContent='Create account'; $('signupNote').innerHTML='<div class="tiny">Check your email if confirmation is requested.</div>'; }
function render(){
  $('alertCount').textContent=String(notifications.filter(n=>!n.read_at).length);
  $('alertCount').classList.toggle('hidden',notifications.every(n=>n.read_at));
  $('tabEvents').classList.toggle('active',tab==='events'); $('tabAlerts').classList.toggle('active',tab==='alerts');
  $('pushButton').textContent=pushEnabled?'Notifications enabled':'Enable notifications';
  $('pushButton').disabled=pushEnabled; $('pushHint').classList.toggle('hidden',pushEnabled);
  $('main').innerHTML = tab==='events' ? eventsHtml() : alertsHtml();
}
function eventsHtml(){
  let h='<div class="hero card"><div class="section-title">My events</div><h1>Ready for the show.</h1><p>'+ (assignments.length?'Your confirmed crew calls are shown below.':'No crew events have been assigned to you yet.') +'</p></div>';
  h+='<div class="grid"><div class="stat"><div class="n">'+assignments.length+'</div><div class="l">Assigned events</div></div><div class="stat"><div class="n">'+notifications.filter(n=>!n.read_at).length+'</div><div class="l">Unread alerts</div></div></div>';
  if(!standalone()) h+='<div class="card notice"><strong>Add this app to your Home Screen</strong><div class="tiny">On iPhone: Safari → Share → Add to Home Screen. Then open the AV Guys Crew icon and enable notifications.</div></div>';
  if(!assignments.length) return h+'<div class="card"><div class="muted">Nothing assigned yet.</div><div class="tiny" style="margin-top:6px">When The AV Guys confirms an event and assigns you, it will appear here.</div></div>';
  return h+assignments.map(a=>{
    const e=a.events||{};
    return '<div class="event"><div class="event-head"><div><h3>'+esc(e.event_name||e.event_code||'Event')+'</h3><div class="tiny">'+esc(e.event_code||'')+'</div></div><span class="badge">'+esc(a.status||e.status||'Confirmed')+'</span></div>'+
      '<div class="meta"><div><span>Dates</span><strong>'+dateFmt(e.start_date)+(e.end_date?' – '+dateFmt(e.end_date):'')+'</strong></div>'+
      '<div><span>Venue</span><strong>'+esc(e.venue||'—')+'</strong></div><div><span>Your role</span><strong>'+esc(a.role||'—')+'</strong></div>'+
      '<div><span>Setup area</span><strong>'+esc(a.area||'—')+'</strong></div><div><span>Call time</span><strong>'+timeFmt(a.call_time)+'</strong></div>'+
      '<div><span>Finish</span><strong>'+timeFmt(a.finish_time)+'</strong></div></div><div class="actions"><button class="btn secondary" data-map="'+encodeURIComponent(e.venue||'')+'">Open venue</button></div></div>';
  }).join('');
}
function alertsHtml(){
  let h='<div class="hero card"><div class="section-title">Alerts</div><h1>Notifications</h1><p>Event confirmations and crew-plan changes.</p></div>';
  return h+(notifications.length?notifications.map(n=>'<div class="card"><div class="event-head"><div><strong>'+esc(n.title)+'</strong><div class="tiny" style="margin-top:5px">'+dateFmt(n.created_at)+' '+timeFmt(n.created_at)+'</div></div>'+(n.read_at?'':'<span class="badge">NEW</span>')+'</div><p class="muted">'+esc(n.body)+'</p>'+(n.read_at?'':'<button class="btn ghost" data-read="'+esc(n.id)+'">Mark read</button>')+'</div>').join(''):'<div class="card"><div class="muted">No notifications yet.</div></div>');
}
async function loadProfile(){ const r=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle(); if(r.error) throw r.error; profile=r.data||{full_name:session.user.user_metadata?.full_name||'',email:session.user.email||'',role:'crew'}; }
async function loadData(){
  const a=await supabase.from('crew_event_assignments').select('id,event_id,role,area,call_time,finish_time,status,events!crew_event_assignments_event_id_fkey(id,event_code,event_name,venue,start_date,end_date,status)').order('call_time',{ascending:true});
  if(a.error) throw a.error; assignments=a.data||[];
  const n=await supabase.from('notifications').select('id,event_id,event_code,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(50);
  if(n.error) throw n.error; notifications=n.data||[];
}
async function boot(){
  try{
    loading(true,'Loading crew portal…');
    const r=await supabase.auth.getSession(); if(r.error) throw r.error;
    session=r.data.session;
    if(!session){show('auth');authLogin();return;}
    await loadProfile(); await loadData(); show('app'); render();
  }catch(e){console.error(e);toast(e.message||String(e));show('auth');authLogin();}
  finally{loading(false);}
}
async function enablePush(){
  if(pushEnabled) return;
  if(!standalone()){toast('First add The AV Guys Crew to your Home Screen, then open it there.');return;}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast('Web Push is not supported on this device.');return;}
  try{
    const p=await Notification.requestPermission(); if(p!=='granted'){toast('Notifications were not enabled.');return;}
    const reg=await navigator.serviceWorker.register(APP_BASE+'sw.js',{scope:APP_BASE});
    const c=await fetch(CONFIG_URL); const cfg=await c.json(); if(!c.ok||!cfg.publicKey) throw new Error(cfg.error||'Could not load notification configuration');
    let sub=await reg.pushManager.getSubscription(); if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(cfg.publicKey)});
    const r=await supabase.from('devices').upsert({crew_user_id:session.user.id,expo_push_token:JSON.stringify(sub.toJSON()),platform:'web',active:true},{onConflict:'expo_push_token'});
    if(r.error) throw r.error; pushEnabled=true; render(); toast('Crew notifications enabled.');
  }catch(e){console.error(e);toast(e.message||String(e));}
}
function bytes(b64){const pad='='.repeat((4-b64.length%4)%4);const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw],c=>c.charCodeAt(0));}
async function markRead(id){const r=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(r.error)toast(r.error.message);else{await loadData();render();}}

$('loginTab').onclick=authLogin; $('signupTab').onclick=authSignup;
$('authForm').onsubmit=async e=>{e.preventDefault();try{loading(true,$('loginTab').classList.contains('active')?'Signing in…':'Creating account…');const email=$('email').value.trim(),password=$('password').value,name=$('fullName').value.trim();let r;if($('loginTab').classList.contains('active'))r=await supabase.auth.signInWithPassword({email,password});else r=await supabase.auth.signUp({email,password,options:{data:{full_name:name,role:'crew'}}});if(r.error)throw r.error;if(!r.data.session){toast('Account created. Check your email to confirm, then sign in.');authLogin();return;}await boot();}catch(e){toast(e.message||String(e));}finally{loading(false);}};
$('pushButton').onclick=enablePush; $('signOut').onclick=async()=>{await supabase.auth.signOut();session=null;show('auth');authLogin();};
$('tabEvents').onclick=()=>{tab='events';render();}; $('tabAlerts').onclick=()=>{tab='alerts';render();};
$('refresh').onclick=async()=>{try{loading(true,'Refreshing…');await loadData();render();}catch(e){toast(e.message||String(e));}finally{loading(false);}};
$('main').addEventListener('click',async e=>{const m=e.target.closest('[data-map]');if(m){const q=decodeURIComponent(m.dataset.map);if(q)window.open('https://maps.apple.com/?q='+encodeURIComponent(q),'_blank');}const r=e.target.closest('[data-read]');if(r)await markRead(r.dataset.read);});
boot();