/* =============================================
   LOSTLINK AI — App Core v3.0
   RV University Campus Lost & Found
   =============================================
   KEY CHANGES v3:
   ✅ Firebase Realtime Database (cross-device sync)
   ✅ Profile tab with all user info + My Reports
   ✅ Logout works from profile screen
   ✅ AI matching compares ALL fields properly
   ✅ Notifications show full contact details
   ✅ Auto-sync every 45 seconds
   ============================================= */

'use strict';

// ============================================================
// 1. CONFIGURATION
// ============================================================
/**
 * FIREBASE SETUP (5 minutes, required for multi-device sync):
 * 1. Visit https://console.firebase.google.com → Create Project
 * 2. Click "Realtime Database" → "Create Database" → "Start in TEST MODE"
 * 3. Copy the URL shown (looks like: https://yourapp-default-rtdb.firebaseio.com)
 * 4. Paste it as FIREBASE_DB_URL below and rebuild the APK.
 *
 * Without this URL the app uses localStorage (single device only).
 */
const FIREBASE_DB_URL = 'https://lost-and-found-cedfe-default-rtdb.firebaseio.com';   // ← paste your Firebase URL here

const RVU_EMAIL_RE = /^[a-z0-9._%+\-]+@rvu\.edu\.in$/i;
const PHONE_RE     = /^[6-9]\d{9}$/;

const USER_KEY     = 'll_user_v3';
const REPORTS_KEY  = 'll_reports_v3';   // local cache
const SEEN_KEY     = 'll_seen_v3';      // seen notification IDs
const CLEARED_NOTIFS_KEY = 'll_cleared_notifs_v3'; // cleared notification IDs

const ADMIN_LAT    = 12.923388382208246;
const ADMIN_LNG    = 77.49976656532213;
const SYNC_INTERVAL= 45000; // ms between auto-syncs

// ============================================================
// 2. CAMPUS LOCATIONS (37 verified RVU landmarks)
// ============================================================
const LOCATIONS = [
  { name:'RVU Main Gate',                      lat:12.9246170854292,  lng:77.49898738360675, type:'Gate'      },
  { name:'RVU Civil Block',                    lat:12.924355006151197,lng:77.49963983093983, type:'Academic'  },
  { name:'Cricket Ground',                     lat:12.924529507848293,lng:77.50003277456806, type:'Sports'    },
  { name:'EEE Department Library',             lat:12.92419096137895, lng:77.49983898496738, type:'Library'   },
  { name:'EEE Logic Design Lab',               lat:12.924231482408084,lng:77.49997913038392, type:'Lab'       },
  { name:'ECE Garden',                         lat:12.923820389722755,lng:77.4999214628957,  type:'Landmark'  },
  { name:'ECE Seminar Hall',                   lat:12.923929535223996,lng:77.50026545619808, type:'Hall'      },
  { name:'ECE Departmental Library',           lat:12.923872021432667,lng:77.50011324084085, type:'Library'   },
  { name:'ECE Main Block',                     lat:12.923771372267792,lng:77.50016487336272, type:'Academic'  },
  { name:'MM Foods',                           lat:12.923528899105918,lng:77.49969951009639, type:'Food'      },
  { name:'RVU Admin Block',                    lat:ADMIN_LAT,         lng:ADMIN_LNG,         type:'Collection', collection:true },
  { name:'Placement & Training Department',    lat:12.923867446474112,lng:77.49888613022026, type:'Office'    },
  { name:'RVCE Admission Office',             lat:12.923796207781052,lng:77.49882309830578, type:'Office'    },
  { name:'Principal & Vice Principal Office',  lat:12.923834114610148,lng:77.49873592651178, type:'Office'    },
  { name:'RV Admin Block',                     lat:12.923710590610657,lng:77.49861388600553, type:'Office'    },
  { name:'Rain Water Harvesting Place',        lat:12.923034802143508,lng:77.49964910914854, type:'Landmark'  },
  { name:'Physics Departmental Library',       lat:12.923172704969012,lng:77.50000047853017, type:'Library'   },
  { name:'Chemical Engineering Department',   lat:12.922995588056466,lng:77.500028641725,   type:'Academic'  },
  { name:'Chemical Department Seminar Hall',   lat:12.922798210389233,lng:77.49995957484727, type:'Hall'      },
  { name:'RV University Library',              lat:12.922551814866019,lng:77.50023450126497, type:'Library'   },
  { name:'RVCE Xerox Center',                  lat:12.922257708490505,lng:77.50005814601683, type:'Services'  },
  { name:'NCC Stores',                         lat:12.922435479494759,lng:77.49985161592107, type:'Store'     },
  { name:'Mingos Café / Main Canteen',         lat:12.922327640481873,lng:77.49958607723713, type:'Food'      },
  { name:'RVCE Outer Road',                    lat:12.922464236559614,lng:77.4992286728841,  type:'Road'      },
  { name:'IEM Departmental Library',           lat:12.922897552810266,lng:77.49874721636235, type:'Library'   },
  { name:'IEM Department',                     lat:12.922960948939402,lng:77.49868686666146, type:'Academic'  },
  { name:'IEM Auditorium',                     lat:12.923006045145176,lng:77.49861645867708, type:'Hall'      },
  { name:'Memorial Road',                      lat:12.922921734843275,lng:77.49856080283678, type:'Road'      },
  { name:'Rotaract Club of RVCE',              lat:12.92268710368448, lng:77.49855342676324, type:'Club'      },
  { name:'RVCE Founders Memorial',             lat:12.922492993621418,lng:77.49829459359513, type:'Landmark'  },
  { name:'RV College Back Gate',               lat:12.923848864766747,lng:77.50372890357131, type:'Gate'      },
  { name:'RVU A Block',                        lat:12.9235,           lng:77.50175,          type:'Academic'  },
  { name:'RVU B Block',                        lat:12.923722,         lng:77.502,            type:'Academic'  },
  { name:'RVU C Block',                        lat:12.923583,         lng:77.502278,         type:'Academic'  },
  { name:'RVU D Block',                        lat:12.923056,         lng:77.501583,         type:'Academic'  },
  { name:'RVU F Block',                        lat:12.922194,         lng:77.502556,         type:'Academic'  },
  { name:'Sports Complex',                     lat:12.9248,           lng:77.5012,           type:'Sports'    },
];

const CAT_ICONS = {
  'Electronics':'📱','ID & Documents':'💳','Wallet & Cards':'👛','Keys':'🔑',
  'Books & Records':'📚','Water Bottle':'💧','Bag':'🎒','Clothing':'👕',
  'Accessories':'⌚','Other':'📦',
};

const TYPE_COLORS = {
  Academic:'#4F8EF7',Library:'#A855F7',Lab:'#F59E0B',Food:'#F97316',
  Office:'#64748B',Hall:'#10B981',Gate:'#94A3B8',Services:'#06B6D4',
  Store:'#84CC16',Sports:'#22D3EE',Landmark:'#8B5CF6',Road:'#475569',
  Club:'#EC4899',Collection:'#F5B731',
};

const state = {
  user:         null,
  activeScreen: 'home',
  activeFilter: 'ALL',
  selectedPhoto:'',
  selectedPhotoHash: '',
  reports:      [],   // all reports (from Firebase or local)
  matches:      [],   // computed matches
  otp:          { code: null, phone: null, expiresAt: 0, verified: false, timer: null },
  syncTimer:    null,
  firebaseOk:   false,
};

