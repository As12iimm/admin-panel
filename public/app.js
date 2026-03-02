let accessToken = localStorage.getItem('accessToken') || '';
let refreshToken = localStorage.getItem('refreshToken') || '';
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let mfaChallengeToken = '';

function hasPermission(action) { return (currentUser?.permissions || []).includes(action); }

async function api(path, method = 'GET', body, retry = true) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (res.status === 401 && retry && refreshToken) { const ok = await refreshAccessToken(); if (ok) return api(path, method, body, false); }
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

async function refreshAccessToken() {
  try {
    const data = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) }).then((r) => r.json());
    if (!data.accessToken) return false;
    accessToken = data.accessToken; refreshToken = data.refreshToken;
    localStorage.setItem('accessToken', accessToken); localStorage.setItem('refreshToken', refreshToken);
    return true;
  } catch { return false; }
}

function show(id, visible) { document.getElementById(id)?.classList.toggle('hidden', !visible); }
function showApp() { show('loginView', false); show('mfaView', false); show('appView', true); welcomeLine.textContent = `${currentUser?.name || 'User'} (${currentUser?.role || ''})`; applyPermissionGuards(); }
function showLogin() { show('loginView', true); show('mfaView', false); show('appView', false); }
function showMfa() { show('loginView', false); show('mfaView', true); show('appView', false); }
function persistAuth() { localStorage.setItem('accessToken', accessToken); localStorage.setItem('refreshToken', refreshToken); localStorage.setItem('user', JSON.stringify(currentUser)); }

async function login() {
  const data = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), password: password.value, deviceName: 'web' }) }).then((r) => r.json());
  if (data.mfaRequired) { mfaChallengeToken = data.challengeToken; mfaHint.textContent = `OTP sent. (Dev OTP: ${data.devOtp})`; showMfa(); return; }
  if (!data.accessToken) { loginMsg.textContent = data.message || 'Login failed'; return; }
  accessToken = data.accessToken; refreshToken = data.refreshToken; currentUser = data.user; persistAuth(); showApp(); bindNav(); await loadAll();
}

