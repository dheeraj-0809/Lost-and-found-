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
const ALERTED_MATCHES_KEY = 'll_alerted_matches_v3'; // popped-up match alerts

const ADMIN_LAT    = 12.923388382208246;
const ADMIN_LNG    = 77.49976656532213;
const SYNC_INTERVAL= 5000; // ms between live shallow cloud checks (~490 bytes)

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
  hasFullSync:  false,
  firebaseKeys: new Set(),
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
            reader.onload = async (e) => {
              const compressed = await compressImageDataUrl(e.target.result, 640, 0.68);
              window.onNativePhotoSelected && window.onNativePhotoSelected(compressed);
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
    const isApk = isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.openWebAuth;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&prompt=select_account` +
      `&hd=rvu.edu.in` +
      (isApk ? `&state=native_apk` : '');

    // On Android native APK: open Google OAuth in Chrome (not WebView) so Google accepts it
    if (isApk) {
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
function normEmail(em) { return String(em || '').toLowerCase().trim(); }
function emailToDbKey(email) { return String(email || '').toLowerCase().trim().replace(/\./g, '_dot_'); }

function matchId(m) {
  const lId = m.lost._fbKey || m.lost.id || m.lost.createdAt;
  const fId = m.found._fbKey || m.found.id || m.found.createdAt;
  return `${lId}-${fId}`;
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
// 6. FIREBASE REST API & IMAGE COMPRESSION
// ============================================================
function compressImageDataUrl(dataUrl, maxDim = 640, quality = 0.68) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl || '');
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width || 640;
        let h = img.height || 480;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out && out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(tid);
    }
  }
  return await fetch(url, options);
}

function buildFbUrl(path) {
  const parts = String(path || '').split('?');
  const basePath = parts[0].replace(/\.json$/, '');
  const qs = parts[1] ? `?${parts[1]}` : '';
  return `${FIREBASE_DB_URL}/${basePath}.json${qs}`;
}

async function fbGetStatus(path) {
  if (!FIREBASE_DB_URL) return { ok: false, data: null };
  try {
    const r = await fetchWithTimeout(buildFbUrl(path), { method: 'GET', cache: 'no-store' }, 20000);
    if (!r.ok) return { ok: false, data: null };
    const data = await r.json();
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

async function fbGet(path) {
  const res = await fbGetStatus(path);
  return res.ok ? res.data : null;
}

async function fbPost(path, data) {
  if (!FIREBASE_DB_URL) return null;
  try {
    const r = await fetchWithTimeout(buildFbUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 20000);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fbPut(path, data) {
  if (!FIREBASE_DB_URL) return null;
  try {
    const r = await fetchWithTimeout(buildFbUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 15000);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fbDelete(path) {
  if (!FIREBASE_DB_URL) return false;
  try {
    const r = await fetchWithTimeout(buildFbUrl(path), { method: 'DELETE' }, 15000);
    return r.ok;
  } catch { return false; }
}

function getClearedNotifIds() { return safeArr(localStorage.getItem(CLEARED_NOTIFS_KEY)); }
function getAlertedMatchIds() { return safeArr(localStorage.getItem(ALERTED_MATCHES_KEY)); }

function addClearedNotifId(id) {
  const cleared = getClearedNotifIds();
  if (!cleared.includes(id)) {
    cleared.push(id);
    localStorage.setItem(CLEARED_NOTIFS_KEY, JSON.stringify(cleared));
  }
}

function addAlertedMatchId(id) {
  const alerted = getAlertedMatchIds();
  if (!alerted.includes(id)) {
    alerted.push(id);
    try { localStorage.setItem(ALERTED_MATCHES_KEY, JSON.stringify(alerted)); } catch {}
  }
}

window.clearNotification = function(mId) {
  addClearedNotifId(mId);
  updateNotifBadge();
  renderNotifications();
  toast('Notification cleared', 'info');
};

function clearAllNotifs() {
  const myEmail = normEmail(state.user ? state.user.email : '');
  const myMatches = state.matches.filter(m => normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail);
  myMatches.forEach(m => addClearedNotifId(matchId(m)));
  updateNotifBadge();
  renderNotifications();
  toast('All notifications cleared', 'info');
}

async function deleteReport(reportId, fbKey) {
  if (FIREBASE_DB_URL && fbKey) {
    await fbDelete('reports/' + fbKey);
    state.firebaseKeys.delete(fbKey);
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
function reportDedupeKey(r) {
  if (r._fbKey) return r._fbKey;
  return `${r.createdAt || ''}|${normEmail(r.ownerEmail)}|${norm(r.title)}`;
}

function localGetReports() {
  const cached = safeArr(localStorage.getItem(REPORTS_KEY));
  let nativeList = [];
  if (hasNative) {
    try { nativeList = safeArr(window.LostLinkNative.getReports()); } catch {}
  }
  if (!nativeList.length) return cached;
  if (!cached.length) return nativeList;
  const merged = new Map();
  cached.forEach(r => merged.set(reportDedupeKey(r), r));
  nativeList.forEach(r => {
    const dk = `${r.createdAt || ''}|${normEmail(r.ownerEmail)}|${norm(r.title)}`;
    const exists = Array.from(merged.values()).some(x =>
      (r._fbKey && x._fbKey === r._fbKey) ||
      (`${x.createdAt || ''}|${normEmail(x.ownerEmail)}|${norm(x.title)}` === dk)
    );
    if (!exists) merged.set(reportDedupeKey(r), r);
  });
  return Array.from(merged.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function localSaveReport(data) {
  if (hasNative) {
    try {
      const result = safeObj(window.LostLinkNative.saveReport(JSON.stringify(data)));
      if (result.ok) {
        data.id = result.id;
      }
    } catch {}
  }
  const items = safeArr(localStorage.getItem(REPORTS_KEY));
  if (!data.id) data.id = Date.now().toString();
  if (!data.status) data.status = 'OPEN';
  if (!data.createdAt) data.createdAt = Date.now();
  items.unshift(data);
  cacheReports(items);
  return { ok: true, id: data.id };
}

function cacheReports(reports) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    // Strip heavy photoURIs if storage quota is tight, preserving all report metadata & matches
    try {
      const compact = reports.map(r => (r.photoUri && r.photoUri.length > 50000) ? { ...r, photoUri: '' } : r);
      localStorage.setItem(REPORTS_KEY, JSON.stringify(compact));
    } catch {
      try {
        const minimal = reports.slice(0, 60).map(r => ({ ...r, photoUri: '' }));
        localStorage.setItem(REPORTS_KEY, JSON.stringify(minimal));
      } catch {}
    }
  }
}

/** Flush any locally queued offline reports up to Firebase */
async function flushPendingUploads(reportsList) {
  let changed = false;
  for (const r of reportsList) {
    if (r._pendingUpload && !r._fbKey) {
      const payload = { ...r };
      delete payload._pendingUpload;
      delete payload._fbKey;
      const res = await fbPost('reports', payload);
      if (res && res.name) {
        r._fbKey = res.name;
        delete r._pendingUpload;
        state.firebaseKeys.add(res.name);
        changed = true;
      }
    }
  }
  if (changed) cacheReports(reportsList);
}

/** Fetch reports from Firebase using fast shallow diffing after initial load */
async function syncReports(showToast = false) {
  if (!FIREBASE_DB_URL) {
    state.reports = localGetReports();
    state.firebaseOk = false;
    updateSyncStatus('Local only');
    $('#firebaseNote') && $('#firebaseNote').classList.remove('hidden');
    state.matches = computeMatches(state.reports);
    return;
  }

  try {
    let syncSuccess = false;

    if (!state.hasFullSync || showToast) {
      const res = await fbGetStatus('reports');
      if (res.ok) {
        syncSuccess = true;
        const raw = res.data || {};
        const fbArr = Object.entries(raw).map(([key, val]) => ({ ...val, _fbKey: key }));
        state.firebaseKeys = new Set(fbArr.map(r => r._fbKey));

        const localArr = localGetReports();
        const mergedMap = new Map();
        const sigSet = new Set();

        fbArr.forEach(r => {
          mergedMap.set(r._fbKey, r);
          sigSet.add(`${r.createdAt || ''}|${normEmail(r.ownerEmail)}|${norm(r.title)}`);
        });

        localArr.forEach(r => {
          const sig = `${r.createdAt || ''}|${normEmail(r.ownerEmail)}|${norm(r.title)}`;
          if (r._fbKey && mergedMap.has(r._fbKey)) return;
          if (sigSet.has(sig)) return;
          mergedMap.set(reportDedupeKey(r), r);
        });

        const arr = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        await flushPendingUploads(arr);
        state.reports = arr;
        state.hasFullSync = true;
        cacheReports(arr);
      }
    } else {
      // Fast 490-byte shallow check to detect additions/deletions across campus within seconds
      const shallowRes = await fbGetStatus('reports?shallow=true');
      if (shallowRes.ok) {
        syncSuccess = true;
        const remoteKeysObj = shallowRes.data || {};
        const remoteKeys = new Set(Object.keys(remoteKeysObj));

        const newKeys = [...remoteKeys].filter(k => !state.firebaseKeys.has(k));
        const deletedKeys = [...state.firebaseKeys].filter(k => !remoteKeys.has(k));

        let updated = false;
        if (deletedKeys.length > 0) {
          const delSet = new Set(deletedKeys);
          state.reports = state.reports.filter(r => !r._fbKey || !delSet.has(r._fbKey));
          deletedKeys.forEach(k => state.firebaseKeys.delete(k));
          updated = true;
        }

        if (newKeys.length > 0) {
          const fetched = await Promise.all(
            newKeys.map(async (k) => {
              const itemRes = await fbGetStatus(`reports/${k}`);
              return (itemRes.ok && itemRes.data) ? { ...itemRes.data, _fbKey: k } : null;
            })
          );
          fetched.forEach(item => {
            if (!item) return;
            state.firebaseKeys.add(item._fbKey);
            const sig = `${item.createdAt || ''}|${normEmail(item.ownerEmail)}|${norm(item.title)}`;
            const existingIdx = state.reports.findIndex(r =>
              r._fbKey === item._fbKey ||
              (`${r.createdAt || ''}|${normEmail(r.ownerEmail)}|${norm(r.title)}` === sig)
            );
            if (existingIdx >= 0) {
              state.reports[existingIdx] = item;
            } else {
              state.reports.unshift(item);
            }
            updated = true;
          });
        }

        await flushPendingUploads(state.reports);
        if (updated) {
          state.reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cacheReports(state.reports);
        }
      }
    }

    if (syncSuccess) {
      state.firebaseOk = true;
      updateSyncStatus('Synced');
      if (showToast) toast('Reports updated ✓');
    } else {
      if (!state.reports.length) state.reports = localGetReports();
      state.firebaseOk = false;
      updateSyncStatus(navigator.onLine === false ? 'Offline mode' : 'Reconnecting...');
    }
  } catch (e) {
    if (!state.reports.length) state.reports = localGetReports();
    state.firebaseOk = false;
    updateSyncStatus(navigator.onLine === false ? 'Offline mode' : 'Reconnecting...');
  }

  state.matches = computeMatches(state.reports);
  checkAndPopupNewMatches();
}

function checkAndPopupNewMatches() {
  if (!state.user || !state.matches.length) return;
  const myEmail = normEmail(state.user.email);
  const clearedIds = getClearedNotifIds();
  const alertedIds = getAlertedMatchIds();

  const unseenMatches = state.matches.filter(m => {
    const id = matchId(m);
    const involvesMe = normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail;
    return involvesMe && !clearedIds.includes(id) && !alertedIds.includes(id);
  });

  if (unseenMatches.length > 0) {
    const top = unseenMatches[0];
    addAlertedMatchId(matchId(top));
    notifyUserOfMatch(top, true);
  }
}

function showMatchPopup(match) {
  if (!match || !state.user) return;
  const modal = $('#matchPopupModal');
  if (!modal) return;

  const myEmail = normEmail(state.user.email);
  const iAmLost = normEmail(match.lost.ownerEmail) === myEmail;
  const other = iAmLost ? match.found : match.lost;
  const myItem = iAmLost ? match.lost : match.found;
  const pct = match.confidence;
  const color = pct >= 75 ? '#2ED573' : pct >= 50 ? '#F5B731' : '#F97316';

  const subEl = $('#matchPopupSub');
  if (subEl) subEl.textContent = iAmLost ? 'Someone found an item matching yours!' : 'Your found item matches a lost report!';

  const pctEl = $('#matchPopupPctBadge');
  if (pctEl) {
    pctEl.textContent = `${pct}% Match`;
    pctEl.style.color = color;
    pctEl.style.background = `${color}28`;
  }

  const reasonEl = $('#matchPopupReason');
  if (reasonEl) {
    reasonEl.innerHTML = `<strong>AI Match Signals:</strong> ${esc(match.reason)}`;
  }

  const itemsEl = $('#matchPopupItems');
  if (itemsEl) {
    itemsEl.innerHTML = `
      <div style="background:rgba(239,68,68,0.10); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:8px;">
        <div style="font-size:10px; font-weight:800; color:#F87171;">LOST ITEM</div>
        <div style="font-size:12.5px; font-weight:700; color:#F8FAFC; margin-top:2px;">${esc(match.lost.title)}</div>
        <div style="font-size:10.5px; color:#94A3B8; margin-top:2px;">📍 ${esc(match.lost.location)}</div>
      </div>
      <div style="background:rgba(34,197,94,0.10); border:1px solid rgba(34,197,94,0.25); border-radius:10px; padding:8px;">
        <div style="font-size:10px; font-weight:800; color:#4ADE80;">FOUND ITEM</div>
        <div style="font-size:12.5px; font-weight:700; color:#F8FAFC; margin-top:2px;">${esc(match.found.title)}</div>
        <div style="font-size:10.5px; color:#94A3B8; margin-top:2px;">📍 ${esc(match.found.location)}</div>
      </div>`;
  }

  const photoWrap = $('#matchPopupPhotoWrap');
  const photoEl = $('#matchPopupPhoto');
  const displayPhoto = (match.found.photoUri && match.found.photoUri !== 'demo-uri')
    ? match.found.photoUri
    : ((match.lost.photoUri && match.lost.photoUri !== 'demo-uri') ? match.lost.photoUri : '');
  if (photoWrap && photoEl) {
    if (displayPhoto) {
      photoEl.src = displayPhoto;
      photoWrap.classList.remove('hidden');
    } else {
      photoEl.src = '';
      photoWrap.classList.add('hidden');
    }
  }

  const roleEl = $('#matchPopupPersonRole');
  if (roleEl) {
    roleEl.textContent = iAmLost ? '📞 Found By (Contact Details)' : '📞 Lost By (Owner Details)';
  }

  const infoEl = $('#matchPopupPersonInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div><strong>👤 Name:</strong> ${esc(other.ownerName || 'RVU Student')}</div>
      <div><strong>📱 Mobile:</strong> ${esc(other.ownerPhone || 'Not provided')}</div>
      <div><strong>📧 Email:</strong> ${esc(other.ownerEmail || '—')}</div>
      <div><strong>🎓 Academic:</strong> ${esc(other.ownerBranch || 'RVU')} · Sem ${esc(other.ownerSemester || '?')}</div>
      <div><strong>📍 Reported At:</strong> ${esc(other.location || 'RVU Campus')}</div>`;
  }

  const actionsEl = $('#matchPopupActions');
  if (actionsEl) {
    const cleanPhone = String(other.ownerPhone || '').replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const rawMsg = `Hi ${other.ownerName || 'there'}! LostLink AI matched "${myItem.title}" (${pct}% match). Let's connect at RVU Admin Block!`;
    actionsEl.innerHTML = (cleanPhone.length >= 10 ? `
      <button type="button" class="btn-notif-action btn-wa" data-phone="${waPhone}" data-msg="${encodeURIComponent(rawMsg)}" onclick="sendWhatsAppFromEl(this); return false;">💬 WhatsApp</button>
      <button type="button" class="btn-notif-action btn-call" data-phone="${cleanPhone}" onclick="callPhoneFromEl(this); return false;">📞 Call</button>
    ` : '') + `
      <button type="button" class="btn-notif-action btn-maps" onclick="window.openMaps(${ADMIN_LAT}, ${ADMIN_LNG}, 'RVU Admin Block Collection Point'); return false;">📍 Admin Block</button>
    `;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMatchPopup() {
  const modal = $('#matchPopupModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function notifyUserOfMatch(match, openPopup = true) {
  if (!match || !state.user) return;
  const iAmLost = normEmail(match.lost.ownerEmail) === normEmail(state.user.email);
  const myItem = iAmLost ? match.lost : match.found;
  const otherItem = iAmLost ? match.found : match.lost;
  const title = `🎯 Match Alert (${match.confidence}% Match)`;
  const msg = `${iAmLost ? 'Your lost' : 'Your found'} "${myItem.title}" matched ${match.confidence}% with "${otherItem.title}"!`;

  toast(msg, 'success');
  if (openPopup) showMatchPopup(match);

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
    let result = await fbPost('reports', data);
    if (!result || !result.name) {
      // Retry once after brief pause on transient mobile data drops
      await new Promise(res => setTimeout(res, 600));
      result = await fbPost('reports', data);
    }
    if (result && result.name) {
      firebaseKey = result.name;
      data._fbKey = firebaseKey;
      state.firebaseKeys.add(firebaseKey);
      state.firebaseOk = true;
      updateSyncStatus('Synced');
    } else {
      data._pendingUpload = true;
    }
  }

  // Also save locally (offline backup / on-device SQLite)
  localSaveReport({ ...data });

  // Add to in-memory state immediately
  state.reports.unshift(data);
  cacheReports(state.reports);
  state.matches = computeMatches(state.reports);

  return { ok: true, firebaseKey, offlineQueued: !firebaseKey && !!FIREBASE_DB_URL };
}

function updateSyncStatus(msg) {
  const el = $('#syncStatus');
  if (el) el.textContent = msg;
}

// ============================================================
// 8. AI MATCHING ENGINE
// ============================================================
const COLOR_FAMILIES = [
  ['white', 'cream', 'offwhite', 'ivory', 'beige', 'pearl'],
  ['black', 'dark', 'charcoal', 'matteblack', 'jetblack'],
  ['grey', 'gray', 'silver', 'slate', 'graphite'],
  ['blue', 'navy', 'darkblue', 'skyblue', 'lightblue', 'cyan', 'teal'],
  ['red', 'maroon', 'crimson', 'burgundy'],
  ['green', 'olive', 'darkgreen', 'lightgreen', 'mint'],
  ['yellow', 'gold', 'golden', 'mustard'],
  ['pink', 'rose', 'magenta', 'peach'],
  ['brown', 'tan', 'khaki', 'bronze', 'copper'],
  ['purple', 'violet', 'lavender'],
];

function areSimilarColors(c1, c2) {
  if (!c1 || !c2 || c1 === 'unknown' || c2 === 'unknown') return false;
  if (c1 === c2) return true;
  for (const fam of COLOR_FAMILIES) {
    const m1 = fam.some(w => c1.includes(w));
    const m2 = fam.some(w => c2.includes(w));
    if (m1 && m2) return true;
  }
  return false;
}

function locationDistanceMeters(locA, locB) {
  const a = LOCATIONS.find(l => norm(l.name) === locA);
  const b = LOCATIONS.find(l => norm(l.name) === locB);
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function computeMatches(reports) {
  const losts  = reports.filter(r => r.type && r.type.toUpperCase() === 'LOST'  && (!r.status || r.status.toUpperCase() === 'OPEN'));
  const founds = reports.filter(r => r.type && r.type.toUpperCase() === 'FOUND' && (!r.status || r.status.toUpperCase() === 'OPEN'));
  const out    = [];
  const seen   = new Set();

  losts.forEach(l => {
    founds.forEach(f => {
      // Don't match the same person's reports with themselves
      const lEmail = normEmail(l.ownerEmail);
      const fEmail = normEmail(f.ownerEmail);
      if (lEmail && fEmail && lEmail === fEmail) return;

      const s = scoreMatch(l, f);
      if (s.score < 35) return; // minimum threshold

      const lKey = l._fbKey || l.id || String(l.createdAt);
      const fKey = f._fbKey || f.id || String(f.createdAt);
      const key = `${lKey}_${fKey}`;
      if (seen.has(key)) return;
      seen.add(key);

      out.push({ lost: l, found: f, confidence: s.score, reason: s.reasons.join(', ') || 'partial similarity' });
    });
  });

  return out.sort((a, b) => b.confidence - a.confidence);
}

function scoreMatch(l, f) {
  let score = 0;
  const reasons = [];

  // --- Item Title (strong direct signal, 20 pts) ---
  const lTit = norm(l.title), fTit = norm(f.title);
  if (lTit && fTit) {
    if (lTit === fTit) {
      score += 20;
      reasons.push('exact item name');
    } else if (lTit.includes(fTit) || fTit.includes(lTit)) {
      score += 14;
      reasons.push('similar item name');
    } else {
      const sharedTitle = countSharedWords(lTit, fTit);
      if (sharedTitle > 0) {
        score += Math.min(12, sharedTitle * 6);
        reasons.push('similar item name');
      }
    }
  }

  // --- Category (25 pts) ---
  const lCat = norm(l.category), fCat = norm(f.category);
  if (lCat && lCat !== 'other' && lCat === fCat) { score += 25; reasons.push('same category'); }
  else if (lCat && fCat && lCat !== 'other' && fCat !== 'other' && (lCat.includes(fCat) || fCat.includes(lCat))) { score += 12; }

  // --- Color (15 pts exact / 10 pts similar color family) ---
  const lCol = norm(l.color), fCol = norm(f.color);
  if (lCol && lCol !== 'unknown' && lCol === fCol) { score += 15; reasons.push('same color'); }
  else if (areSimilarColors(lCol, fCol) || (lCol && fCol && lCol !== 'unknown' && fCol !== 'unknown' && (lCol.includes(fCol) || fCol.includes(lCol)))) {
    score += 10;
    reasons.push('similar color');
  }

  // --- Brand / Model (15 pts) ---
  const lBr = norm(l.brand), fBr = norm(f.brand);
  if (lBr && lBr !== 'unknown' && lBr === fBr) { score += 15; reasons.push('same brand/model'); }
  else if (lBr && fBr && lBr !== 'unknown' && fBr !== 'unknown' && (lBr.includes(fBr) || fBr.includes(lBr))) { score += 8; }

  // --- Location & Campus Coordinate Proximity (15 pts) ---
  const lLoc = norm(l.location), fLoc = norm(f.location);
  if (lLoc && lLoc === fLoc) { score += 15; reasons.push('same location'); }
  else if (lLoc && fLoc) {
    const distM = locationDistanceMeters(lLoc, fLoc);
    if (distM <= 150) {
      score += 8;
      reasons.push('nearby campus area');
    } else {
      const shared = lLoc.split(' ').filter(w => w.length > 3 && fLoc.includes(w)).length;
      if (shared > 0) score += Math.min(7, shared * 4);
    }
  }

  // --- Description + imageClues keyword overlap (up to 10 pts) ---
  const lText = `${l.title} ${l.description} ${l.imageClues}`;
  const fText = `${f.title} ${f.description} ${f.imageClues}`;
  const sharedWords = countSharedWords(lText, fText);
  if (sharedWords > 0) {
    const pts = Math.min(10, sharedWords * 3);
    score += pts;
    if (sharedWords >= 2) reasons.push('matching details');
  }

  // --- Photo availability & visual hash similarity (up to 20 pts) ---
  if (l.photoUri && f.photoUri && l.photoUri !== 'demo-uri' && f.photoUri !== 'demo-uri') {
    score += 5;
  }
  if (l.photoHash && f.photoHash && l.photoHash !== '' && f.photoHash !== '') {
    const dist = hammingDistance(l.photoHash, f.photoHash);
    if (dist <= 10) {
      score += 15;
      reasons.push('visual photo match');
    } else if (dist <= 16) {
      score += 8;
      reasons.push('similar photo');
    }
  }

  // --- Date proximity (within 3 days) ---
  if (l.date && f.date) {
    const diff = Math.abs(new Date(l.date) - new Date(f.date)) / 86400000;
    if (diff <= 3) { score += 3; }
  }

  return { score: Math.min(100, score), reasons };
}

function countSharedWords(a, b) {
  const setB = new Set(norm(b).split(/\s+/).filter(w => w.length > 2));
  return norm(a).split(/\s+/).filter(w => w.length > 2 && setB.has(w)).length;
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
  const myEm = normEmail(u.email);
  const myReports = state.reports.filter(r => normEmail(r.ownerEmail) === myEm);
  const myMatches = state.matches.filter(m => normEmail(m.lost.ownerEmail) === myEm || normEmail(m.found.ownerEmail) === myEm);
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

  if (account.phone) {
    $('#authPhone').value = account.phone;
  }
  if (account.branch) {
    $('#authBranch').value = account.branch;
  }
  if (account.semester) {
    $('#authSemester').value = account.semester;
  }

  // Mobile verification required before entering home page
  state.otp = { code: null, phone: null, expiresAt: 0, verified: false, timer: null };
  const sendBtn = $('#sendOtpBtn');
  if (sendBtn) {
    sendBtn.textContent = 'Verify Mobile';
    sendBtn.classList.remove('verified');
    sendBtn.disabled = false;
  }
  const phoneInp = $('#authPhone');
  if (phoneInp) phoneInp.readOnly = false;
  $('#phoneVerifiedTag')?.classList.add('hidden');

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
    sendBtn.textContent = 'Verify Mobile';
    sendBtn.classList.remove('verified');
    sendBtn.disabled = false;
  }
  const phoneInp = $('#authPhone');
  if (phoneInp) phoneInp.readOnly = false;
  $('#phoneVerifiedTag')?.classList.add('hidden');
}

// ============================================================
// 10B. DEVICE PHONE OTP VERIFICATION (30-SECOND TIMER)
// ============================================================
function showOtpStatus(msg, type = 'info') {
  const el = $('#otpSmsStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `otp-sms-status otp-status-${type}`;
  el.classList.remove('hidden');
}

function normalizeIndianPhone10(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);
  if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  if (clean.length > 10) clean = clean.slice(-10);
  return clean;
}

function getDevicePhoneNumber() {
  if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.getDevicePhoneNumber) {
    try {
      const p = window.LostLinkNative.getDevicePhoneNumber();
      if (p && p.length === 10) return p;
    } catch (e) {}
  }
  return '';
}