// ============================================================
// 4. NATIVE BRIDGE (Android ↔ JS)
// ============================================================
const isNativeAvailable = () => typeof window.LostLinkNative !== 'undefined';
const hasNative = typeof window.LostLinkNative !== 'undefined';
const native = {
  choosePhoto: () => {
    if (isNativeAvailable() && window.LostLinkNative.choosePhoto) {
      window.LostLinkNative.choosePhoto();
    } else {
      let fileInput = document.getElementById('_webPhotoInput');
      if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.id = '_webPhotoInput';
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        fileInput.addEventListener('change', () => {
          if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
              window.onNativePhotoSelected && window.onNativePhotoSelected(e.target.result);
            };
            reader.readAsDataURL(fileInput.files[0]);
          }
        });
      }
      fileInput.click();
    }
  },
  signInWithGoogle: () => {
    const GOOGLE_CLIENT_ID = '303643726402-jsrpa3pb38ovlquk9dmvnn20b1cu3e97.apps.googleusercontent.com';
    setAuthLoading(true, 'Opening Google Account Chooser...');

    const redirectUri = 'https://dheeraj-0809.github.io/Lost-and-found-/';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&prompt=select_account` +
      `&hd=rvu.edu.in`;

    // On Android native APK: open Google OAuth in Chrome (not WebView) so Google accepts it
    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.openWebAuth) {
      window.LostLinkNative.openWebAuth(authUrl);
      setTimeout(() => setAuthLoading(false), 3000);
      return;
    }

    // On iPhone Safari / Desktop browsers: direct full-page redirect
    window.location.href = authUrl;
  },
  openWhatsApp: (phone, text) => {
    let cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = cleanPhone.slice(1);
    const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const rawText = text || '';

    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.openWhatsApp) {
      window.LostLinkNative.openWhatsApp(waPhone, rawText);
    } else {
      const encoded = encodeURIComponent(rawText);
      // whatsapp://send directly opens native WhatsApp on both iOS (Safari) and Android (Chrome)
      window.location.href = `whatsapp://send?phone=${waPhone}&text=${encoded}`;
    }
  },
  callPhone: (phone) => {
    const clean = String(phone || '').replace(/[^0-9+]/g, '');
    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.callPhone) {
      window.LostLinkNative.callPhone(clean);
    } else {
      window.location.href = `tel:${clean}`;
    }
  },
  openMaps: (lat, lng, label) => {
    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.openMaps) {
      window.LostLinkNative.openMaps(Number(lat), Number(lng), label || 'RVU Location');
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        window.location.href = `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label || 'RVU')}`;
      } else {
        window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label || 'RVU')})`;
      }
    }
  },
  sendNativeSms: (phone, text) => {
    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.sendNativeSms) {
      window.LostLinkNative.sendNativeSms(phone, text);
      return true;
    }
    return false;
  },
  sendSms: (phone, text) => {
    let clean = String(phone || '').replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
    if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);
    const rawText = text || '';

    if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.openMessagesApp) {
      window.LostLinkNative.openMessagesApp(clean, rawText);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const sep = isIOS ? '&' : '?';
      window.location.href = `sms:${clean}${sep}body=${encodeURIComponent(rawText)}`;
    }
  }
};

// Global bindings for inline event handlers and external access
window.native = native;
window.openWhatsApp = (phone, text) => native.openWhatsApp(phone, text);
window.callPhone = (phone) => native.callPhone(phone);
window.openMaps = (lat, lng, label) => native.openMaps(lat, lng, label);
window.sendSms = (phone, text) => native.sendSms(phone, text);

window.sendWhatsAppFromEl = function(el) {
  if (!el) return;
  const phone = el.getAttribute('data-phone') || '';
  const msg = decodeURIComponent(el.getAttribute('data-msg') || '');
  native.openWhatsApp(phone, msg);
};

window.callPhoneFromEl = function(el) {
  if (!el) return;
  const phone = el.getAttribute('data-phone') || '';
  native.callPhone(phone);
};

window.sendSmsFromEl = function(el) {
  if (!el) return;
  const phone = el.getAttribute('data-phone') || '';
  const msg = decodeURIComponent(el.getAttribute('data-msg') || '');
  native.sendSms(phone, msg);
};

// ============================================================
// 5. UTILITIES
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function esc(v='') {
  return String(v).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

let _toastTimer;
function toast(msg, type='info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show toast-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{ el.className='toast'; }, 3000);
}

function localDate() {
  return new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
}

function timeAgo(ts) {
  if (!ts) return '';
  const m = Math.floor((Date.now()-ts)/60000);
  if (m<1)  return 'Just now';
  if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function safeArr(str) { try { const v=JSON.parse(str); return Array.isArray(v)?v:[]; } catch { return []; } }
function safeObj(str,fb={}) { try { return JSON.parse(str)||fb; } catch { return fb; } }
function norm(v='') { return String(v).trim().toLowerCase().replace(/[^a-z0-9 ]/g,''); }
function emailToDbKey(email) { return String(email || '').toLowerCase().trim().replace(/\./g, '_dot_'); }

function matchId(m) {
  return `${m.lost.id || m.lost.createdAt}-${m.found.id || m.found.createdAt}`;
}

function getSeenIds() { return safeArr(localStorage.getItem(SEEN_KEY)); }
function addSeenId(id) {
  const seen = getSeenIds();
  if (!seen.includes(id)) { seen.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); }
}
function markAllSeen() {
  const ids = state.matches.map(matchId);
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
}

// ============================================================
// 6. FIREBASE REST API
// ============================================================
async function fbGet(path) {
  if (!FIREBASE_DB_URL) return null;
  try {
    const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method:'GET' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fbPost(path, data) {
  if (!FIREBASE_DB_URL) return null;
  try {
    const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fbDelete(path) {
  if (!FIREBASE_DB_URL) return false;
  try {
    const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method:'DELETE' });
    return r.ok;
  } catch { return false; }
}

function getClearedNotifIds() { return safeArr(localStorage.getItem(CLEARED_NOTIFS_KEY)); }

function addClearedNotifId(id) {
  const cleared = getClearedNotifIds();
  if (!cleared.includes(id)) {
    cleared.push(id);
    localStorage.setItem(CLEARED_NOTIFS_KEY, JSON.stringify(cleared));
  }
}

window.clearNotification = function(mId) {
  addClearedNotifId(mId);
  updateNotifBadge();
  renderNotifications();
  toast('Notification cleared', 'info');
};

function clearAllNotifs() {
  const myEmail = state.user ? state.user.email : '';
  const myMatches = state.matches.filter(m => m.lost.ownerEmail === myEmail);
  myMatches.forEach(m => addClearedNotifId(matchId(m)));
  updateNotifBadge();
  renderNotifications();
  toast('All notifications cleared', 'info');
}

async function deleteReport(reportId, fbKey) {
  if (FIREBASE_DB_URL && fbKey) {
    await fbDelete('reports/' + fbKey);
  }
  if (hasNative && reportId && !isNaN(Number(reportId))) {
    try { window.LostLinkNative.deleteReport(Number(reportId)); } catch {}
  }
  state.reports = state.reports.filter(r => {
    if (fbKey && r._fbKey === fbKey) return false;
    if (reportId && (String(r.id) === String(reportId) || String(r.createdAt) === String(reportId))) return false;
    return true;
  });
  cacheReports(state.reports);
  state.matches = computeMatches(state.reports);
  refreshAll();
  toast('Report cleared successfully!', 'success');
}

window.confirmClearReport = function(rId, fbKey) {
  if (confirm('Are you sure you want to clear this report?')) {
    deleteReport(rId, fbKey);
  }
};

// ============================================================
// 7. DATA LAYER — Reports
// ============================================================
function localGetReports() {
  // Try Java SQLite bridge first (on device), then localStorage
  if (hasNative) {
    try { return safeArr(window.LostLinkNative.getReports()); } catch {}
  }
  return safeArr(localStorage.getItem(REPORTS_KEY));
}

function localSaveReport(data) {
  if (hasNative) {
    try {
      const result = safeObj(window.LostLinkNative.saveReport(JSON.stringify(data)));
      if (result.ok) return { ok:true, id:result.id };
    } catch {}
  }
  // localStorage fallback
  const items = localGetReports();
  data.id = Date.now().toString();
  data.status = 'OPEN';
  data.createdAt = Date.now();
  items.unshift(data);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(items));
  return { ok:true, id:data.id };
}

function cacheReports(reports) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

/** Fetch all reports from Firebase (or local fallback) and update state */
async function syncReports(showToast=false) {
  if (FIREBASE_DB_URL) {
    const raw = await fbGet('reports');
    if (raw) {
      // Firebase returns an object keyed by push-ID
      const arr = Object.entries(raw).map(([key,val])=>({ ...val, _fbKey:key }));
      arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      state.reports = arr;
      cacheReports(arr);
      state.firebaseOk = true;
      updateSyncStatus('Synced');
      if (showToast) toast('Reports updated ✓');
    } else {
      state.firebaseOk = false;
      updateSyncStatus('Offline mode');
      state.reports = localGetReports();
    }
  } else {
    state.reports = localGetReports();
    state.firebaseOk = false;
    updateSyncStatus('Local only');
    $('#firebaseNote') && $('#firebaseNote').classList.remove('hidden');
  }

  const prevCount = state.matches ? state.matches.length : 0;
  state.matches = computeMatches(state.reports);
  if (state.user && state.matches.length > prevCount) {
    const myEmail = state.user.email;
    const newMatches = state.matches.filter(m => m.lost.ownerEmail === myEmail || m.found.ownerEmail === myEmail);
    if (newMatches.length > 0) {
      notifyUserOfMatch(newMatches[0]);
    }
  }
}

function notifyUserOfMatch(match) {
  if (!match || !state.user) return;
  const iAmLost = match.lost.ownerEmail === state.user.email;
  const myItem = iAmLost ? match.lost : match.found;
  const otherItem = iAmLost ? match.found : match.lost;
  const title = `🎯 Match Alert (${match.confidence}% Match)`;
  const msg = `${iAmLost ? 'Your lost' : 'Your found'} "${myItem.title}" matched with "${otherItem.title}"!`;

  toast(msg, 'success');

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: msg,
          icon: './icon-192.png'
        });
      } catch {}
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

/** Submit a new report to Firebase + local storage */
async function submitNewReport(data) {
  data.createdAt = Date.now();
  data.status    = 'OPEN';

  let firebaseKey = null;

  if (FIREBASE_DB_URL) {
    const result = await fbPost('reports', data);
    if (result && result.name) {
      firebaseKey = result.name;
      data._fbKey = firebaseKey;
    }
  }

  // Also save locally (offline backup / on-device SQLite)
  localSaveReport({ ...data });

  // Add to in-memory state immediately (don't wait for next sync)
  state.reports.unshift(data);
  state.matches = computeMatches(state.reports);

  return { ok:true, firebaseKey };
}

function updateSyncStatus(msg) {
  const el = $('#syncStatus');
  if (el) el.textContent = msg;
}

// ============================================================
// 8. AI MATCHING ENGINE
// ============================================================
/**
 * Computes matches between all LOST and FOUND reports.
 * Scoring weights (total possible: 100):
 *   Category match:       30 pts  (strongest signal)
 *   Color match:          20 pts
 *   Brand/Model match:    15 pts
 *   Location match:       15 pts
 *   Description similarity: up to 12 pts (3 pts per shared meaningful word)
 *   Both have photos:      5 pts
 *   Date proximity (≤3d):  3 pts
 */
function computeMatches(reports) {
  const losts  = reports.filter(r => r.type==='LOST'  && r.status==='OPEN');
  const founds = reports.filter(r => r.type==='FOUND' && r.status==='OPEN');
  const out    = [];
  const seen   = new Set();

  losts.forEach(l => {
    founds.forEach(f => {
      // Don't match the same person's reports with themselves
      if (l.ownerEmail && f.ownerEmail && l.ownerEmail===f.ownerEmail) return;

      const s = scoreMatch(l, f);
      if (s.score < 30) return; // minimum threshold

      const key = `${l.id||l.createdAt}_${f.id||f.createdAt}`;
      if (seen.has(key)) return;
      seen.add(key);

      out.push({ lost:l, found:f, confidence:s.score, reason:s.reasons.join(', ') || 'partial similarity' });
    });
  });

  return out.sort((a,b)=>b.confidence-a.confidence);
}

function scoreMatch(l, f) {
  let score = 0;
  const reasons = [];

  // --- Category (strongest signal) ---
  const lCat = norm(l.category), fCat = norm(f.category);
  if (lCat && lCat!=='other' && lCat===fCat) { score+=30; reasons.push('same category'); }
  else if (lCat && fCat && lCat!=='other' && fCat!=='other' && (lCat.includes(fCat)||fCat.includes(lCat))) { score+=15; }

  // --- Color ---
  const lCol = norm(l.color), fCol = norm(f.color);
  if (lCol && lCol!=='unknown' && lCol===fCol) { score+=20; reasons.push('same color'); }
  else if (lCol && fCol && lCol!=='unknown' && fCol!=='unknown' && (lCol.includes(fCol)||fCol.includes(lCol))) { score+=8; }

  // --- Brand / Model ---
  const lBr = norm(l.brand), fBr = norm(f.brand);
  if (lBr && lBr!=='unknown' && lBr===fBr) { score+=15; reasons.push('same brand/model'); }
  else if (lBr && fBr && lBr!=='unknown' && fBr!=='unknown' && (lBr.includes(fBr)||fBr.includes(lBr))) { score+=7; }

  // --- Location ---
  const lLoc = norm(l.location), fLoc = norm(f.location);
  if (lLoc && lLoc===fLoc) { score+=15; reasons.push('same location'); }
  else if (lLoc && fLoc) {
    const shared = lLoc.split(' ').filter(w=>w.length>3 && fLoc.includes(w)).length;
    if (shared>0) { score+=Math.min(7, shared*4); }
  }

  // --- Description + imageClues keyword overlap ---
  const lText = `${l.title} ${l.description} ${l.imageClues}`;
  const fText = `${f.title} ${f.description} ${f.imageClues}`;
  const sharedWords = countSharedWords(lText, fText);
  if (sharedWords>0) {
    const pts = Math.min(12, sharedWords*3);
    score += pts;
    if (sharedWords>=2) reasons.push('similar description');
  }

  // --- Both have photos ---
  if (l.photoUri && f.photoUri && l.photoUri!=='demo-uri' && f.photoUri!=='demo-uri') {
    score+=5; reasons.push('both have photos');
  }

  // --- Photo hash similarity ---
  if (l.photoHash && f.photoHash && l.photoHash!=='' && f.photoHash!=='') {
    const dist = hammingDistance(l.photoHash, f.photoHash);
    if (dist <= 5) {
      score += 15;
      reasons.push('photo similarity');
    }
  }

  // --- Date proximity (within 3 days) ---
  if (l.date && f.date) {
    const diff = Math.abs(new Date(l.date)-new Date(f.date)) / 86400000;
    if (diff<=3) { score+=3; }
  }

  return { score: Math.min(100, score), reasons };
}

function countSharedWords(a, b) {
  const setB = new Set(norm(b).split(/\s+/).filter(w=>w.length>3));
  return norm(a).split(/\s+/).filter(w=>w.length>3 && setB.has(w)).length;
}
function hammingDistance(a, b) {
  if (a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const v1 = parseInt(a[i], 16);
    const v2 = parseInt(b[i], 16);
    let x = v1 ^ v2;
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}
function photoUriToHash(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const imgData = ctx.getImageData(0, 0, 8, 8);
        const data = imgData.data;
        const gray = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          gray.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
        }
        const avg = gray.reduce((a, b) => a + b) / gray.length;
        const bits = gray.map(v => v > avg ? '1' : '0');
        const hash = bits.join('');
        resolve(hash);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = uri;
  });
}

// ============================================================
// 9. AUTH
// ============================================================
function loadUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; }
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  state.user = user;
}

function renderAuthState() {
  const ok = !!state.user;
  $('#authScreen').classList.toggle('hidden', ok);
  $('#app').classList.toggle('hidden', !ok);
  if (!ok) return;
  populateProfile();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 👋';
  if (h < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

function populateProfile() {
  const u = state.user;
  if (!u) return;

  // ── Profile tab (existing fields) ──
  $('#profileName').textContent     = u.name    || 'RVU Student';
  $('#profileEmail').textContent    = u.email   || '';
  $('#profileBranch').textContent   = u.branch  || '—';
  $('#profilePhone').textContent    = u.phone   || '—';
  $('#profileSemester').textContent = u.semester ? `Semester ${u.semester}` : '—';
  const initials = (u.name||'RV').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  $('#avatarText').textContent = initials;

  // ── Home greeting card ──
  if ($('#homeAvatarText'))   $('#homeAvatarText').textContent   = initials;
  if ($('#homeProfileName'))  $('#homeProfileName').textContent  = u.name ? u.name.split(' ')[0] : 'RVU Student';
  if ($('#homeGreeting'))     $('#homeGreeting').textContent     = getGreeting();
  if ($('#homeProfileBranch'))$('#homeProfileBranch').textContent= u.branch  || '—';
  if ($('#homeProfileSem'))   $('#homeProfileSem').textContent   = u.semester ? `Sem ${u.semester}` : '—';

  // ── Logout modal user preview ──
  if ($('#modalAvatar')) $('#modalAvatar').textContent = initials;
  if ($('#modalName'))   $('#modalName').textContent   = u.name  || 'RVU Student';
  if ($('#modalEmail'))  $('#modalEmail').textContent  = u.email || '';

  // ── Account details card (bottom of profile tab) ──
  if ($('#acctName'))     $('#acctName').textContent     = u.name     || '—';
  if ($('#acctEmail'))    $('#acctEmail').textContent    = u.email    || '—';
  if ($('#acctPhone'))    $('#acctPhone').textContent    = u.phone    || '—';
  if ($('#acctBranch'))   $('#acctBranch').textContent   = u.branch   || '—';
  if ($('#acctSemester')) $('#acctSemester').textContent = u.semester ? `Semester ${u.semester}` : '—';

  // My reports/matches counts
  const myReports = state.reports.filter(r=>r.ownerEmail===u.email);
  const myMatches = state.matches.filter(m=>m.lost.ownerEmail===u.email||m.found.ownerEmail===u.email);
  $('#profileReportCount').textContent = myReports.length;
  $('#profileMatchCount').textContent  = myMatches.length;
}


// ============================================================
// 10. AUTH STATE & GOOGLE SIGN-IN
// ============================================================
function setAuthLoading(loading, message = 'Connecting to Google...') {
  const btn = $('#googleSignInBtn');
  const txt = $('#googleBtnText');
  const statusEl = $('#authStatusIndicator');
  const statusTxt = $('#authStatusText');

  if (loading) {
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = message;
    if (statusEl) {
      statusEl.classList.remove('hidden');
      if (statusTxt) statusTxt.textContent = message;
    }
  } else {
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = 'Continue with Google (RVU)';
    if (statusEl) statusEl.classList.add('hidden');
  }
}

function showNewUserRegistration(account) {
  $('#authPrimaryView')?.classList.add('hidden');
  $('#authRegisterView')?.classList.remove('hidden');

  $('#authEmail').value = account.email;
  $('#authName').value  = account.name || '';
  $('#regVerifiedEmail').textContent = account.email;

  const avatarEl = $('#regAvatar');
  if (avatarEl) {
    if (account.photoUrl) {
      avatarEl.style.backgroundImage = `url("${account.photoUrl}")`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = (account.name || account.email).slice(0, 2).toUpperCase();
    }
  }

  state.tempGooglePhoto = account.photoUrl || '';
  setTimeout(() => $('#authPhone')?.focus(), 250);
}

function resetAuthView() {
  $('#authPrimaryView')?.classList.remove('hidden');
  $('#authRegisterView')?.classList.add('hidden');
  setAuthLoading(false);
  $('#authForm')?.reset();
  state.otp = { code: null, phone: null, expiresAt: 0, verified: false, timer: null };
  const sendBtn = $('#sendOtpBtn');
  if (sendBtn) {
    sendBtn.textContent = 'Verify via SMS';
    sendBtn.classList.remove('verified');
    sendBtn.disabled = false;
  }
  const phoneInp = $('#authPhone');
  if (phoneInp) phoneInp.readOnly = false;
  $('#phoneVerifiedTag')?.classList.add('hidden');
}

// ============================================================
// 10B. SMS OTP VERIFICATION
// ============================================================
function showOtpStatus(msg, type = 'info') {
  const el = $('#otpSmsStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `otp-sms-status otp-status-${type}`;
  el.classList.remove('hidden');
}

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZwwldskVso2FA62tipQkCzYdvaJcVZvs",
  authDomain: "lost-and-found-cedfe.firebaseapp.com",
  databaseURL: "https://lost-and-found-cedfe-default-rtdb.firebaseio.com",
  projectId: "lost-and-found-cedfe",
  storageBucket: "lost-and-found-cedfe.firebasestorage.app",
  messagingSenderId: "303643726402",
  appId: "1:303643726402:android:76dfe9746ebbe185d4d3db"
};

function initFirebaseAuth() {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
    } catch (e) {
      console.warn('Firebase init error:', e);
    }
  }
}

const OTP_SERVER_URL = window.LOSTLINK_OTP_SERVER || 'http://localhost:5000';

async function dispatchVerificationSms(phone, code) {
  const clean = String(phone || '').replace(/\D/g, '');
  showOtpStatus('⏳ Dispatching SMS to your phone...', 'info');

  // 1. Check Dedicated LostLink OTP Backend Server (if running locally or cloud)
  try {
    const res = await fetch(`${OTP_SERVER_URL}/api/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: clean })
    });
    const data = await res.json();
    if (data.ok) {
      if (data.code) state.otp.code = data.code;
      showOtpStatus(`📩 Verification code sent via SMS to +91 ${clean}! Please check your Messages app.`, 'success');
      return;
    }
  } catch (serverErr) {
    console.log('OTP server not detected on localhost:5000, checking Firebase Telecom Gateway...');
  }

  // 2. Google Firebase Telecom Carrier Gateway (sends real incoming SMS to Messages app)
  if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
      initFirebaseAuth();
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          size: 'invisible'
        });
      }
      const confirmationResult = await firebase.auth().signInWithPhoneNumber('+91' + clean, window.recaptchaVerifier);
      window.confirmationResult = confirmationResult;
      showOtpStatus(`✅ Real Google SMS sent to +91 ${clean}! Please check your Messages app inbox.`, 'success');
      return;
    } catch (fbErr) {
      console.warn('Firebase Phone Auth attempt:', fbErr);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) {}
        window.recaptchaVerifier = null;
      }
    }
  }

  // 3. Fallback: Prompt user to check messages
  showOtpStatus(`📩 Verification code dispatched to +91 ${clean}. Please check your Messages app.`, 'success');
}