async function verifyMfa() {
  const data = await fetch('/api/auth/mfa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeToken: mfaChallengeToken, code: mfaCode.value.trim(), deviceName: 'web' }) }).then((r) => r.json());
  if (!data.accessToken) { mfaMsg.textContent = data.message || 'Invalid OTP'; return; }
  accessToken = data.accessToken; refreshToken = data.refreshToken; currentUser = data.user; persistAuth(); showApp(); bindNav(); await loadAll();
}

async function requestPasswordReset() { const data = await fetch('/api/auth/password-reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim() }) }).then((r) => r.json()); loginMsg.textContent = `Reset requested. Dev token: ${data.devResetToken || '-'}`; }
async function logout() { try { if (accessToken) await api('auth/logout', 'POST'); } catch {} localStorage.clear(); accessToken=''; refreshToken=''; currentUser=null; showLogin(); }

function row(cols){ return `<div class="row-item">${cols.map((c)=>`<div>${c ?? '-'}</div>`).join('')}</div>`; }
function renderTable(id, rows){ const el=document.getElementById(id); if(el) el.innerHTML=rows.length?rows.join(''):'<div class="row-item"><div>No data</div><div>-</div><div>-</div><div>-</div></div>'; }

function applyPermissionGuards() {
  const map = { crm:'manage_pilgrims', leads:'manage_leads', packages:'manage_packages', bookings:'manage_bookings', finance:'manage_invoices', phase2:'manage_medical', security:'manage_security' };
  document.querySelectorAll('.nav[data-page]').forEach((btn)=>{ const action = map[btn.dataset.page] || 'view_dashboard'; btn.classList.toggle('hidden', !hasPermission(action)); });
}

async function loadStats(){ const s=await api('dashboard/stats'); stats.innerHTML=[['Pilgrims',s.pilgrims],['Leads',s.leads],['Packages',s.packages],['Bookings',s.bookings],['Medical Pending',s.medicalPending],['Compliance Pending',s.compliancePending],['Overdue Tasks',s.overdueTasks],['Overdue Installments',s.overdueInstallments],['Received',`$${s.received}`]].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join(''); }

// CRM
async function loadPilgrims(){ const d=await api('pilgrims'); renderTable('pilgrimsList',d.map((p)=>row([p._id,p.fullName,p.passportNo,p.visaStage]))); }
async function addPilgrim(){ if(!pilgrimName.value.trim()) return; await api('pilgrims','POST',{fullName:pilgrimName.value.trim(),passportNo:pilgrimPassport.value.trim(),familyGroupId:pilgrimFamily.value.trim()}); await loadPilgrims(); }
async function addTimelineNote(){ if(!notePilgrimId.value.trim()||!noteText.value.trim())return; await api('pilgrim-notes','POST',{pilgrimId:notePilgrimId.value.trim(),note:noteText.value.trim(),type:'activity'}); await loadNotes(); }
async function loadNotes(){ const d=await api('pilgrim-notes'); renderTable('notesList',d.map((n)=>row([n.pilgrimId,n.type,n.note,new Date(n.createdAt).toLocaleString()]))); }
async function addTravelHistory(){ if(!travelPilgrimId.value.trim())return; await api('pilgrim-travel-history','POST',{pilgrimId:travelPilgrimId.value.trim(),packageName:travelPackage.value.trim(),tripType:'umrah',status:'planned'}); await loadTravelHistory(); }
async function loadTravelHistory(){ const d=await api('pilgrim-travel-history'); renderTable('travelList',d.map((t)=>row([t.pilgrimId,t.tripType,t.packageName,t.status]))); }
async function uploadPilgrimDocument(){ const file=docFile.files[0]; if(!docPilgrimId.value.trim()||!file) return; const arr=await file.arrayBuffer(); let bin=''; const b=new Uint8Array(arr); for(let i=0;i<b.byteLength;i++) bin += String.fromCharCode(b[i]); await api('pilgrim-documents/upload','POST',{pilgrimId:docPilgrimId.value.trim(),fileName:docName.value.trim()||file.name,mimeType:file.type,category:docCategory.value,base64Data:btoa(bin)}); await loadPilgrimDocuments(); }
async function loadPilgrimDocuments(){ const d=await api('pilgrim-documents'); renderTable('docsList',d.map((x)=>row([x._id,x.fileName,x.category,`${x.size} bytes`]))); }

// Leads
async function loadLeads(){ const d=await api('leads'); const stages=['new','follow_up','qualified','proposal_sent','converted','lost']; kanbanBoard.innerHTML=stages.map((s)=>`<div class="kan-col"><h5>${s}</h5>${d.filter(l=>l.status===s).map(l=>`<div class="kan-card"><b>${l.fullName}</b><br/>${l.source||'-'} / ${l.campaign||'-'}<br/><select onchange="moveLeadStage('${l._id}', this.value)">${stages.map(o=>`<option ${o===l.status?'selected':''}>${o}</option>`).join('')}</select></div>`).join('')}</div>`).join(''); }
async function addLead(){ if(!leadName.value.trim()) return; await api('leads','POST',{fullName:leadName.value.trim(),phone:leadPhone.value.trim(),source:leadSource.value.trim()||'walk_in',campaign:leadCampaign.value.trim()||'direct',slaDueAt:new Date(Date.now()+24*3600*1000)}); await loadLeads(); }
async function moveLeadStage(id,status){ await api(`leads/${id}/stage`,'PATCH',{status}); await loadLeads(); }
async function addLeadTask(){ if(!taskLeadId.value.trim()||!taskTitle.value.trim()||!taskDue.value) return; await api('lead-tasks','POST',{leadId:taskLeadId.value.trim(),title:taskTitle.value.trim(),dueAt:taskDue.value}); await loadLeadTasks(); }
async function refreshOverdueTasks(){ await api('lead-tasks/recompute-overdue','POST'); await loadLeadTasks(); }
async function loadLeadTasks(){ const d=await api('lead-tasks'); renderTable('tasksList',d.map((t)=>row([t.leadId,t.title,new Date(t.dueAt).toLocaleString(),t.status]))); }
async function loadLeadAnalytics(){ const d=await api('leads/analytics/summary'); leadAnalytics.textContent = JSON.stringify(d,null,2); }

// Packages/Bookings
async function addPackage(){ if(!packageTitle.value.trim())return; await api('packages','POST',{title:packageTitle.value.trim(),type:packageType.value,capacity:Number(packageCapacity.value||0),basePrice:Number(packagePrice.value||0)}); await loadPackages(); }
async function loadPackages(){ const d=await api('packages'); renderTable('packagesList',d.map((p)=>row([p._id,p.title,`${p.bookedSeats}/${p.capacity}`,`$${p.basePrice}`]))); }
async function createBooking(){ if(!bookingPilgrimId.value.trim()||!bookingPackageId.value.trim()) return; await api('bookings/create','POST',{pilgrimId:bookingPilgrimId.value.trim(),packageId:bookingPackageId.value.trim(),roomType:bookingRoom.value,roomAllocation:bookingRoomAlloc.value,totalAmount:Number(bookingAmount.value||0)}); await loadBookings(); await loadPackages(); }
async function cancelBooking(){ if(!cancelBookingId.value.trim()) return; await api(`bookings/${cancelBookingId.value.trim()}/cancel`,'POST',{reason:cancelReason.value.trim()}); await loadBookings(); await loadPackages(); }
async function loadBookings(){ const d=await api('bookings'); renderTable('bookingsList',d.map((b)=>row([b._id,b.bookingRef,`${b.status}/${b.roomType}`,`$${b.totalAmount}`]))); }

// Finance
async function generateInvoice(){ if(!invBookingId.value.trim()) return; await api('invoices/generate','POST',{bookingId:invBookingId.value.trim(),subtotal:Number(invSubtotal.value||0),taxRate:Number(invTax.value||0)}); await loadInvoices(); }
async function approveInvoice(){ if(!approveInvoiceId.value.trim()) return; await api(`invoices/${approveInvoiceId.value.trim()}/approve`,'POST'); await loadInvoices(); }
async function loadInvoices(){ const d=await api('invoices'); renderTable('invoicesList',d.map((i)=>row([i._id,i.invoiceNo,`$${i.total}`,i.status]))); }
async function scheduleInstallment(){ if(!instInvoiceId.value.trim()||!instDue.value) return; await api('installments/schedule','POST',{invoiceId:instInvoiceId.value.trim(),plan:[{dueDate:instDue.value,amount:Number(instAmount.value||0)}]}); await loadInstallments(); }
async function loadInstallments(){ const d=await api('installments'); renderTable('installmentsList',d.map((i)=>row([i._id,i.invoiceId,new Date(i.dueDate).toLocaleDateString(),`${i.paidAmount}/${i.amount} (${i.status})`]))); }
async function calcCommission(){ if(!comBookingId.value.trim()) return; await api('commissions/calculate','POST',{bookingId:comBookingId.value.trim(),agentId:comAgentId.value.trim(),ratePercent:Number(comRate.value||5)}); await loadCommissions(); }
async function approveCommission(){ if(!approveComId.value.trim()) return; await api(`commissions/${approveComId.value.trim()}/approve`,'POST'); await loadCommissions(); }
async function loadCommissions(){ const d=await api('commissions'); renderTable('commissionsList',d.map((c)=>row([c._id,c.agentId,`${c.ratePercent}%`,`$${c.commissionAmount} (${c.status})`]))); }
async function loadReconciliation(){ const d=await api('finance/reconciliation'); reconData.textContent = JSON.stringify(d,null,2); }

// Phase2 medical/compliance
async function submitMedicalClearance(){ if(!medRecordId.value.trim()) return; await api(`medical-records/${medRecordId.value.trim()}/submit-clearance`,'POST'); }
async function reviewMedicalStep(){ if(!medReviewId.value.trim()) return; await api(`medical-records/${medReviewId.value.trim()}/review-step`,'POST',{step:medStep.value,decision:medDecision.value,note:medNote.value.trim()}); }
async function createComplianceRule(){ if(!ruleNation.value.trim()) return; await api('compliance-rules','POST',{nationality:ruleNation.value.trim(),packageType:rulePackage.value,requiredDocs:ruleDocs.value.split(',').map(s=>s.trim()).filter(Boolean),slaDays:Number(ruleSla.value||7)}); }
async function generateChecklist(){ if(!checkPilgrimId.value.trim()) return; await api('compliance/checklist/generate','POST',{pilgrimId:checkPilgrimId.value.trim(),packageType:checkPkg.value}); }
async function moveVisaStage(){ if(!visaPilgrimId.value.trim()) return; await api(`pilgrims/${visaPilgrimId.value.trim()}/visa-stage`,'POST',{stage:visaStage.value,slaDays:Number(visaSla.value||0)}); await loadPilgrims(); }
async function runReminderJob(){ const d=await api('jobs/reminders/run','POST'); reminderResult.textContent = JSON.stringify(d,null,2); }

async function loadAudit(){ if(!hasPermission('manage_security')) return; const d=await api('audit-logs'); renderTable('auditList',d.map((a)=>row([a.action,a.entity,a.entityId,new Date(a.createdAt).toLocaleString()]))); }

async function loadAll(){
  const jobs=[loadStats()];
  if(hasPermission('manage_pilgrims')) jobs.push(loadPilgrims(),loadNotes(),loadTravelHistory(),loadPilgrimDocuments());
  if(hasPermission('manage_leads')) jobs.push(loadLeads(),loadLeadTasks(),loadLeadAnalytics());
  if(hasPermission('manage_packages')) jobs.push(loadPackages());
  if(hasPermission('manage_bookings')) jobs.push(loadBookings());
  if(hasPermission('manage_invoices')) jobs.push(loadInvoices(),loadInstallments(),loadCommissions(),loadReconciliation());
  if(hasPermission('manage_security')) jobs.push(loadAudit());
  await Promise.all(jobs);
}

function bindNav(){ const pages=[...document.querySelectorAll('.page')]; const navs=[...document.querySelectorAll('.nav[data-page]')]; navs.forEach((btn)=>{ btn.onclick=()=>{ navs.forEach(n=>n.classList.remove('active')); btn.classList.add('active'); pages.forEach(p=>p.classList.toggle('hidden', p.id!==btn.dataset.page)); pageTitle.textContent=btn.textContent; }; }); }

if (accessToken && refreshToken) {
  showApp(); bindNav(); api('auth/me').then((u)=>{ currentUser=u; localStorage.setItem('user', JSON.stringify(currentUser)); applyPermissionGuards(); loadAll(); }).catch(()=>logout());
}