function showSimMismatchPopup(message, title = 'SIM Number Mismatch') {
  const modal = $('#simMismatchModal');
  if (modal) {
    const titleEl = $('#simMismatchTitle');
    const msgEl = $('#simMismatchMsg');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message || 'Enter the correct mobile number linked to the SIM in this device.';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  } else {
    alert(message || 'Enter the correct mobile number linked to the SIM in this device.');
  }
  toast(message || 'Enter the correct mobile number linked to the SIM in this device.', 'error');
}

function closeSimMismatchPopup() {
  const modal = $('#simMismatchModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  setTimeout(() => $('#authPhone')?.focus(), 150);
}

function openOtpModal(phone) {
  const clean = normalizeIndianPhone10(phone);

  // 1. Validate 10-digit Indian (+91) mobile number
  if (!PHONE_RE.test(clean)) {
    showSimMismatchPopup('Please enter a valid 10-digit Indian (+91) mobile number.', 'Invalid Mobile Number');
    return;
  }

  // Update input with clean 10-digit Indian mobile number
  const authPhoneInp = $('#authPhone');
  if (authPhoneInp && authPhoneInp.value.trim() !== clean) {
    authPhoneInp.value = clean;
  }

  // 2. On Android APK: verify directly against the active SIM / device-verified phone number
  if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.verifyDeviceSimPhone) {
    const sendBtn = $('#sendOtpBtn');
    if (sendBtn && !state.otp.verified) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Checking SIM...';
    }

    window.onNativeSimVerifyResult = function(res) {
      if (sendBtn && !state.otp.verified) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Verify Mobile';
      }
      if (res && res.ok) {
        launchOtpDisplayModal(res.phone || clean);
      } else {
        const msg = (res && res.message) ? res.message : 'Enter the correct mobile number linked to the SIM in this device.';
        const title = (res && res.code === 'NO_SIM') ? 'No Active SIM Found' : 'SIM Number Mismatch';
        showSimMismatchPopup(msg, title);
      }
    };

    try {
      window.LostLinkNative.verifyDeviceSimPhone(clean);
    } catch (e) {
      if (sendBtn && !state.otp.verified) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Verify Mobile';
      }
      showSimMismatchPopup('Could not access SIM verification on this device. Please try again.', 'Verification Error');
    }
    return;
  }

  // 3. On iPhone Safari / Web browser (browsers cannot access SIM hardware due to OS sandboxing)
  launchOtpDisplayModal(clean);
}