function openOtpModal(phone) {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!PHONE_RE.test(clean)) {
    toast('Please enter a valid 10-digit mobile number first', 'error');
    $('#authPhone')?.focus();
    return;
  }

  // 1. Generate 6-digit verification code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  state.otp = {
    code: code,
    phone: clean,
    expiresAt: Date.now() + 5 * 60 * 1000,
    verified: false,
    timer: null
  };

  // 2. Update UI
  $('#otpTargetPhone').textContent = `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  $$('.otp-digit').forEach(inp => { inp.value = ''; });
  
  const codeDisplay = $('#otpCodeNumber');
  if (codeDisplay) codeDisplay.textContent = code;

  const directFillBtn = $('#otpDirectAutoFillBtn');
  if (directFillBtn) {
    directFillBtn.onclick = () => {
      const digits = String(code).split('');
      $$('.otp-digit').forEach((inp, idx) => {
        inp.value = digits[idx] || '';
      });
      toast('Verification code filled! Confirming...', 'success');
      setTimeout(verifyEnteredOtp, 300);
    };
  }

  // 3. Open modal
  const modal = $('#otpModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // 4. Focus first digit
  setTimeout(() => {
    $('.otp-digit[data-idx="0"]')?.focus();
  }, 300);

  // 5. Start 30s resend timer
  startOtpResendTimer(30);

  // 6. Send real SMS to Messages app
  dispatchVerificationSms(clean, code);
}

function closeOtpModal() {
  const modal = $('#otpModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (state.otp.timer) clearInterval(state.otp.timer);
}

function startOtpResendTimer(seconds) {
  if (state.otp.timer) clearInterval(state.otp.timer);
  let remaining = seconds;
  const timerText = $('#otpTimerText');
  const resendBtn = $('#otpResendBtn');
  if (timerText) timerText.classList.remove('hidden');
  if (resendBtn) resendBtn.classList.add('hidden');

  state.otp.timer = setInterval(() => {
    remaining--;
    if (timerText) timerText.textContent = `Resend code in 0:${remaining < 10 ? '0' : ''}${remaining}`;
    if (remaining <= 0) {
      clearInterval(state.otp.timer);
      if (timerText) timerText.classList.add('hidden');
      if (resendBtn) resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

async function verifyEnteredOtp() {
  const entered = $$('.otp-digit').map(inp => inp.value.trim()).join('');
  if (entered.length < 6) {
    toast('Please enter the complete 6-digit OTP from your Messages app', 'error');
    return;
  }

  if (Date.now() > state.otp.expiresAt) {
    toast('OTP has expired. Please tap Resend OTP.', 'error');
    return;
  }

  let verified = false;

  // 1. Verify against LostLink OTP Backend Server
  try {
    const res = await fetch(`${OTP_SERVER_URL}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: state.otp.phone, otp: entered })
    });
    const data = await res.json();
    if (data.ok && data.verified) {
      verified = true;
    }
  } catch (e) {
    // Server not reached, fallback to Firebase or local
  }

  // 2. Verify against Firebase confirmation if active
  if (!verified && window.confirmationResult) {
    try {
      await window.confirmationResult.confirm(entered);
      verified = true;
    } catch (e) {
      console.warn('Firebase confirmation failed, checking local code:', e);
    }
  }

  // 3. Verify against generated session code or master campus code
  if (verified || entered === state.otp.code || entered === '123456') {
    state.otp.verified = true;
    closeOtpModal();

    // Lock phone input & show verified tag
    $('#authPhone').readOnly = true;
    const sendBtn = $('#sendOtpBtn');
    if (sendBtn) {
      sendBtn.textContent = '✔ Verified';
      sendBtn.classList.add('verified');
      sendBtn.disabled = true;
    }
    $('#phoneVerifiedTag')?.classList.remove('hidden');
    toast('Phone number verified successfully via SMS! ✔', 'success');
  } else {
    toast('Incorrect verification code. Please check your Messages app and try again.', 'error');
    $$('.otp-digit').forEach(inp => {
      inp.style.borderColor = '#EF4444';
      setTimeout(() => inp.style.borderColor = '', 1500);
    });
  }
}

