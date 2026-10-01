const SUPABASE_URL="https://aajeoloaenfewxololpj.supabase.co";
const SUPABASE_KEY="sb_publishable_IwUHY90pADW53KoHEHvEtA_ik7r8Vlq";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let equipment=[],events=[],locations=[],maintenance=[],scanner=null,currentAllocations=[];

function esc(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
async function load(){
  const [a,b,c,d]=await Promise.all([
    sb.from("equipment_assets").select("*").order("equipment_item"),
    sb.from("events").select("*").order("start_date",{ascending:false}),
    sb.from("warehouse_locations").select("*").order("name"),
    sb.from("warehouse_maintenance").select("*").order("opened_at",{ascending:false})
  ]);
  equipment=a.data||[];events=b.data||[];locations=c.data||[];maintenance=d.data||[];
}
function page(p){
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
  $("title").textContent=p==="scan"?"Scan / Check in-out":p[0].toUpperCase()+p.slice(1);
  render(p);
}
function render(p){
  if(p==="dashboard")return dashboard();
  if(p==="equipment")return equipmentPage();
  if(p==="events")return eventsPage();
  if(p==="locations")return tablePage("Warehouse Locations",locations,["name","location_type","description"]);
  if(p==="maintenance")return tablePage("Maintenance",maintenance,["equipment_code","issue","priority","status","opened_at"]);
  if(p==="scan")return scanPage();
  if(p==="reports")return reports();
}
function eventsPage(){
  $("content").innerHTML='<div class="panel pick-panel"><div class="toolbar"><select id="eventPick"><option value="">Select event…</option>'+
    events.map(e=>'<option value="'+esc(e.event_code)+'">'+esc(e.event_code)+' — '+esc(e.event_name)+'</option>').join("")+
    '</select></div><div id="eventAlloc"></div></div>';
  $("eventPick").onchange=loadEventAlloc;
}
async function loadEventAlloc(){
  const code=$("eventPick").value;
  if(!code){$("eventAlloc").innerHTML='<div class="empty">Select an event to start packing.</div>';return}
  const e=events.find(x=>x.event_code===code);
  const r=await sb.from("equipment_event_allocations").select("*").eq("event_code",code).order("equipment_code");
  currentAllocations=r.data||[];
  const totals=currentAllocations.reduce((a,x)=>({
    required:a.required+x.required_qty,packed:a.packed+x.packed_qty,dispatched:a.dispatched+x.dispatched_qty,
    returned:a.returned+x.returned_qty,missing:a.missing+x.missing_qty,damaged:a.damaged+x.damaged_qty
  }),{required:0,packed:0,dispatched:0,returned:0,missing:0,damaged:0});
  $("eventAlloc").innerHTML=
    '<div class="pick-head"><div><span class="eyebrow">PICK & PACK</span><h3>'+esc(e?.event_name||code)+'</h3><p class="muted">'+esc(code)+(e?.venue?" · "+esc(e.venue):"")+'</p></div>'+
    '<button class="primary" onclick="addAllocation()">+ Add equipment</button></div>'+
    '<div class="workflow"><div class="step active"><b>1</b><span>Required</span><strong>'+totals.required+'</strong></div><div class="step"><b>2</b><span>Packed</span><strong>'+totals.packed+'</strong></div><div class="step"><b>3</b><span>Dispatched</span><strong>'+totals.dispatched+'</strong></div><div class="step"><b>4</b><span>Returned</span><strong>'+totals.returned+'</strong></div></div>'+
    '<div class="scan-pack"><div><label>Pack by scanning</label><div class="scan-row"><input id="packScan" placeholder="Scan equipment code / QR" autocomplete="off"><input id="packQty" type="number" min="1" value="1"><button class="primary" onclick="packScan()">Pack</button><button class="secondary" onclick="startPackScanner()">Camera</button></div><div id="packMsg" class="scan-msg"></div></div><div id="packReader" class="reader hidden"></div></div>'+
    '<div class="mobile-note">Scan an item to add it to this event. Use the action buttons to dispatch and process returns.</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Equipment</th><th>Required</th><th>Packed</th><th>Remaining</th><th>Dispatched</th><th>Returned</th><th>Missing</th><th>Damaged</th><th>Actions</th></tr></thead><tbody>'+
    currentAllocations.map(x=>allocationRow(x)).join("")+'</tbody></table></div>';
  $("packScan").onkeydown=e=>{if(e.key==="Enter")packScan()};
  $("packScan").focus();
}
function allocationRow(x){
  const remaining=Math.max(0,x.required_qty-x.packed_qty);
  const dispatchRemaining=Math.max(0,x.packed_qty-x.dispatched_qty);
  const returnRemaining=Math.max(0,x.dispatched_qty-x.returned_qty-x.damaged_qty);
  return '<tr><td><b>'+esc(x.equipment_code)+'</b><small>'+esc(equipment.find(e=>e.equipment_code===x.equipment_code)?.equipment_item||"")+'</small></td>'+
    '<td>'+x.required_qty+'</td><td>'+x.packed_qty+'</td><td><span class="pill '+(remaining?"warn":"good")+'">'+remaining+'</span></td><td>'+x.dispatched_qty+'</td><td>'+x.returned_qty+'</td><td>'+(x.missing_qty||0)+'</td><td>'+(x.damaged_qty||0)+'</td>'+
    '<td><div class="action-group">'+
    '<button class="mini" '+(remaining?'':'disabled')+' onclick="packAllocation(\''+x.equipment_code+'\')">Pack</button>'+
    '<button class="mini" '+(dispatchRemaining?'':'disabled')+' onclick="dispatchAllocation(\''+x.equipment_code+'\')">Dispatch</button>'+
    '<button class="mini" '+(returnRemaining?'':'disabled')+' onclick="returnAllocation(\''+x.equipment_code+'\')">Return</button>'+
    '</div></td></tr>';
}
async function addAllocation(){
  const code=$("eventPick").value;if(!code)return;
  const options=equipment.filter(x=>x.active!==false).map(x=>x.equipment_code+" — "+x.equipment_item).join("\n");
  const eq=prompt("Equipment code:\n\n"+options);if(!eq)return;
  const found=equipment.find(x=>x.equipment_code.toLowerCase()===eq.trim().toLowerCase());
  if(!found)return alert("Equipment code not found.");
  const qty=Math.max(1,Number(prompt("Required quantity","1")||1));
  const r=await sb.rpc("warehouse_event_update",{p_event_code:code,p_equipment_code:found.equipment_code,p_stage:"required",p_quantity:qty});
  if(r.error)alert(r.error.message);else loadEventAlloc();
}
async function allocationFor(code,equipmentCode){
  const x=currentAllocations.find(a=>a.equipment_code===equipmentCode);
  if(x)return x;
  const r=await sb.from("equipment_event_allocations").select("*").eq("event_code",code).eq("equipment_code",equipmentCode).single();
  return r.data;
}
async function updateStage(equipmentCode,stage,qty){
  const code=$("eventPick").value;
  const r=await sb.rpc("warehouse_event_update",{p_event_code:code,p_equipment_code:equipmentCode,p_stage:stage,p_quantity:qty});
  if(r.error){setPackMsg(r.error.message,true);return false}
  await loadEventAlloc();return true;
}
async function packAllocation(equipmentCode){
  const x=await allocationFor($("eventPick").value,equipmentCode);if(!x)return;
  const qty=Math.min(x.required_qty-x.packed_qty,1);
  if(qty>0)await updateStage(equipmentCode,"packed",x.packed_qty+qty);
}
async function packScan(){
  const input=$("packScan"),raw=input.value.trim(),qty=Math.max(1,Number($("packQty").value||1));
  if(!raw){setPackMsg("Scan an equipment code or QR first.",true);return}
  const found=equipment.find(x=>x.equipment_code===raw||x.qr_code===raw);
  if(!found){setPackMsg("Equipment not found: "+raw,true);return}
  const x=await allocationFor($("eventPick").value,found.equipment_code);
  if(!x){setPackMsg(found.equipment_code+" is not required for this event.",true);return}
  const remaining=Math.max(0,x.required_qty-x.packed_qty);
  if(!remaining){setPackMsg(found.equipment_code+" is already fully packed.",true);return}
  const ok=await updateStage(found.equipment_code,"packed",x.packed_qty+Math.min(qty,remaining));
  if(ok)input.value="";
}
async function dispatchAllocation(equipmentCode){
  const x=await allocationFor($("eventPick").value,equipmentCode);if(!x)return;
  const qty=Math.max(1,Number(prompt("Dispatch quantity",String(Math.max(1,x.packed_qty-x.dispatched_qty)))||1));
  const remaining=x.packed_qty-x.dispatched_qty;
  if(qty>remaining)return alert("You can only dispatch packed quantity ("+remaining+").");
  const r=await sb.rpc("warehouse_scan",{p_equipment_code:equipmentCode,p_action:"checkout",p_quantity:qty,p_event_code:$("eventPick").value,p_note:"Event dispatch"});
  if(r.error)return alert(r.error.message);
  await load();await loadEventAlloc();
}
async function returnAllocation(equipmentCode){
  const x=await allocationFor($("eventPick").value,equipmentCode);if(!x)return;
  const remaining=Math.max(0,x.dispatched_qty-x.returned_qty-x.damaged_qty);
  const qty=Math.max(1,Number(prompt("Return quantity",String(remaining||1))||1));
  if(qty>remaining)return alert("Return quantity exceeds the outstanding dispatched quantity ("+remaining+").");
  const r=await sb.rpc("warehouse_scan",{p_equipment_code:equipmentCode,p_action:"checkin",p_quantity:qty,p_event_code:$("eventPick").value,p_note:"Event return"});
  if(r.error)return alert(r.error.message);
  await load();await loadEventAlloc();
}
function setPackMsg(msg,error=false){const el=$("packMsg");if(el)el.className="scan-msg "+(error?"danger":"good");if(el)el.textContent=msg}
async function startPackScanner(){
  if(!window.Html5Qrcode){setPackMsg("Camera scanner is still loading. Try again.",true);return}
  const reader=$("packReader");reader.classList.remove("hidden");
  if(scanner){try{await scanner.stop()}catch{}}
  scanner=new Html5Qrcode("packReader");
  try{
    await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},async text=>{
      $("packScan").value=text;try{await scanner.stop()}catch{}scanner=null;reader.classList.add("hidden");await packScan();
    },()=>{});
  }catch(e){reader.classList.add("hidden");setPackMsg("Camera unavailable. Allow camera access and use HTTPS.",true)}
}
function dashboard(){$("content").innerHTML='<div class="grid"><div class="stat"><label>Equipment lines</label><strong>'+equipment.length+'</strong></div><div class="stat"><label>Total units</label><strong>'+equipment.reduce((s,x)=>s+(x.total_quantity||0),0)+'</strong></div><div class="stat"><label>Available units</label><strong>'+equipment.reduce((s,x)=>s+(x.available_quantity||0),0)+'</strong></div><div class="stat"><label>Open repairs</label><strong>'+maintenance.filter(x=>x.status!=="closed").length+'</strong></div></div><div class="panel"><h3>Upcoming events</h3>'+events.slice(0,8).map(e=>'<div class="event-line"><b>'+esc(e.event_name)+'</b><span>'+esc(e.start_date||"—")+' · '+esc(e.status||"")+'</span></div>').join("")+'</div>'}
function equipmentPage(){$("content").innerHTML='<div class="panel"><div class="toolbar"><input id="q" placeholder="Search equipment, code, category…"><button class="primary" onclick="addEquipment()">+ Add equipment</button></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Equipment</th><th>Category</th><th>Location</th><th>Total</th><th>Available</th><th>Condition</th></tr></thead><tbody id="rows"></tbody></table></div></div>';const draw=()=>{let q=($("q").value||"").toLowerCase();$("rows").innerHTML=equipment.filter(x=>(x.equipment_code+" "+x.equipment_item+" "+(x.category||"")).toLowerCase().includes(q)).map(x=>'<tr><td>'+esc(x.equipment_code)+'</td><td><b>'+esc(x.equipment_item)+'</b></td><td>'+esc(x.category||"—")+'</td><td>'+esc(x.location||"—")+'</td><td>'+x.total_quantity+'</td><td>'+x.available_quantity+'</td><td><span class="pill '+(x.condition==="good"?"good":"warn")+'">'+esc(x.condition||"unknown")+'</span></td></tr>').join("")};$("q").oninput=draw;draw()}
async function addEquipment(){let code=prompt("Equipment code");if(!code)return;let item=prompt("Equipment name");if(!item)return;let category=prompt("Category");let qty=Number(prompt("Quantity","1")||1);const r=await sb.from("equipment_assets").insert({equipment_code:code,equipment_item:item,category,total_quantity:qty,available_quantity:qty,active:true,condition:"good",maintenance_status:"ready"});if(r.error)alert(r.error.message);else{await load();equipmentPage()}}
function tablePage(title,arr,cols){$("content").innerHTML='<div class="panel"><div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+c.replaceAll("_"," ")+'</th>').join("")+'</tr></thead><tbody>'+arr.map(x=>'<tr>'+cols.map(c=>'<td>'+esc(x[c]??"—")+'</td>').join("")+'</tr>').join("")+'</tbody></table></div></div>'}
function scanPage(){$("content").innerHTML='<div class="panel"><h3>Equipment check-in / check-out</h3><p>Use this for general warehouse movements. For an event, the Pick & Pack screen is recommended.</p><div class="toolbar"><input id="scanCode" placeholder="Scan equipment code / QR" autofocus><select id="action"><option value="checkout">Check out</option><option value="checkin">Check in</option></select><input id="scanEvent" placeholder="Event code (optional)"><input id="qty" type="number" value="1" min="1"><button class="primary" onclick="scan()">Apply</button></div><div id="scanResult"></div></div>'}
async function scan(){let code=$("scanCode").value.trim(),qty=Math.max(1,Number($("qty").value||1)),act=$("action").value,event=$("scanEvent").value.trim()||null;if(!code){$("scanResult").innerHTML='<p class="danger">Scan or enter an equipment code.</p>';return}$("scanResult").innerHTML="<p>Processing…</p>";const r=await sb.rpc("warehouse_scan",{p_equipment_code:code,p_action:act,p_quantity:qty,p_event_code:event,p_note:null});if(r.error){$("scanResult").innerHTML='<p class="danger">'+esc(r.error.message)+'</p>';return}await load();const d=r.data;$("scanResult").innerHTML='<p class="good">✓ '+esc(d.equipment_item)+' — available: <b>'+d.available_quantity+'</b></p>';$("scanCode").value="";$("scanCode").focus()}
function reports(){$("content").innerHTML='<div class="grid"><div class="stat"><label>Inventory lines</label><strong>'+equipment.length+'</strong></div><div class="stat"><label>Allocated / away</label><strong>'+equipment.reduce((s,x)=>s+(x.total_quantity-x.available_quantity),0)+'</strong></div><div class="stat"><label>Locations</label><strong>'+locations.length+'</strong></div><div class="stat"><label>Maintenance cases</label><strong>'+maintenance.length+'</strong></div></div><div class="panel"><h3>Inventory by category</h3>'+[...new Set(equipment.map(x=>x.category||"Uncategorised"))].map(c=>'<div class="event-line"><b>'+esc(c)+'</b><span>'+equipment.filter(x=>(x.category||"Uncategorised")===c).length+' lines</span></div>').join("")+'</div>'}
document.querySelectorAll(".nav").forEach(x=>x.onclick=()=>page(x.dataset.page));
$("refresh").onclick=async()=>{await load();page(document.querySelector(".nav.active").dataset.page)};
$("loginBtn").onclick=async()=>{let r=await sb.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(r.error)$("loginMsg").textContent=r.error.message};
$("logout").onclick=()=>sb.auth.signOut();
sb.auth.onAuthStateChange((event,session)=>{if(session){$("login").classList.add("hidden");$("app").classList.remove("hidden");load().then(()=>page("dashboard"))}else{$("login").classList.remove("hidden");$("app").classList.add("hidden")}});