function launchOtpDisplayModal(clean) {
  // Generate 6-digit verification code valid for exactly 30 seconds
  const code = String(Math.floor(100000 + Math.random() * 900000));
  state.otp = {
    code: code,
    phone: clean,
    expiresAt: Date.now() + 30 * 1000,
    verified: false,
    timer: null
  };

  // 4. Update UI
  $('#otpTargetPhone').textContent = `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  $$('.otp-digit').forEach(inp => { inp.value = ''; inp.disabled = false; });
  
  const codeDisplay = $('#otpCodeNumber');
  if (codeDisplay) codeDisplay.textContent = code;

  const countdownDisplay = $('#otpCountdownDisplay');
  if (countdownDisplay) countdownDisplay.classList.remove('hidden');

  const expiryNotice = $('#otpExpiryNotice');
  if (expiryNotice) expiryNotice.classList.add('hidden');

  const secondsLeft = $('#otpSecondsLeft');
  if (secondsLeft) secondsLeft.textContent = '30';

  const directFillBtn = $('#otpDirectAutoFillBtn');
  if (directFillBtn) {
    directFillBtn.disabled = false;
    directFillBtn.onclick = () => {
      if (Date.now() > state.otp.expiresAt || !state.otp.code) {
        toast('Verification code expired. Please tap Resend Code.', 'error');
        return;
      }
      const digits = String(code).split('');
      $$('.otp-digit').forEach((inp, idx) => {
        inp.value = digits[idx] || '';
      });
      toast('Verification code filled! Confirming...', 'success');
      setTimeout(verifyEnteredOtp, 300);
    };
  }

  // 5. Open modal
  const modal = $('#otpModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // 6. Focus first digit
  setTimeout(() => {
    $('.otp-digit[data-idx="0"]')?.focus();
  }, 300);

  // 7. Start 30s countdown timer
  startOtpCountdownTimer(30);
}

function closeOtpModal() {
  const modal = $('#otpModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (state.otp.timer) clearInterval(state.otp.timer);
}

function startOtpCountdownTimer(seconds) {
  if (state.otp.timer) clearInterval(state.otp.timer);
  const timerText = $('#otpTimerText');
  const resendBtn = $('#otpResendBtn');
  const secondsLeft = $('#otpSecondsLeft');
  const countdownDisplay = $('#otpCountdownDisplay');
  const expiryNotice = $('#otpExpiryNotice');
  const codeDisplay = $('#otpCodeNumber');
  const directFillBtn = $('#otpDirectAutoFillBtn');

  if (timerText) timerText.classList.remove('hidden');
  if (resendBtn) resendBtn.classList.add('hidden');
  if (countdownDisplay) countdownDisplay.classList.remove('hidden');
  if (expiryNotice) expiryNotice.classList.add('hidden');

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((state.otp.expiresAt - Date.now()) / 1000));
    if (secondsLeft) secondsLeft.textContent = remaining;
    if (timerText) timerText.textContent = `Resend code in 0:${remaining < 10 ? '0' : ''}${remaining}`;

    if (remaining <= 0) {
      clearInterval(state.otp.timer);
      state.otp.timer = null;
      state.otp.code = null; // Expire the code
      if (codeDisplay) codeDisplay.textContent = '------';
      if (countdownDisplay) countdownDisplay.classList.add('hidden');
      if (expiryNotice) expiryNotice.classList.remove('hidden');
      if (directFillBtn) directFillBtn.disabled = true;
      if (timerText) timerText.classList.add('hidden');
      if (resendBtn) resendBtn.classList.remove('hidden');
      toast('Verification code expired. Please tap Resend Code.', 'info');
    }
  };

  tick();
  state.otp.timer = setInterval(tick, 250);
}

async function verifyEnteredOtp() {
  const entered = $$('.otp-digit').map(inp => inp.value.trim()).join('');
  if (entered.length < 6) {
    toast('Please enter the complete 6-digit verification code', 'error');
    return;
  }

  if (Date.now() > state.otp.expiresAt || !state.otp.code) {
    toast('Verification code expired. Please tap Resend Code.', 'error');
    return;
  }

  // Verify strictly against session 30-second OTP code
  if (entered === state.otp.code) {
    state.otp.verified = true;
    if (state.otp.timer) clearInterval(state.otp.timer);
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
    toast('Mobile number verified successfully! ✔', 'success');
  } else {
    toast('Incorrect verification code. Please enter the 6-digit code shown above.', 'error');
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
      if (val.length > 1) {
        // Handle iOS Safari QuickType / multi-digit paste directly into box
        val.split('').forEach((ch, offset) => {
          if (idx + offset < digits.length) digits[idx + offset].value = ch;
        });
        const nextIdx = Math.min(idx + val.length, digits.length - 1);
        digits[nextIdx].focus();
      } else {
        inp.value = val ? val[0] : '';
        if (val && idx < digits.length - 1) {
          digits[idx + 1].focus();
        }
      }
      // If all 6 digits filled, auto-verify
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
  const cleanPhone = normalizeIndianPhone10($('#authPhone').value);
  const user = {
    name:          $('#authName').value.trim(),
    email:         $('#authEmail').value.trim().toLowerCase(),
    phone:         cleanPhone,
    phoneVerified: state.otp.verified && state.otp.phone === cleanPhone,
    branch:        $('#authBranch').value.trim(),
    semester:      $('#authSemester').value,
    photoUrl:      state.tempGooglePhoto || '',
    createdAt:     Date.now()
  };

  if (!user.name)     { toast('Please enter your full name','error'); return; }
  if (!RVU_EMAIL_RE.test(user.email)) { toast('Only @rvu.edu.in emails accepted','error'); return; }
  if (!PHONE_RE.test(user.phone))    { toast('Enter a valid 10-digit mobile number','error'); return; }
  
  if (!state.otp.verified || state.otp.phone !== user.phone) {
    toast('Please verify your mobile number first', 'error');
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

    setAuthLoading(false);
    if (existingUser && existingUser.email) {
      showNewUserRegistration({
        email,
        name: name || existingUser.name,
        photoUrl: photoUrl || existingUser.photoUrl || '',
        phone: existingUser.phone || '',
        branch: existingUser.branch || '',
        semester: existingUser.semester || ''
      });
      toast(`Google ID verified! Please verify your device mobile number.`, 'info');
    } else {
      showNewUserRegistration({ email, name, photoUrl });
      toast('Google ID verified! Complete profile setup and verify mobile number.', 'info');
    }
  } catch (err) {
    console.error('User lookup error:', err);
    setAuthLoading(false);
    const local = loadUser();
    if (local && local.email === email) {
      showNewUserRegistration({
        email,
        name: name || local.name,
        photoUrl: photoUrl || local.photoUrl || '',
        phone: local.phone || '',
        branch: local.branch || '',
        semester: local.semester || ''
      });
      toast('Google ID verified! Please verify your device mobile number.', 'info');
    } else {
      showNewUserRegistration({ email, name, photoUrl });
    }
  }
};

window.onNativePhotoSelected = async (uri) => {
  if (!uri) return;
  const compressed = await compressImageDataUrl(uri, 640, 0.68);
  state.selectedPhoto = compressed;
  photoUriToHash(compressed).then(hash => {
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
  state.selectedPhotoHash = '';
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
  state.selectedPhotoHash = '';
  closeReportSheet();
  refreshAll();
  updateNotifBadge();

  // Trigger instant in-app AI Match Pop-Up if this report matches any existing report!
  checkAndPopupNewMatches();

  const myEm = normEmail(data.ownerEmail);
  const myMatches = state.matches.filter(m =>
    normEmail(m.lost.ownerEmail) === myEm || normEmail(m.found.ownerEmail) === myEm
  );
  if (result.offlineQueued) {
    toast('Saved locally — will upload to cloud database automatically when online.', 'info');
  } else {
    toast(myMatches.length > 0
      ? `🎯 Report published! AI found ${myMatches.length} potential match${myMatches.length > 1 ? 'es' : ''}!`
      : '✅ Report uploaded to cloud database!',
      'success');
  }
}

// ============================================================
// 13. RENDER — Dashboard (Home)
// ============================================================
function renderDashboard() {
  if (!state.user) return;
  const myEmail = normEmail(state.user.email);
  const r = state.reports.filter(x => normEmail(x.ownerEmail) === myEmail);
  const myMatches = state.matches.filter(m => normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail);

  animNum('lostCount',    r.filter(x => (x.type || '').toUpperCase() === 'LOST'  && (!x.status || x.status.toUpperCase() === 'OPEN')).length);
  animNum('foundCount',   r.filter(x => (x.type || '').toUpperCase() === 'FOUND' && (!x.status || x.status.toUpperCase() === 'OPEN')).length);
  animNum('matchCount',   myMatches.length);
  animNum('returnedCount',r.filter(x => (x.status || '').toUpperCase() === 'RETURNED').length);

  const recent = state.reports.slice(0, 5);
  $('#recentReports').innerHTML = recent.length
    ? recent.map(reportCardHTML).join('')
    : emptyHTML('🔍','No reports yet','Be the first to report a lost or found item!');
}

// ============================================================
// 14. RENDER — All Reports
// ============================================================
function renderAllReports() {
  if (!state.user) return;
  const f = state.activeFilter;
  const list = f==='ALL' ? state.reports : state.reports.filter(r=>r.type===f);
  $('#allReports').innerHTML = list.length
    ? list.map(reportCardHTML).join('')
    : emptyHTML('📋','No reports','Submit a report or try a different filter.');
}

// ============================================================
// 15. RENDER — AI Matches
// ============================================================
function renderMatches() {
  if (!state.user) return;
  const myEmail = normEmail(state.user.email);
  const myMatches = state.matches.filter(m => normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail);
  $('#matchList').innerHTML = myMatches.length
    ? myMatches.map(matchCardHTML).join('')
    : emptyHTML('✨','No matches yet','Submit both a lost and found report with similar details to see AI suggestions.');
}

// ============================================================
// 16. RENDER — Notifications (contact details for current user)
// ============================================================
function renderNotifications() {
  if (!state.user) return;

  const myEmail = normEmail(state.user.email);
  const clearedIds = getClearedNotifIds();
  const myMatches = state.matches.filter(m => 
    (normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail) && 
    !clearedIds.includes(matchId(m))
  );

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
    const iAmLost  = normEmail(m.lost.ownerEmail)  === myEmail;
    const iAmFound = normEmail(m.found.ownerEmail) === myEmail;
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
  const myEmail = normEmail(state.user.email);
  const seenIds = getSeenIds();
  const clearedIds = getClearedNotifIds();
  const myMatches = state.matches.filter(m => (normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail) && !clearedIds.includes(matchId(m)));
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
    const totalMyMatches = state.matches.filter(m => normEmail(m.lost.ownerEmail) === myEmail || normEmail(m.found.ownerEmail) === myEmail).length;
    matchesBadge.textContent = totalMyMatches;
    matchesBadge.classList.toggle('hidden', totalMyMatches === 0);
  }

  // Home Screen Match Alert Banner
  const banner = $('#homeMatchBanner');
  const bannerText = $('#homeMatchBannerText');
  if (banner) {
    if (myMatches.length > 0) {
      const topMatch = myMatches[0];
      const iAmLost = normEmail(topMatch.lost.ownerEmail) === myEmail;
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
  const myEmail = normEmail(state.user.email);
  const mine = state.reports.filter(r=>normEmail(r.ownerEmail)===myEmail);
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

  // Device SIM & OTP Verification
  $('#sendOtpBtn')?.addEventListener('click', () => openOtpModal($('#authPhone').value.trim()));
  $('#otpCancelBtn')?.addEventListener('click', closeOtpModal);
  $('#otpVerifyBtn')?.addEventListener('click', verifyEnteredOtp);
  $('#otpResendBtn')?.addEventListener('click', () => openOtpModal(state.otp.phone || $('#authPhone').value.trim()));
  $('#otpModal')?.addEventListener('click', (e) => { if (e.target === $('#otpModal')) closeOtpModal(); });
  $('#simMismatchOkBtn')?.addEventListener('click', closeSimMismatchPopup);
  $('#simMismatchModal')?.addEventListener('click', (e) => { if (e.target === $('#simMismatchModal')) closeSimMismatchPopup(); });
  $('#matchPopupCloseBtn')?.addEventListener('click', closeMatchPopup);
  $('#matchPopupViewAllBtn')?.addEventListener('click', () => { closeMatchPopup(); navigate('notifications'); });
  $('#matchPopupModal')?.addEventListener('click', (e) => { if (e.target === $('#matchPopupModal')) closeMatchPopup(); });
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

  // Direct In-App Update checker
  $('#checkUpdatesBtn')?.addEventListener('click', () => checkAppUpdates(true));
  $('#appUpdateLaterBtn')?.addEventListener('click', closeAppUpdateModal);
  $('#appUpdateModal')?.addEventListener('click', (e) => { if (e.target === $('#appUpdateModal')) closeAppUpdateModal(); });
}

const CLIENT_VERSION_CODE = 11;
const CLIENT_VERSION_NAME = '1.1.9';
const VERSION_CHECK_URL   = 'https://dheeraj-0809.github.io/Lost-and-found-/version.json';

let _pendingUpdateInfo = null;

function closeAppUpdateModal() {
  const modal = $('#appUpdateModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function showAppUpdateModal(remote) {
  _pendingUpdateInfo = remote;
  const modal = $('#appUpdateModal');
  if (!modal) return;
  const titleEl = $('#appUpdateTitle');
  const notesEl = $('#appUpdateNotes');
  const progWrap = $('#appUpdateProgressWrap');
  const nowBtn = $('#appUpdateNowBtn');

  if (titleEl) titleEl.textContent = `Update Ready (v${remote.versionName})`;
  if (notesEl) notesEl.textContent = remote.notes || 'A newer version of LostLink AI is ready to install directly.';
  if (progWrap) progWrap.classList.add('hidden');
  if (nowBtn) {
    nowBtn.disabled = false;
    nowBtn.textContent = isNativeAvailable() ? 'Update Now (In-App)' : 'Refresh to Update';
    nowBtn.onclick = startAppUpdate;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

async function startAppUpdate() {
  if (!_pendingUpdateInfo) return;
  const nowBtn = $('#appUpdateNowBtn');
  const progWrap = $('#appUpdateProgressWrap');
  const progBar = $('#appUpdateProgressBar');
  const progText = $('#appUpdateProgressText');

  if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.downloadAndInstallUpdate) {
    if (nowBtn) { nowBtn.disabled = true; nowBtn.textContent = 'Updating...'; }
    if (progWrap) progWrap.classList.remove('hidden');
    if (progBar) progBar.style.width = '5%';
    if (progText) progText.textContent = 'Downloading update... 0%';

    window.onAppUpdateProgress = (pct) => {
      if (progBar) progBar.style.width = `${pct}%`;
      if (progText) progText.textContent = `Downloading update... ${pct}%`;
    };

    window.onAppUpdateComplete = (ok, errMsg) => {
      if (ok) {
        if (progText) progText.textContent = 'Opening Android installer... Tap Update!';
        setTimeout(closeAppUpdateModal, 1500);
      } else {
        if (nowBtn) { nowBtn.disabled = false; nowBtn.textContent = 'Update Now (In-App)'; }
        if (errMsg === 'PERMISSION_NEEDED') {
          toast("Enable 'Allow from this source' in Settings, then tap Update Now again.", 'info');
          if (progText) progText.textContent = 'Permission needed: Allow install from LostLink AI, then tap Update Now.';
        } else {
          toast(errMsg || 'Could not download update. Try again.', 'error');
          if (progWrap) progWrap.classList.add('hidden');
        }
      }
    };

    const apkUrl = _pendingUpdateInfo.apkUrl || 'https://dheeraj-0809.github.io/Lost-and-found-/LostLink-AI.apk';
    window.LostLinkNative.downloadAndInstallUpdate(apkUrl);
  } else {
    // iPhone Safari / PWA: clear old caches and reload straight from GitHub Pages
    if (nowBtn) { nowBtn.disabled = true; nowBtn.textContent = 'Refreshing...'; }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => {})));
      }
    } catch {}
    window.location.reload();
  }
}

async function checkAppUpdates(manual = false) {
  const lbl = $('#appVersionLabel');
  let localCode = CLIENT_VERSION_CODE;
  let localName = CLIENT_VERSION_NAME;
  if (isNativeAvailable() && window.LostLinkNative && window.LostLinkNative.getAppVersionCode) {
    try {
      localCode = Number(window.LostLinkNative.getAppVersionCode()) || CLIENT_VERSION_CODE;
      localName = (window.LostLinkNative.getAppVersionName && window.LostLinkNative.getAppVersionName()) || CLIENT_VERSION_NAME;
    } catch {}
  }
  if (lbl) lbl.textContent = `v${localName}`;

  if (manual) toast('Checking for updates...', 'info');
  try {
    const res = await fetchWithTimeout(`${VERSION_CHECK_URL}?t=${Date.now()}`, { method: 'GET', cache: 'no-store' }, 10000);
    if (!res.ok) {
      if (manual) toast(`You are on v${localName}`, 'info');
      return;
    }
    const remote = await res.json();
    if (remote && Number(remote.versionCode) > localCode) {
      showAppUpdateModal(remote);
    } else if (manual) {
      toast(`LostLink AI is up to date (v${localName}) ✔`, 'success');
    }
  } catch {
    if (manual) toast('Could not check updates offline.', 'info');
  }
}

window.handleOAuthHash = async function(hashStr) {
  if (!hashStr || !hashStr.includes('access_token=')) return;
  try {
    const cleanHash = hashStr.startsWith('#') ? hashStr.substring(1) : hashStr;
    const hashParams = new URLSearchParams(cleanHash);
    const accessToken = hashParams.get('access_token');
    const oauthState = hashParams.get('state');

    // If Google OAuth was initiated from inside the Android APK via Chrome, bounce back into the APK!
    if (oauthState === 'native_apk' && !isNativeAvailable()) {
      const deepLinkUrl = `lostlink://auth#${cleanHash}`;
      const authCard = $('#authPrimaryView');
      if (authCard) {
        authCard.innerHTML = `
          <div style="text-align:center; padding:24px 12px;">
            <div style="font-size:38px; margin-bottom:10px;">📲</div>
            <h3 style="color:#F8FAFC; margin:0 0 8px;">Returning to LostLink AI App...</h3>
            <p style="color:#94A3B8; font-size:13px; margin:0 0 18px;">Google verification complete! Tap below if the LostLink app does not open automatically.</p>
            <a href="${deepLinkUrl}" style="display:inline-block; background:#2563EB; color:#FFF; padding:12px 22px; border-radius:12px; font-weight:800; text-decoration:none; font-size:14px;">Open LostLink AI App →</a>
          </div>`;
      }
      window.location.replace(deepLinkUrl);
      return;
    }

    if (accessToken) {
      if (window.location.hash) {
        try { window.history.replaceState(null, '', window.location.pathname); } catch {}
      }
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
    setAuthLoading(false);
    console.error('OAuth redirect token error:', e);
  }
};

// ============================================================
// 25. INIT
// ============================================================
async function init() {
  // Purge outdated service worker caches for instant updates on iPhone Safari & Web
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const k of keys) {
        if (k !== 'lostlink-v9-network-first') await caches.delete(k);
      }
    } catch (e) {}
  }

  state.user = loadUser();
  state.reports = localGetReports();
  state.matches = computeMatches(state.reports);
  populateLocationDropdown();
  bindEvents();
  $('#eventDate').value = localDate();
  renderAuthState();

  // Set version badge & check quietly for direct updates
  setTimeout(() => checkAppUpdates(false), 3000);

  // Handle Google OAuth 2.0 Web/APK redirect tokens AFTER UI & events are bound
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    await window.handleOAuthHash(window.location.hash);
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      window.handleOAuthHash(window.location.hash);
    }
  });

  window.addEventListener('online', () => {
    if (state.user) {
      updateSyncStatus('Syncing...');
      syncReports().then(() => refreshAll());
    }
  });

  if (state.user) {
    refreshAll();
    startSync();
  }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// 26. PWA INSTALLATION & SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=9.0').catch(() => {});
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



