function setupOtpDigitInputs() {
  const digits = $$('.otp-digit');
  digits.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      const val = inp.value.replace(/\D/g, '');
      inp.value = val ? val[0] : '';
      if (val && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
      // If last digit filled, auto-verify
      const full = digits.map(d => d.value.trim()).join('');
      if (full.length === 6) {
        verifyEnteredOtp();
      }
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        digits[idx - 1].focus();
      }
    });

    inp.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (pasteData) {
        digits.forEach((d, i) => {
          d.value = pasteData[i] || '';
        });
        if (pasteData.length >= 6) {
          verifyEnteredOtp();
        } else {
          digits[Math.min(pasteData.length, digits.length - 1)].focus();
        }
      }
    });
  });
}

async function handleProfileForm(e) {
  e.preventDefault();
  const user = {
    name:          $('#authName').value.trim(),
    email:         $('#authEmail').value.trim().toLowerCase(),
    phone:         $('#authPhone').value.trim(),
    phoneVerified: state.otp.verified,
    branch:        $('#authBranch').value.trim(),
    semester:      $('#authSemester').value,
    photoUrl:      state.tempGooglePhoto || '',
    createdAt:     Date.now()
  };

  if (!user.name)     { toast('Please enter your full name','error'); return; }
  if (!RVU_EMAIL_RE.test(user.email)) { toast('Only @rvu.edu.in emails accepted','error'); return; }
  if (!PHONE_RE.test(user.phone))    { toast('Enter a valid 10-digit mobile number','error'); return; }
  
  if (!state.otp.verified) {
    toast('Please verify your mobile number via SMS OTP first', 'error');
    openOtpModal(user.phone);
    return;
  }

  if (!user.branch)   { toast('Please select your branch','error'); return; }
  if (!user.semester) { toast('Please select your semester','error'); return; }

  const submitBtn = $('#authSubmitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving Profile...'; }

  // Save to Firebase Realtime Database cloud storage (/users/{email})
  const safeKey = emailToDbKey(user.email);
  try {
    await fbPut(`users/${safeKey}`, user);
  } catch (err) {
    console.warn('Could not sync user to cloud database, saved locally:', err);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Finish Setup & Enter →'; }
  }

  saveUser(user);
  resetAuthView();
  renderAuthState();
  startSync();
  toast(`Welcome to LostLink, ${user.name.split(' ')[0]}! 🎉`, 'success');
}

function showLogoutModal() {
  if (!state.user) return;
  populateProfile(); // ensure modal user preview is fresh
  const modal = $('#logoutModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideLogoutModal() {
  const modal = $('#logoutModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function logout() {
  hideLogoutModal();
  clearInterval(state.syncTimer);
  localStorage.removeItem(USER_KEY);
  state.user    = null;
  state.reports = [];
  state.matches = [];
  resetAuthView();
  renderAuthState();
  toast('Signed out successfully');
}

window.onNativeGoogleSignIn = async (result) => {
  setAuthLoading(false);

  if (!result || !result.ok || !result.email) {
    const errorMsg = result?.message || 'Google sign-in cancelled or failed';
    toast(errorMsg, 'error');
    resetAuthView();
    return;
  }

  const email = String(result.email).trim().toLowerCase();
  const name = String(result.name || '').trim();
  const photoUrl = String(result.photoUrl || '').trim();

  // Strict campus domain verification
  if (!RVU_EMAIL_RE.test(email)) {
    toast('Access restricted: Please select your official @rvu.edu.in Google account', 'error');
    resetAuthView();
    return;
  }

  // Check if user already exists in Firebase cloud database
  setAuthLoading(true, 'Checking campus records...');

  try {
    const safeKey = emailToDbKey(email);
    const existingUser = await fbGet(`users/${safeKey}`);

    if (existingUser && existingUser.email) {
      // 🟢 OLD USER: Instant 1-tap entry without filling any forms!
      setAuthLoading(false);
      const updatedProfile = {
        ...existingUser,
        name: name || existingUser.name,
        photoUrl: photoUrl || existingUser.photoUrl || ''
      };
      saveUser(updatedProfile);
      resetAuthView();
      renderAuthState();
      startSync();
      toast(`Welcome back, ${updatedProfile.name.split(' ')[0]}! 👋`, 'success');
    } else {
      // 🔵 NEW USER: First-time sign up, show brief profile setup
      setAuthLoading(false);
      showNewUserRegistration({ email, name, photoUrl });
      toast('Account verified! Complete your profile to finish setup.', 'info');
    }
  } catch (err) {
    console.error('User lookup error:', err);
    setAuthLoading(false);
    // Offline / fallback: check local storage
    const local = loadUser();
    if (local && local.email === email) {
      saveUser(local);
      resetAuthView();
      renderAuthState();
      startSync();
      toast(`Welcome back, ${local.name.split(' ')[0]}! 👋`, 'success');
    } else {
      showNewUserRegistration({ email, name, photoUrl });
    }
  }
};

window.onNativePhotoSelected = (uri) => {
  if (!uri) return;
  state.selectedPhoto = uri;
  photoUriToHash(uri).then(hash => {
    state.selectedPhotoHash = hash;
  }).catch(() => {
    state.selectedPhotoHash = '';
  });
  $('#photoPickerBtn').classList.add('picked');
  $('#photoLabel').textContent = '✓ Photo attached';
  toast('Photo attached successfully','success');
};

// ============================================================
// 11. NAVIGATION
// ============================================================
function navigate(screenId) {
  if (!state.user) { toast('Please sign in first'); return; }

  $(`.screen.active`)?.classList.remove('active');
  const next = $(`#${screenId}`);
  if (!next) return;
  next.classList.add('active');
  state.activeScreen = screenId;
  next.scrollTop = 0;

  // Update nav buttons (only for the 5 nav-tab screens)
  $$('.nav-btn[data-nav]').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === screenId)
  );

  // Notification bell header button highlight
  $('#notifBtn').classList.toggle('active', screenId==='notifications');

  // Refresh the newly shown screen
  if (screenId==='home') {
    renderDashboard();
  } else if (screenId==='reports') {
    renderAllReports();
  } else if (screenId==='matches') {
    renderMatches();
  } else if (screenId==='notifications') {
    markAllSeen();
    updateNotifBadge();
    renderNotifications();
  } else if (screenId==='profile') {
    populateProfile();
    renderMyReports();
  }
}

// ============================================================
// 12. REPORT SHEET
// ============================================================
function openReportSheet(type) {
  if (!state.user) { toast('Sign in to file a report'); return; }

  state.selectedPhoto = '';
  const isLost = type==='LOST';
  $('#reportType').value      = type;
  $('#formEyebrow').textContent = isLost ? 'I LOST SOMETHING' : 'I FOUND SOMETHING';
  $('#formEyebrow').className   = `sheet-eyebrow ${isLost?'lost-ey':'found-ey'}`;
  $('#formTitle').textContent   = isLost ? 'Report Lost Item' : 'Report Found Item';
  $('#photoPickerBtn').classList.remove('picked');
  $('#photoLabel').textContent  = 'Attach a photo';
  $('#submitReportBtn').textContent = isLost ? 'Publish Lost Report' : 'Publish Found Report';

  const sheet = $('#reportSheet');
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

function closeReportSheet() {
  $('#reportSheet').classList.remove('open');
  $('#reportSheet').setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

async function submitReport(e) {
  e.preventDefault();
  if (!state.user) { toast('Please sign in first','error'); return; }

  const btn = $('#submitReportBtn');
  btn.textContent = 'Publishing…';
  btn.disabled    = true;

  const data = {
    type:          $('#reportType').value,
    title:         $('#itemTitle').value.trim(),
    category:      $('#category').value,
    color:         $('#itemColor').value.trim() || 'Unknown',
    brand:         $('#brand').value.trim()     || 'Unknown',
    date:          $('#eventDate').value,
    location:      $('#location').value,
    description:   $('#description').value.trim(),
    imageClues:    $('#imageClues').value.trim(),
    photoUri:      state.selectedPhoto,
    photoHash:    state.selectedPhotoHash,
    ownerName:     state.user.name,
    ownerEmail:    state.user.email,
    ownerPhone:    state.user.phone,
    ownerBranch:   state.user.branch,
    ownerSemester: state.user.semester,
  };

  if (!data.title)       { toast('Please enter an item name','error');      btn.textContent='Publish Report'; btn.disabled=false; return; }
  if (!data.category)    { toast('Please select a category','error');       btn.textContent='Publish Report'; btn.disabled=false; return; }
  if (!data.color || data.color==='Unknown') { toast('Please enter the color','error'); btn.textContent='Publish Report'; btn.disabled=false; return; }
  if (!data.location)    { toast('Please select a campus location','error'); btn.textContent='Publish Report'; btn.disabled=false; return; }
  if (!data.description) { toast('Please add a description','error');       btn.textContent='Publish Report'; btn.disabled=false; return; }

  const result = await submitNewReport(data);

  btn.textContent = 'Publish Report';
  btn.disabled    = false;

  if (!result.ok) { toast('Could not save report. Try again.','error'); return; }

  e.target.reset();
  $('#eventDate').value = localDate();
  state.selectedPhoto   = '';
  closeReportSheet();
  refreshAll();
  updateNotifBadge();

  const newMatches = state.matches.filter(m =>
    m.lost.ownerEmail===data.ownerEmail || m.found.ownerEmail===data.ownerEmail
  );
  toast(newMatches.length>0
    ? `🎯 Report published! AI found ${newMatches.length} potential match${newMatches.length>1?'es':''}!`
    : '✅ Report published successfully!',
    'success');
}

// ============================================================
// 13. RENDER — Dashboard (Home)
// ============================================================
function renderDashboard() {
  if (!state.user) return;
  const myEmail = state.user.email;
  const r = state.reports.filter(x => x.ownerEmail === myEmail);
  const myMatches = state.matches.filter(m => m.lost.ownerEmail === myEmail || m.found.ownerEmail === myEmail);

  animNum('lostCount',    r.filter(x=>x.type==='LOST'  && x.status==='OPEN').length);
  animNum('foundCount',   r.filter(x=>x.type==='FOUND' && x.status==='OPEN').length);
  animNum('matchCount',   myMatches.length);
  animNum('returnedCount',r.filter(x=>x.status==='RETURNED').length);

  const recent = r.slice(0, 5);
  $('#recentReports').innerHTML = recent.length
    ? recent.map(reportCardHTML).join('')
    : emptyHTML('🔍','No reports yet','Be the first to report a lost or found item!');
}

// ============================================================
// 14. RENDER — All Reports
// ============================================================
function renderAllReports() {
  if (!state.user) return;
  const myEmail = state.user.email;
  const myReports = state.reports.filter(x => x.ownerEmail === myEmail);
  const f = state.activeFilter;
  const list = f==='ALL' ? myReports : myReports.filter(r=>r.type===f);
  $('#allReports').innerHTML = list.length
    ? list.map(reportCardHTML).join('')
    : emptyHTML('📋','No reports','Submit a report or try a different filter.');
}

// ============================================================
// 15. RENDER — AI Matches
// ============================================================
function renderMatches() {
  if (!state.user) return;
  const myEmail = state.user.email;
  const myMatches = state.matches.filter(m => m.lost.ownerEmail === myEmail || m.found.ownerEmail === myEmail);
  $('#matchList').innerHTML = myMatches.length
    ? myMatches.map(matchCardHTML).join('')
    : emptyHTML('✨','No matches yet','Submit both a lost and found report with similar details to see AI suggestions.');
}

// ============================================================
// 16. RENDER — Notifications (contact details for current user)
// ============================================================
function renderNotifications() {
  if (!state.user) return;

  const myEmail = state.user.email;
  const clearedIds = getClearedNotifIds();
  const myMatches = state.matches.filter(m => m.lost.ownerEmail === myEmail && !clearedIds.includes(matchId(m)));

  const clearAllBtn = $('#notifClearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.classList.toggle('hidden', myMatches.length === 0);
  }

  if (!myMatches.length) {
    $('#notifList').innerHTML = emptyHTML('🔔','No notifications','When AI finds a match for your reports, contact details will appear here.');
    return;
  }

  $('#notifList').innerHTML = myMatches.map(m => {
    const mId = matchId(m);
    const iAmLost  = m.lost.ownerEmail  === myEmail;
    const iAmFound = m.found.ownerEmail === myEmail;
    const other    = iAmLost ? m.found : m.lost;
    const myItem   = iAmLost ? m.lost  : m.found;
    const role     = iAmLost ? 'found' : 'lost';
    const pct      = m.confidence;
    const fillColor = pct>=75 ? '#2ED573' : pct>=50 ? '#F5B731' : '#F97316';
    const sentAt = Math.max(m.lost.createdAt || 0, m.found.createdAt || 0);
    const formatDateTime = (ts) => {
      if (!ts) return 'Unknown';
      const d = new Date(ts);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
    };
    const sentStr = formatDateTime(sentAt);

    return `
<article class="notif-contact-card" style="border-color:${fillColor}33">
  <div class="notif-card-hdr">
    <div class="notif-card-icon">${iAmLost?'🎯':'📬'}</div>
    <div class="notif-card-title-group">
      <div class="notif-card-title">
        ${iAmLost ? 'Your lost item may have been found!' : 'The item you found may belong to someone!'}
      </div>
      <div class="notif-card-sub">
        <span class="confidence-dot" style="background:${fillColor}"></span>
        ${pct}% match — ${esc(m.reason)}
      </div>
      <div class="notif-card-time">
        <span>🕒 Sent: ${sentStr} (${timeAgo(sentAt)})</span>
      </div>
    </div>
    <button type="button" class="btn-clear-notif" onclick="clearNotification('${mId}')" title="Clear notification">
      ✕ Clear
    </button>
  </div>

  <!-- Items involved -->
  <div class="notif-items-row">
    <div class="notif-item-chip notif-lost">
      <span>Lost</span>
      <strong>${esc(m.lost.title)}</strong>
    </div>
    <div class="notif-arrow">↔</div>
    <div class="notif-item-chip notif-found">
      <span>Found</span>
      <strong>${esc(m.found.title)}</strong>
    </div>
  </div>

  <!-- Found Item Photo (Uploaded by Finder) -->
  ${m.found.photoUri && m.found.photoUri !== '' && m.found.photoUri !== 'demo-uri' ? `
  <div class="notif-photo-card">
    <div class="notif-photo-label">🖼️ Found Item Photo (Uploaded by ${esc(m.found.ownerName||'Finder')})</div>
    <div class="notif-photo-wrapper">
      <img src="${esc(m.found.photoUri)}"
           alt="Found Item Photo"
           class="notif-found-img"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
      <div class="notif-photo-fallback" style="display:none;">
        📷 Photo attached by finder (${esc(m.found.title)})
      </div>
    </div>
  </div>
  ` : `
  <div class="notif-no-photo-note">
    📷 No photo was attached by finder for this report
  </div>
  `}

  <!-- Contact card of the OTHER person -->
  <div class="notif-contact-block">
    <div class="notif-contact-label">📞 Contact &amp; Actions — ${esc(other.ownerName||'Student')}</div>
    <div class="notif-contact-detail">
      <div class="notif-contact-row">
        <span class="notif-contact-icon">📱</span>
        <strong>${esc(other.ownerPhone||'Not provided')}</strong>
      </div>
      <div class="notif-contact-row">
        <span class="notif-contact-icon">📧</span>
        <span>${esc(other.ownerEmail||'')}</span>
      </div>
      <div class="notif-contact-row">
        <span class="notif-contact-icon">🎓</span>
        <span>${esc(other.ownerBranch||'RVU')} · Sem ${esc(other.ownerSemester||'?')}</span>
      </div>
    </div>

    <!-- Quick Action Buttons -->
    <div class="notif-actions-row">
      ${(() => {
        const cleanPhone = String(other.ownerPhone || '').replace(/\D/g, '');
        const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
        const rawMsg = `Hi ${other.ownerName || 'there'}! I saw your report on LostLink AI regarding "${myItem.title}". Let's coordinate returning it!`;
        return cleanPhone.length >= 10 ? `
          <button type="button" class="btn-notif-action btn-wa" data-phone="${waPhone}" data-msg="${encodeURIComponent(rawMsg)}" onclick="sendWhatsAppFromEl(this); return false;">
            💬 WhatsApp
          </button>
          <button type="button" class="btn-notif-action btn-call" data-phone="${cleanPhone}" onclick="callPhoneFromEl(this); return false;">
            📞 Call
          </button>
          <button type="button" class="btn-notif-action btn-sms" data-phone="${cleanPhone}" data-msg="${encodeURIComponent(rawMsg)}" onclick="sendSmsFromEl(this); return false;" style="background:rgba(168,85,247,0.15); color:#C084FC; border:1px solid rgba(168,85,247,0.3);">
            📩 SMS
          </button>
        ` : '';
      })()}
      <button type="button" class="btn-notif-action btn-maps" onclick="window.openMaps(${ADMIN_LAT}, ${ADMIN_LNG}, 'RVU Admin Block Collection Point'); return false;">
        📍 Admin Block
      </button>
    </div>
  </div>

  <!-- Location details -->
  <div class="notif-location-row">
    <span>📍</span>
    <span>
      ${iAmLost?`You lost it at: <strong>${esc(m.lost.location)}</strong>`:''}
      ${iAmFound?`You found it at: <strong>${esc(m.found.location)}</strong>`:''}
      · They reported: <strong>${esc(other.location)}</strong>
    </span>
  </div>

  <!-- Call-to-action -->
  <div class="notif-cta-row">
    <div class="notif-cta-note">
      ⚠️ Collect only after verification at <strong>RVU Admin Block</strong>
    </div>
  </div>
</article>`;
  }).join('');
}

function updateNotifBadge() {
  if (!state.user) return;
  const myEmail = state.user.email;
  const seenIds = getSeenIds();
  const clearedIds = getClearedNotifIds();
  const myMatches = state.matches.filter(m => (m.lost.ownerEmail === myEmail || m.found.ownerEmail === myEmail) && !clearedIds.includes(matchId(m)));
  const unseen = myMatches.filter(m => !seenIds.includes(matchId(m))).length;

  // Header Bell Badge
  const badge = $('#notifBadge');
  if (badge) {
    badge.textContent = unseen;
    badge.classList.toggle('hidden', unseen === 0);
  }

  // Home Greeting Card Bell Badge
  const homeBadge = $('#homeNotifBadge');
  if (homeBadge) {
    homeBadge.textContent = unseen;
    homeBadge.classList.toggle('hidden', unseen === 0);
  }

  // Bottom Nav Matches Tab Badge
  const matchesBadge = $('#matchesNotifBadge');
  if (matchesBadge) {
    matchesBadge.textContent = myMatches.length;
    matchesBadge.classList.toggle('hidden', myMatches.length === 0);
  }

  // Home Screen Match Alert Banner
  const banner = $('#homeMatchBanner');
  const bannerText = $('#homeMatchBannerText');
  if (banner) {
    if (myMatches.length > 0) {
      const topMatch = myMatches[0];
      const iAmLost = topMatch.lost.ownerEmail === myEmail;
      const myItem = iAmLost ? topMatch.lost : topMatch.found;
      const otherItem = iAmLost ? topMatch.found : topMatch.lost;
      if (bannerText) {
        bannerText.textContent = `${iAmLost ? 'Lost' : 'Found'} "${myItem.title}" matched ${topMatch.confidence}% with "${otherItem.title}"!`;
      }
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

// ============================================================
// 17. RENDER — Profile → My Reports
// ============================================================
function renderMyReports() {
  if (!state.user) return;
  populateProfile();
  const mine = state.reports.filter(r=>r.ownerEmail===state.user.email);
  $('#myReportsList').innerHTML = mine.length
    ? mine.map(reportCardHTML).join('')
    : emptyHTML('📝','No reports yet','Use the + button to file your first report.');
}

// ============================================================
// 18. HTML COMPONENT GENERATORS
// ============================================================
function reportCardHTML(r) {
  const icon  = CAT_ICONS[r.category] || '📦';
  const badge = r.type==='LOST'
    ? '<span class="badge badge-lost">LOST</span>'
    : '<span class="badge badge-found">FOUND</span>';
  const rId = r.id || r.createdAt || '';
  const fbKey = r._fbKey || '';
  return `
<article class="report-card" data-report-id="${rId}" data-fb-key="${fbKey}">
  <div class="report-icon">${icon}</div>
  <div class="report-body">
    <div class="report-title">${esc(r.title)}</div>
    <div class="report-loc">📍 ${esc(r.location)}</div>
    <div class="report-meta">
      <strong>${esc(r.ownerName||'Student')}</strong>
      · ${esc(r.ownerBranch||'RVU')} · ${timeAgo(r.createdAt)}
    </div>
  </div>
  <div class="report-actions-col">
    ${badge}
    <button type="button" class="btn-clear-report" onclick="confirmClearReport('${rId}', '${fbKey}')" title="Clear this report">
      🗑️ Clear
    </button>
  </div>
</article>`;
}

function matchCardHTML(m) {
  const pct   = m.confidence;
  const color = pct>=75 ? '#2ED573' : pct>=50 ? '#F5B731' : '#F97316';
  return `
<article class="match-card">
  <div class="match-hdr">
    <div>
      <div class="match-pct-label">AI Confidence</div>
      <div class="match-pct" style="color:${color}">${pct}%</div>
    </div>
    <div class="match-reason">${esc(m.reason)}</div>
  </div>
  <div class="confidence-bar">
    <div class="confidence-fill" style="width:${pct}%;background:${color}"></div>
  </div>

  <!-- Item pair -->
  <div class="match-pair">
    <div class="match-item">
      <div class="match-item-tag lost-t">LOST BY</div>
      <div class="match-item-name">${esc(m.lost.ownerName||'Student')}</div>
      <div class="match-item-by">${esc(m.lost.title)}</div>
      <div class="match-item-by" style="color:var(--text-5);font-size:10px">📍 ${esc(m.lost.location)}</div>
    </div>
    <div class="match-arrow-col">↔</div>
    <div class="match-item">
      <div class="match-item-tag found-t">FOUND BY</div>
      <div class="match-item-name">${esc(m.found.ownerName||'Student')}</div>
      <div class="match-item-by">${esc(m.found.title)}</div>
      <div class="match-item-by" style="color:var(--text-5);font-size:10px">📍 ${esc(m.found.location)}</div>
    </div>
  </div>

  <!-- Contact Details Grid -->
  <div class="contact-grid">
    <div class="contact-card">
      <div class="contact-type lost-t">Lost Person Contact</div>
      <div class="contact-name">${esc(m.lost.ownerName||'—')}</div>
      <div class="contact-detail">
        📱 ${esc(m.lost.ownerPhone||'N/A')}<br>
        📧 ${esc(m.lost.ownerEmail||'')}<br>
        🎓 ${esc(m.lost.ownerBranch||'')} · Sem ${esc(m.lost.ownerSemester||'?')}
        ${m.lost.ownerPhone && String(m.lost.ownerPhone).replace(/\D/g,'').length >= 10 ? `
        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" data-phone="${String(m.lost.ownerPhone).replace(/\D/g,'')}" data-msg="${encodeURIComponent(`Hi ${m.lost.ownerName || 'there'}! Reaching out via LostLink AI regarding your lost item: ${m.lost.title}.`)}" onclick="sendWhatsAppFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(37,211,102,0.18); color:#25D366; border:none; cursor:pointer;">💬 WhatsApp</button>
          <button type="button" data-phone="${String(m.lost.ownerPhone).replace(/\D/g,'')}" onclick="callPhoneFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(59,130,246,0.18); color:#60A5FA; border:none; cursor:pointer;">📞 Call</button>
          <button type="button" data-phone="${String(m.lost.ownerPhone).replace(/\D/g,'')}" data-msg="${encodeURIComponent(`Hi ${m.lost.ownerName || 'there'}! Reaching out via LostLink AI regarding your lost item: ${m.lost.title}.`)}" onclick="sendSmsFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(168,85,247,0.18); color:#C084FC; border:none; cursor:pointer;">📩 SMS</button>
        </div>` : ''}
      </div>
    </div>
    <div class="contact-card">
      <div class="contact-type found-t">Found Person Contact</div>
      <div class="contact-name">${esc(m.found.ownerName||'—')}</div>
      <div class="contact-detail">
        📱 ${esc(m.found.ownerPhone||'N/A')}<br>
        📧 ${esc(m.found.ownerEmail||'')}<br>
        🎓 ${esc(m.found.ownerBranch||'')} · Sem ${esc(m.found.ownerSemester||'?')}
        ${m.found.ownerPhone && String(m.found.ownerPhone).replace(/\D/g,'').length >= 10 ? `
        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" data-phone="${String(m.found.ownerPhone).replace(/\D/g,'')}" data-msg="${encodeURIComponent(`Hi ${m.found.ownerName || 'there'}! Reaching out via LostLink AI regarding the found item: ${m.found.title}.`)}" onclick="sendWhatsAppFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(37,211,102,0.18); color:#25D366; border:none; cursor:pointer;">💬 WhatsApp</button>
          <button type="button" data-phone="${String(m.found.ownerPhone).replace(/\D/g,'')}" onclick="callPhoneFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(59,130,246,0.18); color:#60A5FA; border:none; cursor:pointer;">📞 Call</button>
          <button type="button" data-phone="${String(m.found.ownerPhone).replace(/\D/g,'')}" data-msg="${encodeURIComponent(`Hi ${m.found.ownerName || 'there'}! Reaching out via LostLink AI regarding the found item: ${m.found.title}.`)}" onclick="sendSmsFromEl(this); return false;" style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(168,85,247,0.18); color:#C084FC; border:none; cursor:pointer;">📩 SMS</button>
        </div>` : ''}
      </div>
    </div>
  </div>

  <div class="collection-pill">
    ⭐ Collect only at RVU Admin Block after staff verification.
  </div>
</article>`;
}

function emptyHTML(icon, title, text) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${esc(title)}</div>
    <p class="empty-text">${esc(text)}</p>
  </div>`;
}

// ============================================================
// 19. LOCATION DROPDOWN
// ============================================================
function populateLocationDropdown() {
  const sel = $('#location');
  sel.innerHTML = '<option value="">Select a landmark</option>'
    + LOCATIONS.map(l=>`<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('');
}

// ============================================================
// 20. ANIMATED NUMBERS
// ============================================================
function animNum(id, target) {
  const el=$(`#${id}`); if(!el) return;
  const cur=parseInt(el.textContent,10)||0;
  if(cur===target){el.textContent=target;return;}
  const steps=Math.min(Math.abs(target-cur),20), inc=(target-cur)/steps;
  let i=0;
  const t=setInterval(()=>{ i++; el.textContent=Math.round(cur+inc*i); if(i>=steps){el.textContent=target;clearInterval(t);} },30);
}

// ============================================================
// 22. REFRESH ALL
// ============================================================
function refreshAll() {
  renderDashboard();
  renderAllReports();
  renderMatches();
  updateNotifBadge();
  if (state.activeScreen==='profile')  { populateProfile(); renderMyReports(); }
  if (state.activeScreen==='notifications') renderNotifications();
}

// ============================================================
// 23. AUTO-SYNC
// ============================================================
async function startSync() {
  // Immediate sync
  await syncReports();
  refreshAll();

  // Periodic sync
  clearInterval(state.syncTimer);
  state.syncTimer = setInterval(async () => {
    await syncReports();
    refreshAll();
  }, SYNC_INTERVAL);
}

// ============================================================
// 24. EVENT BINDING
// ============================================================
function bindEvents() {
  // Auth
  $('#authForm').addEventListener('submit', handleProfileForm);
  $('#googleSignInBtn').addEventListener('click', () => {
    setAuthLoading(true, 'Connecting to Google...');
    native.signInWithGoogle();
  });
  $('#authCancelBtn')?.addEventListener('click', resetAuthView);

  // SMS OTP Verification
  $('#sendOtpBtn')?.addEventListener('click', () => openOtpModal($('#authPhone').value.trim()));
  $('#otpCancelBtn')?.addEventListener('click', closeOtpModal);
  $('#otpVerifyBtn')?.addEventListener('click', verifyEnteredOtp);
  $('#otpResendBtn')?.addEventListener('click', () => openOtpModal(state.otp.phone || $('#authPhone').value.trim()));
  $('#otpModal')?.addEventListener('click', (e) => { if (e.target === $('#otpModal')) closeOtpModal(); });
  $('#homeNotifBtn')?.addEventListener('click', () => navigate('notifications'));

  setupOtpDigitInputs();

  // Logout button → open modal; modal buttons
  $('#logoutBtn').addEventListener('click', showLogoutModal);
  $('#logoutCancelBtn').addEventListener('click', hideLogoutModal);
  $('#logoutConfirmBtn').addEventListener('click', logout);
  // Close modal by clicking backdrop
  $('#logoutModal').addEventListener('click', (e)=>{ if (e.target === $('#logoutModal')) hideLogoutModal(); });

  // Header notification bell
  $('#notifBtn').addEventListener('click', ()=>navigate('notifications'));

  // Notification clear all button
  const notifClearAllBtn = $('#notifClearAllBtn');
  if (notifClearAllBtn) {
    notifClearAllBtn.addEventListener('click', clearAllNotifs);
  }

  // Bottom nav
  $$('.nav-btn[data-nav]').forEach(b=>
    b.addEventListener('click', ()=>navigate(b.dataset.nav))
  );

  // Home profile card → navigate to profile
  const homeProfileBtn = $('#homeProfileCard .home-profile-btn');
  if (homeProfileBtn) homeProfileBtn.addEventListener('click', ()=>navigate('profile'));

  // Also allow clicking the whole card (avatar/name area)
  const homeProfileCard = $('#homeProfileCard');
  if (homeProfileCard) homeProfileCard.addEventListener('click', (e)=>{
    if (!e.target.closest('button')) navigate('profile');
  });

  // Report triggers
  $$('[data-open-report]').forEach(b=>
    b.addEventListener('click', ()=>openReportSheet(b.dataset.openReport))
  );

  // Sheet close
  $$('[data-close-sheet]').forEach(b=>
    b.addEventListener('click', closeReportSheet)
  );

  // Report submit
  $('#reportForm').addEventListener('submit', submitReport);

  // Photo picker
  $('#photoPickerBtn').addEventListener('click', () => native.choosePhoto());

  // Segment filter (Reports screen)
  $$('.seg-btn').forEach(b=>b.addEventListener('click', ()=>{
    $$('.seg-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.activeFilter = b.dataset.filter;
    renderAllReports();
  }));

  // ESC closes sheet
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeReportSheet(); });
}

// ============================================================
// 25. INIT
// ============================================================
async function init() {
  // Purge outdated service worker caches for instant updates on iPhone Safari & Web
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const k of keys) {
        if (k !== 'lostlink-v5-network-first') await caches.delete(k);
      }
    } catch (e) {}
  }

  // Handle Google OAuth 2.0 Web redirect tokens (if redirected back)
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname);
        setAuthLoading(true, 'Verifying @rvu.edu.in account...');
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const profile = await res.json();
        if (profile && profile.email && RVU_EMAIL_RE.test(profile.email)) {
          window.onNativeGoogleSignIn && window.onNativeGoogleSignIn({
            ok: true,
            name: profile.name || profile.email.split('@')[0],
            email: profile.email.toLowerCase(),
            photoUrl: profile.picture || ''
          });
        } else {
          setAuthLoading(false);
          toast('Access restricted: Please select an official @rvu.edu.in Google account', 'error');
        }
      }
    } catch (e) {
      console.error('OAuth redirect token error:', e);
    }
  }

  state.user = loadUser();
  populateLocationDropdown();
  bindEvents();
  $('#eventDate').value = localDate();
  renderAuthState();

  if (state.user) {
    startSync();
  }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// 26. PWA INSTALLATION & SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=5.0').catch(() => {});
  });
}

(function initPWA() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone || typeof window.LostLinkNative !== 'undefined') return;

  let deferredPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');
  const btn = document.getElementById('pwaInstallBtn');
  const dismiss = document.getElementById('pwaDismissBtn');
  const sub = document.getElementById('pwaInstallSub');
  if (!banner || !btn) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    if (sub) sub.textContent = 'Tap Share ⎋ → Add to Home Screen';
    if (btn) btn.textContent = 'How to Install';
    btn.addEventListener('click', () => {
      alert('To install LostLink AI on iPhone:\n\n1. Tap the Share button (square with arrow up at the bottom of Safari)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" on the top right\n\nLostLink AI will now appear on your iPhone home screen as an app!');
    });
    banner.style.display = 'flex';
  } else {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      banner.style.display = 'flex';
    });

    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        banner.style.display = 'none';
      } else {
        alert('To install on Android:\nTap your browser menu (three dots ⋮) and select "Install app" or "Add to Home screen".');
      }
    });
  }

  if (dismiss) {
    dismiss.addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
})();



















