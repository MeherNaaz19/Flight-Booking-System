/* SkyWay v3 — app.js */
//Generate a complete frontend JavaScript code for a flight booking management system called "SkyWay". The code should include the following features:
//1. booking details page that displays information about a specific flight booking, including route details, passenger information, fare breakdown, and booking status.
//2. web check-in page that allows users to check in for their flight online, providing necessary details and generating a boarding pass upon successful check-in and also ock payment with upi or card.
//3. user profile page where users can view and update their personal information, change their password, and access quick links to their bookings and the home page.
//4. Authentication functionality with login and registration pages, including OTP-based login and registration options.
//5. dialogs for confirming booking cancellations and rescheduling, with appropriate messages and actions.
// 6. Admin panel with features to view all bookings, manage flight status updates, send notifications to users, and view revenue reports.
// ── State ─────────────────────────────────────────────────
const S = {
  user:null, page:'home', flights:[], returnFlights:[],
  sp:{origin:'DEL',dest:'BOM',date:'',returnDate:'',pax:1,tripType:'one-way',searched:false},
  selFlight:null, selCabin:'economy', selSeat:null, seatAdd:0,
  selMeal:'none', selSvc:'none', mealOptions:[], svcOptions:[],
  bookingId:null, currentBk:null,
  // admin
  adminTab:'dashboard', adminFlightId:'', adminSeatCabin:'economy',
};

const AIRPORTS = {
  DEL:{city:'New Delhi',name:'Indira Gandhi Intl'},
  BOM:{city:'Mumbai',name:'Chhatrapati Shivaji Intl'},
  MAA:{city:'Chennai',name:'Chennai International'},
  BLR:{city:'Bengaluru',name:'Kempegowda International'},
  CCU:{city:'Kolkata',name:'Netaji Subhas Chandra Bose'},
  HYD:{city:'Hyderabad',name:'Rajiv Gandhi International'},
  COK:{city:'Kochi',name:'Cochin International'},
  PNQ:{city:'Pune',name:'Pune Airport'},
  DXB:{city:'Dubai',name:'Dubai International'},
  SIN:{city:'Singapore',name:'Changi Airport'},
  LHR:{city:'London',name:'Heathrow Airport'},
  JFK:{city:'New York',name:'John F. Kennedy Intl'},
};

// ── API ───────────────────────────────────────────────────
async function api(method,path,body){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(body) opts.body=JSON.stringify(body);
  try{ const r=await fetch(path,opts); return await r.json(); }
  catch(e){ return{ok:false,error:'Network error: '+e.message}; }
}
const GET =(p)=>api('GET',p);
const POST=(p,b)=>api('POST',p,b);

// ── Toast ─────────────────────────────────────────────────
function toast(msg,type='info',dur=3500){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className=`toast toast-${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>t.remove(),dur);
}

// ── Modal ─────────────────────────────────────────────────
function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }
//Handle page navigation, update state, highlight active menu, and re-render UI based on the current page. Also scrolls to top on navigation.
// ── Nav ───────────────────────────────────────────────────
function nav(page,extra={}){
  S.page=page; Object.assign(S,extra);
  ['home','bookings','admin'].forEach(k=>{
    const el=document.getElementById('nl-'+k);
    if(el) el.classList.toggle('active',
      k===page||(k==='bookings'&&['booking','checkin'].includes(page))||(k==='admin'&&page==='admin'));
  });
  render(); window.scrollTo(0,0);
}
//Dynamically update navbar UI based on login state (show profile or login button) and render different pages (home, login, register, profile, bookings, booking details, book page, check-in) with appropriate content and functionality. Also includes flight search and selection logic on the home page.
function updateNav(){
  const el=document.getElementById('nav-right');
  const links=document.getElementById('nav-links');
  if(!el||!links) return;
  if(S.user){
    const isAdmin=S.user.role==='admin';
    // Admin gets an admin nav link
    let adminLink='';
    if(isAdmin) adminLink=`<div class="nav-link admin-link" id="nl-admin" onclick="nav('admin')">⚙ Admin Panel</div>`;
    links.innerHTML=`
      <div class="nav-link" id="nl-home" onclick="nav('home')">✈ Search</div>
      ${!isAdmin?`<div class="nav-link" id="nl-bookings" onclick="nav('bookings')">📋 My Bookings</div>`:''}
      ${adminLink}`;
    el.innerHTML=`
      <div class="nav-avatar ${isAdmin?'admin':''}" onclick="nav('profile')" title="${S.user.name}">${S.user.name.charAt(0).toUpperCase()}</div>
      <span class="nav-name">${S.user.name.split(' ')[0]}${isAdmin?' 👑':''}</span>
      <button class="btn-nav-out" onclick="doLogout()">Sign Out</button>`;
    // Re-apply active
    ['home','bookings','admin'].forEach(k=>{
      const e=document.getElementById('nl-'+k);
      if(e) e.classList.toggle('active',k===S.page);
    });
  } else {
    links.innerHTML=`
      <div class="nav-link" id="nl-home" onclick="nav('home')">✈ Search</div>
      <div class="nav-link" id="nl-bookings" onclick="nav('login')">📋 My Bookings</div>`;
    el.innerHTML=`<div class="btn-nav-in" onclick="nav('login')">Sign In</div>`;
  }
}

// ── Render ────────────────────────────────────────────────
function render(){
  const app=document.getElementById('app');
  switch(S.page){
    case 'home':     app.innerHTML=renderHome();     bindHome(); break;
    case 'login':    app.innerHTML=renderLogin();    break;
    case 'register': app.innerHTML=renderRegister(); break;
    case 'profile':  renderProfile(app); break;
    case 'bookings': renderBookings(app); break;
    case 'booking':  renderBookingDetail(app); break;
    case 'book':     renderBookPage(app); break;
    case 'checkin':  renderCheckin(app); break;
    case 'admin':    renderAdmin(app); break;
    default: app.innerHTML='<div class="page"><h2>404</h2></div>';
  }
}
//Generate homepage UI including search form, trip type, and flight results display
// HOME
function renderHome(){
  const sp=S.sp; const today=new Date().toISOString().slice(0,10);
  const aOpts=code=>Object.entries(AIRPORTS).map(([k,v])=>`<option value="${k}" ${k===code?'selected':''}>${k} — ${v.city}</option>`).join('');
  const pOpts=[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n==sp.pax?'selected':''}>${n} Passenger${n>1?'s':''}</option>`).join('');
  const isRt=sp.tripType==='round';

  const flightHTML=sp.searched?(S.flights.length?`
    <div class="results-hdr">
      <div><div class="results-title">Available Flights</div>
      <div class="results-sub">${S.flights.length} flight${S.flights.length!==1?'s':''} · ${sp.origin} → ${sp.dest} · ${sp.date}</div></div>
    </div>${renderFlightCards(S.flights,false)}`
    :`<div class="empty"><div class="empty-icon">😔</div><div class="empty-title">No flights found</div><div class="empty-desc">Try a different route or date</div></div>`):'';

  const retHTML=(isRt&&sp.searched&&S.returnFlights.length)?`
    <div class="results-hdr mt-3"><div>
      <div class="results-title">Return Flights</div>
      <div class="results-sub">${S.returnFlights.length} flights · ${sp.dest} → ${sp.origin} · ${sp.returnDate}</div>
    </div></div>${renderFlightCards(S.returnFlights,true)}`:'';

  return `
  <div class="page">
    <div class="hero mb-4">
      <div class="hero-dots"></div><div class="hero-plane">✈</div>
      <h1>Book Your Next<br><em>Flight with SkyWay</em></h1>
      <p>Search 100+ routes · Best fares guaranteed · Cancel anytime</p>
      <div class="hero-stats">
        <div><div class="hs-val">12</div><div class="hs-lbl">Airports</div></div>
        <div><div class="hs-val">6</div><div class="hs-lbl">Airlines</div></div>
        <div><div class="hs-val">50+</div><div class="hs-lbl">Daily Routes</div></div>
        <div><div class="hs-val">100%</div><div class="hs-lbl">Secure</div></div>
      </div>
    </div>
    <div class="airline-strip mb-4">
      ${[['#1a56db','✈','IndiGo','India\'s #1'],['#c0392b','🛫','Air India','The Maharaja'],
         ['#e84118','🌶','SpiceJet','Low Fares'],['#6c3483','💜','Vistara','Full Service'],
         ['#c0392b','🌍','Emirates','Fly the World'],['#1e3799','🔵','AI Express','Budget']]
        .map(([bg,ic,nm,sl])=>`<div class="al-card"><div class="al-icon" style="background:${bg}20">${ic}</div><div><div class="al-name">${nm}</div><div class="al-sub">${sl}</div></div></div>`).join('')}
    </div>
    <div class="search-card">
      <div class="trip-tabs">
        <button class="trip-tab ${!isRt?'active':''}" onclick="setTripType('one-way')">✈ One Way</button>
        <button class="trip-tab ${isRt?'active':''}" onclick="setTripType('round')">↔ Round Trip</button>
      </div>
      <div class="${isRt?'search-row-rt':'search-row'}">
        <div class="field"><div class="field-label">From</div><select class="field-inp" id="s-origin">${aOpts(sp.origin)}</select></div>
        <button class="swap-btn" onclick="swapAP()" title="Swap">⇄</button>
        <div class="field"><div class="field-label">To</div><select class="field-inp" id="s-dest">${aOpts(sp.dest)}</select></div>
        <div class="field"><div class="field-label">Departure Date</div><input type="date" class="field-inp" id="s-date" value="${sp.date||today}" min="${today}"></div>
        ${isRt?`<div class="field"><div class="field-label">Return Date</div><input type="date" class="field-inp" id="s-return" value="${sp.returnDate||''}" min="${today}"></div>`:''}
        <div class="field"><div class="field-label">Passengers</div><select class="field-inp" id="s-pax">${pOpts}</select></div>
      </div>
      <div style="text-align:right;margin-top:1rem"><button class="btn-search" onclick="doSearch()">🔍 Search Flights</button></div>
    </div>
    ${flightHTML}${retHTML}
    ${!S.user?`<div class="alert alert-info mt-2"><span class="alert-icon">💡</span><span><a href="#" onclick="nav('login')" style="color:var(--sky-d);font-weight:700">Sign in</a> to book flights and manage your bookings.</span></div>`:''}
  </div>`;
}
// Display list of available flights with pricing, duration, and cabin selection options. Also handles flight selection and navigation to booking page.
function renderFlightCards(flights,isReturn){
  return flights.map(f=>{
    const dh=Math.floor(f.duration/60),dm=f.duration%60;
    const cabHTML=['economy','business','first'].filter(c=>f.prices[c]&&f.seats[c]>0).map(c=>`
      <div class="cabin-row" onclick="selectFlight('${f.id}','${c}',${isReturn})">
        <div><div class="c-lbl">${c.toUpperCase()}</div><div class="c-seats">${f.seats[c]} left</div></div>
        <div class="c-price">₹${f.prices[c].toLocaleString('en-IN')}</div>
      </div>`).join('');
    const delayTag=f.delay_min>0?`<span class="fc-tag t-delay">⏰ +${f.delay_min}min delay</span>`:'';
    const cancelTag=f.admin_status==='cancelled'?`<span class="fc-tag t-cancelled-flight">❌ Flight Cancelled</span>`:'';
    return `
    <div class="flight-card">
      <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${f.airline_color};border-radius:4px 0 0 4px"></div>
      <div class="fc-top">
        <div class="al-chip"><div class="al-dot" style="background:${f.airline_color}">${f.airline}</div>
          <span class="al-chip-name">${f.airline_name}</span><span class="al-chip-num">${f.number}</span></div>
        <span class="fc-tag ${f.refundable?'t-ref':'t-nref'}">${f.refundable?'✓ Refundable':'Non-refundable'}</span>
        <span class="fc-tag ${f.stops===0?'t-ns':'t-stop'}">${f.stops===0?'Non-stop':f.stops+' stop'}</span>
        ${f.meals_avail?'<span class="fc-tag t-meal">🍽 Meals</span>':''}
        ${delayTag}${cancelTag}
      </div>
      <div class="fc-route">
        <div><div class="fc-time">${f.dep}</div><div class="fc-apt">${f.origin} · ${(AIRPORTS[f.origin]||{}).city||''}</div></div>
        <div class="fc-mid"><div class="fc-dur">${dh}h ${dm}m</div><div class="fc-line"></div></div>
        <div><div class="fc-time">${f.arr}${f.next_day?'<span class="fc-nd">+1</span>':''}</div>
          <div class="fc-apt">${f.dest} · ${(AIRPORTS[f.dest]||{}).city||''}</div>
          <div class="fc-cabins" style="margin-top:.5rem">${cabHTML}</div></div>
      </div>
      <div class="fc-footer"><span class="fc-bag">🧳 ${f.baggage.economy} (Eco) · ${f.baggage.business} (Biz)</span></div>
      ${f.status_msg?`<div style="margin-top:.5rem;font-size:.78rem;color:#92400e;background:#fef3c7;padding:.35rem .65rem;border-radius:var(--r1)">ℹ️ ${f.status_msg}</div>`:''}
    </div>`;
  }).join('');
}

function bindHome(){}
//Toggle between one-way and round-trip flight search
function setTripType(t){ S.sp.tripType=t; render(); }
//Swap origin and destination airport values in search form
function swapAP(){ const o=document.getElementById('s-origin'),d=document.getElementById('s-dest'); if(o&&d){const t=o.value;o.value=d.value;d.value=t;} }
//Validate inputs, call flight API, and store search results (one-way or round-trip)
async function doSearch(){
  const origin=document.getElementById('s-origin')?.value;
  const dest=document.getElementById('s-dest')?.value;
  const date=document.getElementById('s-date')?.value;
  const pax=parseInt(document.getElementById('s-pax')?.value||'1');
  const ret=document.getElementById('s-return')?.value||'';
  const isRt=S.sp.tripType==='round';
  if(!date){toast('Please select a departure date','warning');return;}
  if(origin===dest){toast('Origin and destination cannot be the same','warning');return;}
  if(isRt&&!ret){toast('Please select a return date','warning');return;}
  if(isRt&&ret<=date){toast('Return date must be after departure date','warning');return;}
  S.sp={...S.sp,origin,dest,date,pax,returnDate:ret,searched:true};
  S.flights=await fetch(`/api/flights?origin=${origin}&dest=${dest}&date=${date}`).then(r=>r.json());
  S.returnFlights=isRt&&ret?await fetch(`/api/flights?origin=${dest}&dest=${origin}&date=${ret}`).then(r=>r.json()):[];
  render();
}
//Select a flight and cabin, initialize booking state, and navigate to booking page
function selectFlight(flightId,cabin,isReturn){
  if(!S.user){nav('login');return;}
  const list=isReturn?S.returnFlights:S.flights;
  const f=list.find(fl=>fl.id===flightId);
  if(!f){toast('Flight not found','danger');return;}
  S.selFlight=f; S.selCabin=cabin; S.selSeat=null; S.seatAdd=0;
  S.selMeal='none'; S.selSvc='none';
  nav('book');
}
//Render booking page with passenger details, seat selection, meals, and price summary
// BOOK PAGE
async function renderBookPage(app){
  const f=S.selFlight,cabin=S.selCabin;
  if(!f){nav('home');return;}
  app.innerHTML='<div class="page"><div class="spinner"></div></div>';
  const [seatData,mealData,svcData]=await Promise.all([
    fetch(`/api/seat-map?flight_id=${encodeURIComponent(f.id)}&cabin=${cabin}`).then(r=>r.json()),
    fetch(`/api/meal-options?cabin=${cabin}`).then(r=>r.json()),
    fetch('/api/special-services').then(r=>r.json()),
  ]);
  S.mealOptions=mealData; S.svcOptions=svcData;
  const pax=S.sp.pax||1; const baseP=f.prices[cabin]; const taxes=Math.round(baseP*.12);
  const durH=Math.floor(f.duration/60),durM=f.duration%60;
  const paxForms=Array.from({length:pax},(_,i)=>`
    <div style="margin-bottom:1.4rem;padding-bottom:1.4rem;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;color:var(--t2);margin-bottom:.85rem;font-size:.9rem">Passenger ${i+1}</div>
      <div class="form-grid">
        <div><label class="form-label">First Name</label><input type="text" class="form-inp pf" placeholder="First name" required></div>
        <div><label class="form-label">Last Name</label><input type="text" class="form-inp pl" placeholder="Last name" required></div>
        <div><label class="form-label">Date of Birth</label><input type="date" class="form-inp pd"></div>
        <div><label class="form-label">Gender</label><select class="form-inp form-sel pg"><option>Male</option><option>Female</option><option>Other</option></select></div>
        <div class="form-full"><label class="form-label">Passport / Aadhaar (optional for domestic)</label><input type="text" class="form-inp pdoc" placeholder="Document number"></div>
      </div>
    </div>`).join('');
  const mealCards=mealData.map(m=>`
    <div class="meal-card ${m.id===S.selMeal?'sel':''}" onclick="pickMeal('${m.id}')">
      <div class="meal-name">${m.name}</div><div class="meal-desc">${m.desc}</div>
      <div class="meal-price ${m.price>0?'paid':''}">${m.price>0?'₹'+m.price.toLocaleString('en-IN')+' / person':'Complimentary'}</div>
    </div>`).join('');
  const svcCards=svcData.map(s=>`
    <div class="svc-card ${s.id===S.selSvc?'sel':''}" onclick="pickSvc('${s.id}',${s.price})">
      <span class="svc-name">${s.name}</span>
      <span class="svc-price ${s.price===0?'free':''}">${s.price===0?'Free':'₹'+s.price.toLocaleString('en-IN')}</span>
    </div>`).join('');

  app.innerHTML=`
  <div class="page">
    <div class="steps">
      <div class="step done"><div class="step-circle">✓</div><div class="step-lbl">Search</div></div>
      <div class="step-bar done"></div>
      <div class="step active"><div class="step-circle">2</div><div class="step-lbl">Details & Seat</div></div>
      <div class="step-bar"></div>
      <div class="step pending"><div class="step-circle">3</div><div class="step-lbl">Payment</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 330px;gap:1.5rem;align-items:start">
    <div>
      <div class="card mb-3">
        <div class="card-title">✈ Selected Flight</div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--s2);border-radius:var(--r1);padding:.9rem 1rem;border:1px solid var(--border)">
          <div><div style="font-size:1.2rem;font-weight:800;color:var(--navy)">${f.origin} → ${f.dest}</div>
          <div class="text-muted">${f.airline_name} · ${f.number} · ${f.dep}→${f.arr} · ${durH}h ${durM}m</div></div>
          <div style="text-align:right"><div style="font-size:1.1rem;font-weight:800;color:var(--navy)">₹${baseP.toLocaleString('en-IN')}</div>
          <div class="text-muted">${cabin.toUpperCase()} / person</div></div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-title">👤 Passenger Details</div>
        ${paxForms}
        <div>
          <div style="font-weight:700;color:var(--t2);margin-bottom:.75rem;font-size:.88rem">📧 Contact Information</div>
          <div class="form-grid">
            <div><label class="form-label">Email</label><input type="email" id="c-email" class="form-inp" value="${S.user?.email||''}" placeholder="you@example.com"></div>
            <div><label class="form-label">Phone</label><input type="tel" id="c-phone" class="form-inp" value="${S.user?.phone||''}" placeholder="+91 9876543210"></div>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-title">💺 Seat Selection <span class="badge badge-sky" style="font-size:.68rem">optional</span></div>
        <div class="alert alert-info mb-2"><span class="alert-icon">ℹ</span>🟢 Exit row (+₹600) · Yellow = Window (+₹250) · Click to select</div>
        <div class="seat-legend">
          <div class="leg-item"><div class="leg-box" style="background:var(--s2);border-color:var(--border)"></div>Available</div>
          <div class="leg-item"><div class="leg-box" style="background:var(--sky);border-color:var(--sky-d)"></div>Selected</div>
          <div class="leg-item"><div class="leg-box" style="background:var(--s3);border-color:var(--border)"></div>Occupied</div>
          <div class="leg-item"><div class="leg-box" style="background:#f0fdf4;border-color:var(--green)"></div>Exit (+₹600)</div>
          <div class="leg-item"><div class="leg-box" style="background:#fffbeb;border-color:#fbbf24"></div>Window (+₹250)</div>
        </div>
        ${buildSeatMap(seatData)}
        <div id="seat-info" style="display:none;margin-top:.75rem;padding:.7rem;background:var(--sky-bg);border-radius:var(--r1);font-size:.875rem;color:var(--sky-d);font-weight:500"></div>
      </div>
      <div class="card mb-3">
        <div class="card-title">🍽 Pre-book Meal
          <span class="badge ${cabin==='economy'?'badge-gold':'badge-sky'}">${cabin==='economy'?'Paid':'Complimentary'}</span>
        </div>
        ${cabin!=='economy'?'<div class="alert alert-success mb-2"><span class="alert-icon">✓</span>Business & First Class meals are complimentary</div>':''}
        <div class="meal-grid">${mealCards}</div>
      </div>
      <div class="card mb-3">
        <div class="card-title">⭐ Special Services</div>
        <div class="svc-grid">${svcCards}</div>
      </div>
    </div>
    <div>
      <div class="card" style="position:sticky;top:80px">
        <div class="card-title">💳 Price Breakdown</div>
        <div class="price-box mb-3">
          <div class="price-row"><span>Base fare (${pax}× ₹${baseP.toLocaleString('en-IN')})</span><span>₹${(baseP*pax).toLocaleString('en-IN')}</span></div>
          <div class="price-row"><span>Taxes &amp; fees (12%)</span><span>₹${(taxes*pax).toLocaleString('en-IN')}</span></div>
          <div class="price-row" id="pr-seat" style="display:none"><span>Seat fee</span><span id="pv-seat">₹0</span></div>
          <div class="price-row" id="pr-meal" style="display:none"><span>Meal pre-book</span><span id="pv-meal">₹0</span></div>
          <div class="price-row" id="pr-svc" style="display:none"><span>Special service</span><span id="pv-svc">₹0</span></div>
          <div class="price-total"><span>Total</span><span id="p-total">₹${((baseP+taxes)*pax).toLocaleString('en-IN')}</span></div>
        </div>
        <div class="alert ${f.refundable?'alert-success':'alert-warning'} mb-2">
          <span class="alert-icon">${f.refundable?'✓':'⚠'}</span>
          ${f.refundable?'Refundable fare':'Non-refundable fare'}
        </div>
        <button class="btn btn-primary btn-lg btn-full" onclick="doBook()">✅ Confirm &amp; Pay</button>
        <p class="text-muted mt-2" style="text-align:center;font-size:.73rem">By booking you agree to our Terms &amp; Cancellation Policy</p>
      </div>
    </div>
    </div>
  </div>`;
  window._bd={f,cabin,pax,baseP,taxes}; recalcPrice();
}
//Generate seat layout UI with availability, pricing, and seat types (window/exit)
function buildSeatMap(data){
  const{seats,config}=data; const cols=config.cols; const mid=Math.floor(cols.length/2);
  let html='<div class="seat-map-wrap"><div class="seat-grid">';
    // Column headers
  html+='<div class="seat-row"><div class="seat-rnum"></div>';
  for(let ci=0;ci<cols.length;ci++){
    if(ci===mid&&cols.length===6) html+='<div class="seat-gap"></div>';
    html+=`<div class="seat-chdr">${cols[ci]}</div>`;
  }
  html+='</div>';
  for(let r=1;r<=config.rows;r++){
    html+=`<div class="seat-row"><div class="seat-rnum">${r}</div>`;
    for(let ci=0;ci<cols.length;ci++){
      if(ci===mid&&cols.length===6) html+='<div class="seat-gap"></div>';
      const c=cols[ci],key=`${r}${c}`,s=seats[key]||{};
      let cls='seat';
      if(s.occupied) cls+=' socc'; else if(s.exit) cls+=' sexit'; else if(s.window) cls+=' swin';
      const add=s.price_add||0;
      const click=s.occupied?'':` onclick="pickSeat('${key}',${add})"`;
      html+=`<div class="${cls}" id="seat-${key}"${click} title="${key}${add?' (+₹'+add+')':''}">${s.exit?'🟢':key}</div>`;
    }
    html+='</div>';
  }
  html+='</div></div>'; return html;
}
//Handle seat selection, update UI and pricing dynamically based on seat type and additional fees
function pickSeat(key,add){
  if(S.selSeat){ const p=document.getElementById(`seat-${S.selSeat}`); if(p) p.classList.remove('ssel'); }
  S.selSeat=key; S.seatAdd=add;
  const el=document.getElementById(`seat-${key}`); if(el) el.classList.add('ssel');
  const info=document.getElementById('seat-info');
  if(info){ info.style.display='block'; info.textContent=`Seat ${key} selected${add?` (+₹${add} seat fee)`:''}` }
  recalcPrice();
}
//Handle meal selection and update total price accordingly by recalculating the price breakdown based on selected meal and service options, and update the UI to reflect the current selections and total price.
function pickMeal(id){ S.selMeal=id; document.querySelectorAll('.meal-card').forEach(c=>c.classList.remove('sel')); event.currentTarget.classList.add('sel'); recalcPrice(); }
//Handle special service selection and update pricing based on the selected service, also visually indicate the selected service in the UI and recalculate the total price to reflect any additional fees associated with the chosen service.
function pickSvc(id,price){ S.selSvc=id; document.querySelectorAll('.svc-card').forEach(c=>c.classList.remove('sel')); event.currentTarget.classList.add('sel'); recalcPrice(); }
//Calculate total booking cost including base fare, taxes, seat, meal, and services, and update the price breakdown display in the UI to show the current total price based on user selections.
function recalcPrice(){
  const bd=window._bd; if(!bd) return;
  const{baseP,taxes,pax}=bd; let total=(baseP+taxes)*pax;
  const sa=S.seatAdd||0; const r1=document.getElementById('pr-seat');
  if(r1){if(sa>0){r1.style.display='flex';document.getElementById('pv-seat').textContent='₹'+sa.toLocaleString('en-IN');}else r1.style.display='none';}
  total+=sa;
  const meal=S.mealOptions.find(m=>m.id===S.selMeal); const mp=(meal&&meal.price>0)?meal.price*pax:0;
  const r2=document.getElementById('pr-meal');
  if(r2){if(mp>0){r2.style.display='flex';document.getElementById('pv-meal').textContent='₹'+mp.toLocaleString('en-IN');}else r2.style.display='none';}
  total+=mp;
  const svc=S.svcOptions.find(s=>s.id===S.selSvc); const sp2=(svc&&svc.price>0)?svc.price:0;
  const r3=document.getElementById('pr-svc');
  if(r3){if(sp2>0){r3.style.display='flex';document.getElementById('pv-svc').textContent='₹'+sp2.toLocaleString('en-IN');}else r3.style.display='none';}
  total+=sp2;
  const el=document.getElementById('p-total'); if(el) el.textContent='₹'+total.toLocaleString('en-IN');
}
//Validate passenger and contact details, then proceed to payment step

async function doBook(){
  if(!S.user){nav('login');return;}
  const fns=[...document.querySelectorAll('.pf')].map(e=>e.value.trim());
  const lns=[...document.querySelectorAll('.pl')].map(e=>e.value.trim());
  if(fns.some(v=>!v)||lns.some(v=>!v)){toast('Please fill all passenger names','danger');return;}
  const passengers=fns.map((fn,i)=>`${fn} ${lns[i]}`);
  const email=document.getElementById('c-email')?.value;
  const phone=document.getElementById('c-phone')?.value;
  if(!email||!phone){toast('Please enter contact details','danger');return;}
  const f=S.selFlight;
  const res=await POST('/api/book',{
    flight_id:f.id,cabin:S.selCabin,seat:S.selSeat,passengers,email,phone,
    pax:S.sp.pax||1,origin:f.origin,dest:f.dest,dep:f.dep,arr:f.arr,
    travel_date:f.date,pre_meal:S.selMeal||'none',
    special_service:S.selSvc||'none',seat_price_add:S.seatAdd||0,
  });
  if(res.ok){ await runPayment(res.booking_id,res.pnr); }
  else { toast(res.error||'Booking failed','danger'); }
}
//Initiate payment process by creating a payment order, displaying payment modal with options, and handling user interactions for payment method selection and submission.
// PAYMENT=
async function runPayment(bookingId,pnr){
  const amount=parseInt((document.getElementById('p-total')?.textContent||'0').replace(/[^0-9]/g,''))||0;
  const order=await POST('/api/create-payment',{booking_id:bookingId,amount});
  if(!order.ok){toast('Could not initiate payment','danger');return;}
  const modal=document.getElementById('m-payment');
  modal.dataset.bookingId=bookingId; modal.dataset.orderId=order.order_id;
  modal.dataset.pnr=pnr; modal.dataset.amount=amount;
  document.getElementById('pay-pnr').textContent=pnr;
  document.getElementById('pay-amount').textContent='₹'+amount.toLocaleString('en-IN');
  document.getElementById('btn-pay').textContent='Pay ₹'+amount.toLocaleString('en-IN');
  document.getElementById('pay-upi-label').textContent=`UPI: skyway@okaxis  |  ₹${amount.toLocaleString('en-IN')}`;
  const qrGrid=document.getElementById('qr-grid');
  if(qrGrid){
    const pat=[[1,1,1,1,1,1,1,0,1,0],[1,0,0,0,0,0,1,0,0,1],[1,0,1,1,1,0,1,1,1,0],[1,0,1,1,1,0,1,0,0,1],
               [1,0,1,1,1,0,1,1,0,1],[1,0,0,0,0,0,1,0,1,0],[1,1,1,1,1,1,1,0,1,1],[0,0,0,0,0,0,0,1,0,1],
               [1,1,0,1,0,1,1,0,1,0],[0,1,0,0,1,0,0,1,0,1]];
    qrGrid.innerHTML=pat.flat().map(v=>`<div style="background:${v?'#0b1437':'white'};border-radius:1px"></div>`).join('');
  }
  switchPayTab('card',document.querySelector('.pay-tab'));
  modal.classList.add('open');
}
//Handle payment method tab switching in the payment modal, showing relevant input fields for each method, and updating the pay button text based on the selected method and amount.
function switchPayTab(method,el){
  document.querySelectorAll('.pay-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['card','qr','netbanking','wallet'].forEach(p=>{
    const panel=document.getElementById('panel-'+p);
    if(panel) panel.style.display=p===method?'block':'none';
  });
  const modal=document.getElementById('m-payment');
  const amount=parseInt(modal?.dataset.amount||'0');
  const btn=document.getElementById('btn-pay');
  if(btn) btn.textContent=method==='qr'?`✅ I've Paid ₹${amount.toLocaleString('en-IN')}`:
                                         `Pay ₹${amount.toLocaleString('en-IN')}`;
}
//Handle wallet option selection in the payment modal, visually indicating the selected wallet and ensuring only one wallet can be active at a time.
function pickWallet(el){ document.querySelectorAll('.wallet-opt').forEach(w=>w.classList.remove('active')); el.classList.add('active'); }

async function submitPayment(){
  const modal=document.getElementById('m-payment');
  const bookingId=modal.dataset.bookingId,orderId=modal.dataset.orderId,pnr=modal.dataset.pnr;
  const activeTab=document.querySelector('.pay-tab.active');
  const tabs=[...document.querySelectorAll('.pay-tab')];
  const method=['card','qr','netbanking','wallet'][tabs.indexOf(activeTab)]||'card';
  if(method==='card'){
    const card=document.getElementById('pay-card')?.value.replace(/\s/g,'');
    const exp=document.getElementById('pay-exp')?.value;
    const cvv=document.getElementById('pay-cvv')?.value;
    const name=document.getElementById('pay-name')?.value;
    if(!card||card.length<12){toast('Enter a valid card number','danger');return;}
    if(!exp||exp.length<5){toast('Enter expiry e.g. 12/27','danger');return;}
    if(!cvv||cvv.length<3){toast('Enter 3-digit CVV','danger');return;}
    if(!name){toast('Enter name on card','danger');return;}
  }
  if(method==='upi'){const upi=document.getElementById('pay-upi')?.value;if(!upi||!upi.includes('@')){toast('Enter valid UPI ID','danger');return;}}
  if(method==='netbanking'){const bank=document.getElementById('pay-bank')?.value;if(!bank){toast('Please select your bank','warning');return;}}
  if(method==='wallet'){const ph=document.getElementById('pay-wallet-phone')?.value;if(!ph||ph.length<8){toast('Enter registered mobile number','danger');return;}}
  const btn=document.getElementById('btn-pay');
  btn.textContent='⏳ Processing…'; btn.disabled=true;
  await new Promise(r=>setTimeout(r,1500));
  const verify=await POST('/api/verify-payment',{booking_id:bookingId,order_id:orderId});
  closeModal('m-payment'); btn.disabled=false;
  if(verify.ok){ toast('✅ Payment successful! PNR: '+pnr,'success'); nav('booking',{bookingId}); }
  else { toast('Payment failed: '+(verify.error||'Unknown'),'danger'); }
}
//Fetch and display all user bookings with sorting, empty state UI, and action buttons (view + download)
// BOOKINGS LIST
async function renderBookings(app){
  if(!S.user){nav('login');return;}
  app.innerHTML='<div class="page"><div class="spinner"></div></div>';
  const res=await GET('/api/bookings');
  if(!res.ok){app.innerHTML='<div class="page"><p>Error loading bookings.</p></div>';return;}
  const bks=res.bookings.sort((a,b)=>(b.booked_at||'').localeCompare(a.booked_at||''));
  if(!bks.length){
    app.innerHTML=`<div class="page"><div class="flex-b mb-4">
      <div style="font-family:'Sora',sans-serif;font-size:1.4rem;font-weight:700">My Bookings</div>
      <button class="btn btn-primary" onclick="nav('home')">+ New Booking</button></div>
      <div class="empty"><div class="empty-icon">✈</div><div class="empty-title">No bookings yet</div>
      <div class="empty-desc">Search and book your first flight</div>
      <button class="btn btn-primary mt-2" onclick="nav('home')">Search Flights</button></div></div>`;
    return;
  }
  const cards=bks.map(b=>{
    const pCls=`p-${b.status}`;
    const pIcon={confirmed:'✅',cancelled:'❌',checked_in:'🛫'}[b.status]||'⏳';
    const payBadge=b.payment_status==='paid'?'<span class="pay-pill pay-paid">✓ Paid</span>':'<span class="pay-pill pay-pending">⏳ Pending</span>';
    return `
    <div class="bk-card ${b.status}">
      <div class="bk-hdr">
        <div><div class="pnr-badge">${b.pnr}</div><div class="text-muted mt-1" style="font-size:.78rem">${b.airline_name} · ${b.flight_number}</div></div>
        <div style="display:flex;gap:.5rem;align-items:center">${payBadge}<div class="status-pill ${pCls}">${pIcon} ${b.status.replace('_',' ').toUpperCase()}</div></div>
      </div>
      <div class="bk-route"><div class="bk-city">${b.origin}</div><div class="bk-arrow">✈</div><div class="bk-city">${b.dest}</div></div>
      <div class="bk-meta">
        <div><div class="bk-lbl">Date</div><div class="bk-val">${b.travel_date}</div></div>
        <div><div class="bk-lbl">Time</div><div class="bk-val">${b.dep||'--:--'}</div></div>
        <div><div class="bk-lbl">Cabin</div><div class="bk-val">${(b.cabin||'').toUpperCase()}</div></div>
        <div><div class="bk-lbl">Total</div><div class="bk-val">₹${(b.total_amount||0).toLocaleString('en-IN')}</div></div>
      </div>
      <div class="bk-actions">
        <button class="btn btn-primary" onclick="nav('booking',{bookingId:'${b.id}'})">View Details →</button>
        <a class="btn btn-sec" href="/api/ticket/${b.id}" download="SkyWay_${b.pnr}.pdf">⬇ Ticket</a>
      </div>
    </div>`;
  }).join('');
  app.innerHTML=`<div class="page">
    <div class="flex-b mb-4">
      <div><div style="font-family:'Sora',sans-serif;font-size:1.4rem;font-weight:700">My Bookings</div>
      <div class="text-muted">${bks.length} booking${bks.length!==1?'s':''}</div></div>
      <button class="btn btn-primary" onclick="nav('home')">+ New Booking</button>
    </div>${cards}</div>`;
}
//Fetch and display detailed information for a specific booking, including flight details, passenger info, timeline, fare breakdown, and payment status, with options to cancel or reschedule if applicable.
// BOOKING DETAIL
async function renderBookingDetail(app){
  if(!S.user||!S.bookingId){nav('bookings');return;}
  app.innerHTML='<div class="page"><div class="spinner"></div></div>';
  const res=await GET(`/api/booking/${S.bookingId}`);
  if(!res.ok){toast(res.error,'danger');nav('bookings');return;}
  const{booking:b,can_cancel,cancel_reason,refund_pct,can_reschedule,reschedule_reason,can_checkin,checkin_reason}=res;
  S.currentBk=b;
  const pIcon={confirmed:'✅',cancelled:'❌',checked_in:'🛫'}[b.status]||'⏳';
  const pCls=`p-${b.status}`;
  const now=new Date(); const tdt=new Date(`${b.travel_date}T${b.dep||'00:00'}`);
  const hrsLeft=(tdt-now)/3600000;
  const tl=[{label:'Booking Confirmed',done:true},{label:'Check-in Open (48h)',done:hrsLeft<=48},
             {label:'Checked In',done:b.status==='checked_in'},{label:'Departed',done:hrsLeft<=0}];
  const tlHtml=b.status!=='cancelled'?`<div class="timeline mb-3">
    ${tl.map((t,i)=>`${i>0?`<div class="tl-line ${tl[i-1].done?'done':''}"></div>`:''}
    <div class="tl-step"><div class="tl-dot ${t.done?'done':'pending'}">${t.done?'✓':'○'}</div>
    <div class="tl-lbl">${t.label}</div></div>`).join('')}</div>`:'';
  const passRows=(b.passengers||[]).map((p,i)=>`
    <div style="display:flex;align-items:center;gap:.7rem;padding:.55rem;background:var(--s2);border-radius:var(--r1);margin-bottom:.4rem">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--sky-bg);color:var(--sky-d);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem">${i+1}</div>
      <span style="font-weight:600;font-size:.88rem">${p}</span>
    </div>`).join('');
  const fareRows=[['Base fare',b.base_price],['Taxes (12%)',b.taxes],
    b.meal_charge>0?['Meal',b.meal_charge]:null,b.svc_charge>0?['Special service',b.svc_charge]:null,
    b.seat_charge>0?['Seat fee',b.seat_charge]:null].filter(Boolean)
    .map(([l,v])=>`<div class="price-row"><span>${l}</span><span>₹${v.toLocaleString('en-IN')}</span></div>`).join('');
  const payStatus=b.payment_status==='paid'
    ?`<div class="alert alert-success mb-2"><span class="alert-icon">✅</span>Payment confirmed · ID: <span class="mono">${b.payment_id||'—'}</span></div>`
    :`<div class="alert alert-warning mb-2"><span class="alert-icon">⚠</span>Payment pending</div>`;

  app.innerHTML=`
  <div class="page">
    <div class="flex-b mb-4">
      <div><div style="font-family:'Sora',sans-serif;font-size:1.35rem;font-weight:700">Booking Details</div><div class="text-muted">Manage your flight</div></div>
      <button class="btn btn-sec" onclick="nav('bookings')">← My Bookings</button>
    </div>
    <div class="route-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.9rem">
        <div><div style="font-size:.65rem;opacity:.55;text-transform:uppercase;letter-spacing:1px">PNR</div>
        <div style="font-family:'DM Mono',monospace;font-size:1.45rem;font-weight:500;letter-spacing:3px;margin-top:2px">${b.pnr}</div></div>
        <div class="status-pill ${pCls}">${pIcon} ${b.status.replace('_',' ').toUpperCase()}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem">
        <div><div class="rh-city">${b.origin}</div><div class="rh-lbl">${(AIRPORTS[b.origin]||{}).city||''}</div><div class="rh-time">${b.dep||'--:--'}</div></div>
        <div style="text-align:center;opacity:.8"><div style="font-size:1.6rem">✈</div><div style="font-size:.78rem;margin-top:2px">${b.airline_name}</div><div style="font-size:.72rem;font-family:'DM Mono',monospace">${b.flight_number}</div></div>
        <div style="text-align:right"><div class="rh-city">${b.dest}</div><div class="rh-lbl">${(AIRPORTS[b.dest]||{}).city||''}</div><div class="rh-time">${b.arr||'--:--'}</div></div>
      </div>
      <div style="display:flex;gap:1.75rem;border-top:1px solid rgba(255,255,255,.15);padding-top:.85rem;flex-wrap:wrap">
        ${[['DATE',b.travel_date],['CABIN',(b.cabin||'').toUpperCase()],['SEAT',b.seat||'Auto'],
           ['PAX',(b.passengers||[]).length],['BAGGAGE',b.baggage||'15 kg'],
           ['MEAL',(b.pre_meal||'—').replace(/_/g,' ')]]
          .map(([l,v])=>`<div><div style="font-size:.62rem;opacity:.52;letter-spacing:.7px">${l}</div><div style="font-weight:700;font-size:.82rem;margin-top:2px">${v}</div></div>`).join('')}
      </div>
    </div>
    ${tlHtml}
    ${payStatus}
    <div class="g2 mb-3">
      <div class="card"><div class="card-title">👥 Passengers</div>${passRows}</div>
      <div class="card"><div class="card-title">💳 Fare Breakdown</div>
        <div class="price-box">${fareRows}
          <div class="price-total"><span>Total Paid</span><span>₹${(b.total_amount||0).toLocaleString('en-IN')}</span></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">⚡ Actions</div>
      ${!can_cancel&&b.status!=='cancelled'?`<div class="alert alert-warning mb-2"><span class="alert-icon">⚠</span>${cancel_reason}</div>`:''}
      <div class="bk-actions">
        <a class="btn btn-primary" href="/api/ticket/${b.id}" download="SkyWay_${b.pnr}.pdf">⬇ Download Ticket</a>
        ${can_checkin?`<button class="btn btn-success" onclick="nav('checkin',{bookingId:'${b.id}'})">🛎 Web Check-In</button>`
          :`<button class="btn btn-sec dis" title="${checkin_reason}">🛎 Check-In</button>`}
        ${can_reschedule?`<button class="btn btn-warning" onclick="openReschedule('${b.id}','${reschedule_reason.replace(/'/g,"\\'")}')">🔄 Reschedule</button>`
          :`<button class="btn btn-sec dis" title="${reschedule_reason}">🔄 Reschedule</button>`}
        ${can_cancel?`<button class="btn btn-danger" onclick="openCancel('${b.id}','${cancel_reason.replace(/'/g,"\\'")}',${refund_pct})">❌ Cancel</button>`
          :b.status!=='cancelled'?`<button class="btn btn-sec dis">❌ Cancel</button>`:''}
      </div>
    </div>
  </div>`;
}
//Handle web check-in process by validating booking eligibility, displaying flight and passenger details, allowing users to declare baggage and accept terms, and submitting check-in information to the server.
// CHECK-IN
async function renderCheckin(app){
  if(!S.user||!S.bookingId){nav('bookings');return;}
  app.innerHTML='<div class="page"><div class="spinner"></div></div>';
  const res=await GET(`/api/booking/${S.bookingId}`);
  if(!res.ok||!res.can_checkin){toast(res.checkin_reason||res.error||'Check-in not available','danger');nav('booking',{bookingId:S.bookingId});return;}
  const b=res.booking;
  app.innerHTML=`
  <div class="page page-md">
    <div class="flex-b mb-4"><div style="font-family:'Sora',sans-serif;font-size:1.35rem;font-weight:700">🛎 Web Check-In</div>
    <button class="btn btn-sec" onclick="nav('booking',{bookingId:'${b.id}'})">← Back</button></div>
    <div class="alert alert-success mb-3"><span class="alert-icon">✅</span>Check-in is open!</div>
    <div class="card mb-3">
      <div class="card-title">✈ Flight</div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--sky-bg);border-radius:var(--r1);padding:.9rem 1rem;border:1px solid rgba(14,165,233,.2)">
        <div><div style="font-size:1.2rem;font-weight:800;color:var(--navy)">${b.origin} → ${b.dest}</div>
        <div class="text-muted">${b.airline_name} ${b.flight_number} · ${b.travel_date} · ${b.dep||'--:--'}</div></div>
        <div class="pnr-badge">${b.pnr}</div>
      </div>
    </div>
    <div class="card mb-3">
      <div class="card-title">👥 Passengers</div>
      ${(b.passengers||[]).map((p,i)=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem;background:var(--s2);border-radius:var(--r1);margin-bottom:.4rem">
          <div style="display:flex;align-items:center;gap:.7rem">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--sky);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem">${i+1}</div>
            <span style="font-weight:600;font-size:.9rem">${p}</span>
          </div><div class="text-muted" style="font-size:.78rem">Seat: ${b.seat||'Auto'}</div>
        </div>`).join('')}
      <div class="form-grid mt-2">
        <div><label class="form-label">Emergency Contact</label><input type="tel" id="emer-ph" class="form-inp" placeholder="+91 9876543210"></div>
        <div><label class="form-label">Special Requirement</label>
          <select id="spec-req" class="form-inp form-sel">
            <option>None</option><option>Wheelchair assistance</option><option>Extra legroom</option>
            <option>Vegetarian meal</option><option>Infant in lap</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card mb-3">
      <div class="card-title">🧳 Baggage Declaration</div>
      <div class="alert alert-info mb-2"><span class="alert-icon">ℹ</span>Allowance: <strong>${b.baggage||'15 kg'}</strong> checked + 7 kg cabin bag</div>
      <label style="display:flex;align-items:flex-start;gap:.75rem;cursor:pointer;margin-bottom:.7rem">
        <input type="checkbox" id="chk-bag" style="width:18px;height:18px;margin-top:2px;accent-color:var(--sky)">
        <span style="font-size:.88rem">My baggage is within the limit and contains no prohibited items</span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:.75rem;cursor:pointer">
        <input type="checkbox" id="chk-terms" style="width:18px;height:18px;margin-top:2px;accent-color:var(--sky)">
        <span style="font-size:.88rem">I agree to the airline's terms and security regulations</span>
      </label>
      <button class="btn btn-success btn-lg btn-full mt-3" onclick="submitCheckin('${b.id}')">✈ Complete Check-In</button>
    </div>
  </div>
  <div class="modal-backdrop" id="m-bp">
    <div class="modal" style="max-width:540px">
      <div class="modal-title" style="margin-bottom:1.4rem">🛫 Check-In Successful!</div>
      <div class="boarding-pass mb-3">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.4rem">
          <div><div style="font-size:.62rem;opacity:.5;letter-spacing:1px;text-transform:uppercase">Boarding Pass</div>
          <div style="font-family:'Sora',sans-serif;font-size:1.75rem;font-weight:900;letter-spacing:-1px">${b.origin} → ${b.dest}</div></div>
          <div style="font-size:1.9rem;opacity:.7">✈</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.9rem;border-top:1px solid rgba(255,255,255,.15);padding-top:.9rem">
          ${[['PASSENGER',(b.passengers||['—'])[0]],['FLIGHT',b.flight_number],['SEAT',b.seat||'Auto'],
             ['DATE',b.travel_date],['DEP TIME',b.dep||'--:--'],['PNR',b.pnr]]
            .map(([l,v])=>`<div><div class="bp-lbl">${l}</div><div class="bp-val">${v}</div></div>`).join('')}
        </div>
      </div>
      <div class="flex gap-2">
        <a class="btn btn-primary btn-full" href="/api/ticket/${b.id}" download="SkyWay_${b.pnr}.pdf">⬇ Download Boarding Pass</a>
        <button class="btn btn-sec btn-full" onclick="nav('bookings')">My Bookings</button>
      </div>
    </div>
  </div>`;
}
//Submit check-in information to the server after validating user input, and display boarding pass modal on successful check-in or show error message on failure.
async function submitCheckin(bid){
  if(!document.getElementById('chk-bag')?.checked||!document.getElementById('chk-terms')?.checked){toast('Please confirm both checkboxes','danger');return;}
  const res=await POST('/api/checkin',{booking_id:bid});
  if(res.ok) document.getElementById('m-bp').classList.add('open');
  else toast(res.error||'Check-in failed','danger');
}
//Handle booking cancellation by confirming user intent, sending cancellation request to the server, and updating the UI based on the response, including refund information if applicable.
// PROFILE
async function renderProfile(app){
  if(!S.user){nav('login');return;}
  const u=S.user; const joined=new Date(u.created_at||Date.now()).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  app.innerHTML=`
  <div class="page page-md">
    <div class="profile-hdr">
      <div class="profile-av ${u.role==='admin'?'admin-av':''}">${u.name.charAt(0).toUpperCase()}</div>
      <div><div class="profile-name">${u.name}${u.role==='admin'?' 👑':''}</div>
        <div class="profile-email">${u.email}</div>
        <div class="text-muted" style="margin-top:.25rem">Member since ${joined}</div>
      </div>
    </div>
    <div class="card mb-3">
      <div class="card-title">✏️ Personal Information</div>
      <div class="form-grid mb-3">
        <div><label class="form-label">Full Name</label><input type="text" id="p-name" class="form-inp" value="${u.name||''}"></div>
        <div><label class="form-label">Phone</label><input type="tel" id="p-phone" class="form-inp" value="${u.phone||''}"></div>
        <div><label class="form-label">Date of Birth</label><input type="date" id="p-dob" class="form-inp" value="${u.dob||''}"></div>
        <div><label class="form-label">Gender</label><select id="p-gender" class="form-inp form-sel">
          ${['Male','Female','Other'].map(g=>`<option ${g===u.gender?'selected':''}>${g}</option>`).join('')}</select></div>
        <div><label class="form-label">Passport / Aadhaar</label><input type="text" id="p-passport" class="form-inp" value="${u.passport||''}"></div>
        <div><label class="form-label">Nationality</label><input type="text" id="p-nationality" class="form-inp" value="${u.nationality||''}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveProfile()">💾 Save Changes</button>
    </div>
    <div class="card mb-3">
      <div class="card-title">🔒 Change Password</div>
      <div class="form-grid mb-3">
        <div class="form-full"><label class="form-label">Current Password</label><input type="password" id="p-old" class="form-inp" placeholder="Current password"></div>
        <div><label class="form-label">New Password</label><input type="password" id="p-new1" class="form-inp" placeholder="Min 8 characters"></div>
        <div><label class="form-label">Confirm Password</label><input type="password" id="p-new2" class="form-inp" placeholder="Repeat"></div>
      </div>
      <button class="btn btn-warning" onclick="changePw()">🔑 Update Password</button>
    </div>
    <div class="card">
      <div class="card-title">🚀 Quick Links</div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        ${u.role==='admin'?`<button class="btn btn-admin" onclick="nav('admin')">⚙ Admin Panel</button>`:`<button class="btn btn-outline" onclick="nav('bookings')">📋 My Bookings</button>`}
        <button class="btn btn-outline" onclick="nav('home')">✈ Search Flights</button>
        <button class="btn btn-danger" onclick="doLogout()">🚪 Sign Out</button>
      </div>
    </div>
  </div>`;
}
//Collect updated profile information from the form, send it to the server, and update the UI based on the response, including error handling and success feedback.
async function saveProfile(){
  const body={name:document.getElementById('p-name')?.value,phone:document.getElementById('p-phone')?.value,
    dob:document.getElementById('p-dob')?.value,gender:document.getElementById('p-gender')?.value,
    passport:document.getElementById('p-passport')?.value,nationality:document.getElementById('p-nationality')?.value};
  const res=await POST('/api/profile',body);
  if(res.ok){Object.assign(S.user,body);updateNav();toast('Profile updated!','success');}
  else toast(res.error||'Failed','danger');
}
//Validate password change form inputs, send change request to the server, and handle the response by providing user feedback and clearing the form on success.
async function changePw(){
  const old=document.getElementById('p-old')?.value,n1=document.getElementById('p-new1')?.value,n2=document.getElementById('p-new2')?.value;
  if(!old||!n1){toast('Fill all password fields','danger');return;}
  if(n1!==n2){toast('Passwords do not match','danger');return;}
  if(n1.length<8){toast('Password must be ≥ 8 characters','danger');return;}
  const res=await POST('/api/change-password',{old_password:old,new_password:n1});
  if(res.ok){toast('Password changed!','success');['p-old','p-new1','p-new2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});}
  else toast(res.error||'Failed','danger');
}
//Fetch and display admin dashboard with key statistics, charts, and tables for managing flights, bookings, users, notifications, and revenue, with tabbed navigation for different sections.
// ADMIN PANEL
async function renderAdmin(app){
  if(!S.user||S.user.role!=='admin'){nav('home');return;}
  app.innerHTML='<div class="page"><div class="spinner"></div></div>';
  const tab=S.adminTab||'dashboard';

  app.innerHTML=`
  <div class="page">
    <div class="admin-hero">
      <h1>⚙ Admin Panel</h1>
      <p>Manage flights, passengers, revenue and notifications</p>
    </div>
    <div class="admin-tabs">
      <div class="atab ${tab==='dashboard'?'active':''}" onclick="switchAdminTab('dashboard')">📊 Dashboard</div>
      <div class="atab ${tab==='bookings'?'active':''}" onclick="switchAdminTab('bookings')">📋 All Bookings</div>
      <div class="atab ${tab==='users'?'active':''}" onclick="switchAdminTab('users')">👥 Users</div>
      <div class="atab ${tab==='flights'?'active':''}" onclick="switchAdminTab('flights')">✈ Flight Status</div>
      <div class="atab ${tab==='notifications'?'active':''}" onclick="switchAdminTab('notifications')">📢 Notifications</div>
      <div class="atab ${tab==='revenue'?'active':''}" onclick="switchAdminTab('revenue')">💰 Revenue</div>
    </div>
    <div id="admin-content"><div class="spinner"></div></div>
  </div>`;

  loadAdminTab(tab);
}
// Handle admin tab switching by updating active tab state, re-rendering the tab UI, and loading the corresponding content for the selected tab.
function switchAdminTab(tab){
  S.adminTab=tab;
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t=>{if(t.textContent.toLowerCase().includes(tab.toLowerCase().slice(0,4))) t.classList.add('active');});
  // More reliable: re-render just the tab UI
  document.querySelectorAll('.atab').forEach((t,i)=>{
    const tabs=['dashboard','bookings','users','flights','notifications','revenue'];
    t.classList.toggle('active',tabs[i]===tab);
  });
  loadAdminTab(tab);
}
// Load content for the selected admin tab by fetching relevant data from the server and rendering it within the admin content area, with error handling for failed requests.
async function loadAdminTab(tab){
  const el=document.getElementById('admin-content');
  if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  switch(tab){
    case 'dashboard':    await loadAdminDashboard(el); break;
    case 'bookings':     await loadAdminBookings(el); break;
    case 'users':        await loadAdminUsers(el); break;
    case 'flights':      await loadAdminFlights(el); break;
    case 'notifications':await loadAdminNotifications(el); break;
    case 'revenue':      await loadAdminRevenue(el); break;
  }
}
// Fetch and display key statistics, charts, and recent transactions for the admin dashboard, providing insights into bookings, revenue, user activity, and airline performance.
async function loadAdminDashboard(el){
  const res=await GET('/api/admin/stats');
  if(!res.ok){el.innerHTML='<p>Error loading stats</p>';return;}
  const s=res.stats;
  el.innerHTML=`
  <div class="g4 mb-4">
    <div class="stat-card"><div class="stat-val">₹${(s.total_revenue/100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} </div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--navy)">₹${s.total_revenue.toLocaleString('en-IN')}</div>
      <div class="stat-lbl">Total Revenue</div><div class="stat-trend trend-up">💰 All time</div></div>
    <div class="stat-card"><div style="font-size:2rem;font-weight:800;color:var(--navy)">${s.total_bookings}</div>
      <div class="stat-lbl">Total Bookings</div>
      <div class="stat-trend">${s.by_status.confirmed||0} confirmed · ${s.by_status.cancelled||0} cancelled</div></div>
    <div class="stat-card"><div style="font-size:2rem;font-weight:800;color:var(--navy)">${s.paid_bookings}</div>
      <div class="stat-lbl">Paid Bookings</div>
      <div class="stat-trend trend-up">✅ Revenue generating</div></div>
    <div class="stat-card"><div style="font-size:2rem;font-weight:800;color:var(--navy)">${s.total_users}</div>
      <div class="stat-lbl">Registered Users</div>
      <div class="stat-trend">👥 Active accounts</div></div>
  </div>

  <div class="g2 mb-4">
    <div class="card">
      <div class="card-title">✈ Bookings by Airline</div>
      ${Object.entries(s.by_airline).sort(([,a],[,b])=>b-a).map(([al,cnt])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.88rem;font-weight:600">${al}</span>
          <div style="display:flex;align-items:center;gap.75rem">
            <div style="width:${Math.min(80,cnt*8)}px;height:6px;background:var(--sky);border-radius:3px;margin-right:.5rem"></div>
            <span class="badge badge-sky">${cnt}</span>
          </div>
        </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">📊 Booking Status</div>
      ${Object.entries(s.by_status).map(([st,cnt])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.88rem;font-weight:600">${st.replace('_',' ').toUpperCase()}</span>
          <span class="status-pill p-${st}">${cnt}</span>
        </div>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="card-title">💳 Recent Transactions</div>
    <div style="overflow-x:auto">
    <table class="data-table">
      <thead><tr><th>Payment ID</th><th>PNR</th><th>Passenger</th><th>Route</th><th>Airline</th><th>Cabin</th><th>Amount</th><th>Time</th></tr></thead>
      <tbody>
        ${(s.recent_transactions||[]).map(t=>`
          <tr><td class="mono" style="font-size:.78rem">${t.id}</td>
            <td class="mono">${t.pnr}</td><td>${t.user}</td>
            <td>${t.route}</td><td>${t.airline}</td>
            <td>${(t.cabin||'').toUpperCase()}</td>
            <td style="font-weight:700;color:var(--green)">₹${(t.amount||0).toLocaleString('en-IN')}</td>
            <td style="font-size:.75rem;color:var(--t3)">${new Date(t.at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</td>
          </tr>`).join('')}
        ${!s.recent_transactions?.length?'<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:1rem">No transactions yet</td></tr>':''}
      </tbody>
    </table>
    </div>
  </div>`;
}
// Fetch and display all bookings in the admin panel with search and filter functionality, allowing admins to view booking details, user information, and perform actions like cancellation.
async function loadAdminBookings(el){
  const res=await GET('/api/admin/bookings');
  if(!res.ok){el.innerHTML='<p>Error</p>';return;}
  const bks=res.bookings;
  el.innerHTML=`
  <div class="flex-b mb-3">
    <div><strong>${bks.length}</strong> total bookings</div>
    <input class="form-inp" style="width:250px;padding:.45rem .85rem" placeholder="🔍 Search PNR, name, route..." id="bk-search" oninput="filterAdminBookings()">
  </div>
  <div style="overflow-x:auto">
  <table class="data-table" id="bk-table">
    <thead><tr><th>PNR</th><th>Passenger</th><th>Route</th><th>Date</th><th>Cabin</th><th>Airline</th><th>Amount</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead>
    <tbody id="bk-tbody">
      ${bks.map(b=>`
        <tr data-search="${b.pnr} ${(b.passengers||[]).join(' ')} ${b.origin} ${b.dest} ${b.airline_name}".toLowerCase()>
          <td class="mono">${b.pnr}</td>
          <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(b.passengers||['—'])[0]}</td>
          <td>${b.origin} → ${b.dest}</td><td>${b.travel_date}</td>
          <td>${(b.cabin||'').toUpperCase()}</td><td>${b.airline_name||''}</td>
          <td>₹${(b.total_amount||0).toLocaleString('en-IN')}</td>
          <td><span class="status-pill p-${b.status}">${b.status.replace('_',' ')}</span></td>
          <td><span class="pay-pill ${b.payment_status==='paid'?'pay-paid':'pay-pending'}">${b.payment_status||'pending'}</span></td>
          <td><div class="flex gap-2">
            <button class="btn btn-sec" style="padding:.3rem .65rem;font-size:.75rem" onclick="adminViewUser('${b.user_email}')">👤 User</button>
            ${b.status!=='cancelled'?`<button class="btn btn-danger" style="padding:.3rem .65rem;font-size:.75rem" onclick="adminCancelBooking('${b.id}','${b.pnr}')">Cancel</button>`:''}
          </div></td>
        </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
  // Store data for filtering
  window._adminBks=bks;
}
// Filter admin bookings table based on search input, matching against PNR, passenger names, route, and airline, and update the display of rows accordingly.
function filterAdminBookings(){
  const q=document.getElementById('bk-search')?.value.toLowerCase()||'';
  document.querySelectorAll('#bk-tbody tr').forEach(r=>{
    r.style.display=!q||(r.dataset.search||'').includes(q)?'':'none';
  });
}
// Handle admin booking cancellation by confirming the action, sending a cancellation request to the server with a reason, and updating the UI based on the response, including feedback on successful cancellation or errors.
async function adminCancelBooking(bid,pnr){
  if(!confirm(`Cancel booking ${pnr}? This cannot be undone.`)) return;
  const res=await POST('/api/admin/cancel-booking',{booking_id:bid,reason:'Admin cancellation'});
  if(res.ok){toast(`Booking ${pnr} cancelled`,'success');loadAdminTab('bookings');}
  else toast(res.error,'danger');
}
// Fetch and display all registered users in the admin panel with search functionality, allowing admins to view user details, booking history, and manage user accounts effectively.
async function loadAdminUsers(el){
  const res=await GET('/api/admin/users');
  if(!res.ok){el.innerHTML='<p>Error</p>';return;}
  const users=res.users;
  el.innerHTML=`
  <div class="flex-b mb-3">
    <div><strong>${users.length}</strong> registered users</div>
    <input class="form-inp" style="width:250px;padding:.45rem .85rem" placeholder="🔍 Search name or email..." id="usr-search" oninput="filterAdminUsers()">
  </div>
  <div style="overflow-x:auto">
  <table class="data-table" id="usr-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Bookings</th><th>Actions</th></tr></thead>
    <tbody id="usr-tbody">
      ${users.map(u=>`
        <tr data-search="${u.name} ${u.email}".toLowerCase()>
          <td style="font-weight:600">${u.name}</td>
          <td>${u.email}</td><td>${u.phone||'—'}</td>
          <td style="font-size:.8rem;color:var(--t3)">${new Date(u.created_at||Date.now()).toLocaleDateString('en-IN')}</td>
          <td><span class="badge badge-sky">${(u.bookings||[]).length}</span></td>
          <td><button class="btn btn-sec" style="padding:.3rem .65rem;font-size:.75rem" onclick="adminViewUser('${u.email}')">👁 View Details</button></td>
        </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
}
// Filter admin users table based on search input, matching against name and email, and update the display of rows accordingly.
function filterAdminUsers(){
  const q=document.getElementById('usr-search')?.value.toLowerCase()||'';
  document.querySelectorAll('#usr-tbody tr').forEach(r=>{r.style.display=!q||(r.dataset.search||'').includes(q)?'':'none';});
}
// Fetch and display detailed information about a specific user, including their profile details and booking history, in a modal within the admin panel, allowing admins to quickly access user information and manage accounts effectively.
async function adminViewUser(email){
  const res=await GET(`/api/admin/user-bookings/${email}`);
  if(!res.ok){toast('Error loading user','danger');return;}
  const{user:u,bookings:bks}=res;
  // Show in a modal — reuse m-cancel
  const modal=document.getElementById('m-cancel');
  document.querySelector('#m-cancel .modal-title').textContent=`👤 ${u.name}`;
  const body=document.getElementById('m-cancel-body');
  body.innerHTML=`
    <div style="background:var(--s2);border-radius:var(--r2);padding:1rem;margin-bottom:1rem;border:1px solid var(--border)">
      <div class="g2" style="gap:.5rem">
        ${[['Email',u.email],['Phone',u.phone||'—'],['DOB',u.dob||'—'],['Gender',u.gender||'—'],
           ['Nationality',u.nationality||'—'],['Passport',u.passport||'—'],['Joined',new Date(u.created_at||Date.now()).toLocaleDateString('en-IN')],
           ['Bookings',(u.bookings||[]).length]].map(([l,v])=>`
          <div><div style="font-size:.68rem;color:var(--t3);font-weight:700;text-transform:uppercase">${l}</div>
          <div style="font-weight:600;font-size:.85rem">${v}</div></div>`).join('')}
      </div>
    </div>
    <div style="font-weight:700;margin-bottom:.75rem;font-size:.9rem">Bookings (${bks.length})</div>
    ${bks.map(b=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .85rem;background:var(--s2);border-radius:var(--r1);margin-bottom:.4rem;border:1px solid var(--border)">
        <div><div class="mono" style="font-size:.85rem;font-weight:600">${b.pnr}</div>
        <div style="font-size:.75rem;color:var(--t3)">${b.origin} → ${b.dest} · ${b.travel_date}</div></div>
        <div style="text-align:right">
          <div style="font-size:.85rem;font-weight:700">₹${(b.total_amount||0).toLocaleString('en-IN')}</div>
          <span class="status-pill p-${b.status}" style="font-size:.65rem">${b.status}</span>
        </div>
      </div>`).join('')||'<div class="text-muted" style="text-align:center;padding:1rem">No bookings</div>'}`;
  // Hide the confirm button
  document.getElementById('btn-cancel-confirm').style.display='none';
  modal.classList.add('open');
  // Restore confirm button when closed
  modal.addEventListener('click',e=>{if(e.target===modal){document.getElementById('btn-cancel-confirm').style.display='';}}),{once:true};
}
// Fetch and display current flight statuses in the admin panel, allowing admins to quickly update flight status, set delays, send notifications to affected passengers, and manage active flight alerts effectively.
async function loadAdminFlights(el){
  const res=await GET('/api/admin/flight-status');
  const statuses=res.flight_status||{};
  el.innerHTML=`
  <div class="flex-b mb-3">
    <div style="font-size:.9rem;color:var(--t3)">${Object.keys(statuses).length} flight(s) with custom status</div>
    <button class="btn btn-primary" onclick="document.getElementById('m-notify').classList.add('open')">📢 Send Notification / Set Delay</button>
  </div>
  <div class="card mb-3">
    <div class="card-title">✈ Quick Flight Status Update</div>
    <div class="form-grid mb-2">
      <div><label class="form-label">Flight Number (e.g. 6E205)</label><input class="form-inp" id="fs-fid" placeholder="6E205_2026-04-15"></div>
      <div><label class="form-label">Status</label>
        <select class="form-inp form-sel" id="fs-status">
          <option value="delayed">⏰ Delayed</option><option value="cancelled">❌ Cancelled</option>
          <option value="gate_changed">🚪 Gate Changed</option><option value="on_time">✅ On Time</option>
        </select>
      </div>
      <div><label class="form-label">Delay (minutes, if applicable)</label><input type="number" class="form-inp" id="fs-delay" placeholder="0" min="0"></div>
      <div><label class="form-label">Message</label><input class="form-inp" id="fs-msg" placeholder="e.g. Due to ATC congestion"></div>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-warning" onclick="updateFlightStatus()">✏️ Update Status</button>
      <button class="btn btn-success" onclick="clearFlightStatus()">✅ Clear Status</button>
    </div>
  </div>
  ${Object.keys(statuses).length?`
  <div class="card">
    <div class="card-title">Active Flight Alerts</div>
    ${Object.entries(statuses).map(([fid,s])=>`
      <div class="notif-card ${s.status}" style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;font-size:.9rem" class="mono">${fid}</div>
          <div style="font-size:.8rem;color:var(--t3);margin-top:2px">${s.status.toUpperCase()}${s.delay_min>0?` · +${s.delay_min} min`:''}</div>
          <div style="font-size:.82rem;margin-top:4px">${s.message}</div>
          <div style="font-size:.72rem;color:var(--t4);margin-top:3px">${new Date(s.updated_at).toLocaleString('en-IN')}</div>
        </div>
        <button class="btn btn-sec" style="padding:.3rem .65rem;font-size:.75rem" onclick="adminClearStatus('${fid}')">Clear</button>
      </div>`).join('')}
  </div>`:'<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">All flights on time</div></div>'}`;
}
// Update flight status by sending the new status, delay, and message to the server for a specific flight ID, and refresh the admin flights tab to reflect changes or show error messages on failure.
async function updateFlightStatus(){
  const fid=document.getElementById('fs-fid')?.value.trim();
  const status=document.getElementById('fs-status')?.value;
  const delay=parseInt(document.getElementById('fs-delay')?.value||'0');
  const message=document.getElementById('fs-msg')?.value.trim();
  if(!fid){toast('Enter a flight ID','warning');return;}
  const res=await POST('/api/admin/update-flight-status',{flight_id:fid,status,delay_min:delay,message});
  if(res.ok){toast('Flight status updated','success');loadAdminTab('flights');}
  else toast(res.error,'danger');
}
// Clear flight status by sending a request to the server for a specific flight ID, and refresh the admin flights tab to reflect changes or show error messages on failure.
async function clearFlightStatus(){
  const fid=document.getElementById('fs-fid')?.value.trim();
  if(!fid){toast('Enter a flight ID','warning');return;}
  const res=await POST('/api/admin/clear-flight-status',{flight_id:fid});
  if(res.ok){toast('Status cleared','success');loadAdminTab('flights');}
  else toast(res.error,'danger');
}
// Clear flight status by sending a request to the server for a specific flight ID, and refresh the admin flights tab to reflect changes or show error messages on failure.
async function adminClearStatus(fid){
  const res=await POST('/api/admin/clear-flight-status',{flight_id:fid});
  if(res.ok){toast('Status cleared','success');loadAdminTab('flights');}
  else toast(res.error,'danger');
}
// Fetch and display all admin notifications, allowing admins to view details of each notification, including type, message, affected flight (if any), creation time, and providing the ability to delete notifications or create new ones.
async function loadAdminNotifications(el){
  const res=await GET('/api/admin/notifications');
  const notifs=res.notifications||[];
  const typeIcons={delay:'⏰',cancellation:'❌',gate_change:'🚪',boarding:'🛫',weather:'🌩',general:'📣'};
  el.innerHTML=`
  <div class="flex-b mb-3">
    <div><strong>${notifs.length}</strong> notifications sent</div>
    <button class="btn btn-primary" onclick="document.getElementById('m-notify').classList.add('open')">+ New Notification</button>
  </div>
  ${notifs.length?notifs.map(n=>`
    <div class="notif-card ${n.type}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="display:flex;align-items:flex-start;gap:.75rem">
          <div style="font-size:1.4rem">${typeIcons[n.type]||'📣'}</div>
          <div>
            <div style="font-weight:700;font-size:.9rem">${n.type.replace('_',' ').toUpperCase()}
              ${n.flight_id?`<span class="mono" style="font-size:.8rem;font-weight:500"> · ${n.flight_id}</span>`:''}
            </div>
            ${n.delay_min>0?`<div style="font-size:.78rem;color:var(--orange);font-weight:600">Delay: +${n.delay_min} minutes</div>`:''}
            <div style="font-size:.88rem;margin-top:4px">${n.message}</div>
            <div style="font-size:.72rem;color:var(--t4);margin-top:4px">
              ${new Date(n.created_at).toLocaleString('en-IN')} · by ${n.created_by}
            </div>
          </div>
        </div>
        <button class="btn btn-danger" style="padding:.3rem .65rem;font-size:.75rem;flex-shrink:0" onclick="deleteNotification('${n.id}')">Delete</button>
      </div>
    </div>`).join('')
    :'<div class="empty"><div class="empty-icon">📢</div><div class="empty-title">No notifications sent yet</div><div class="empty-desc">Use the button above to notify passengers</div></div>'}`;
}
// Delete a notification by sending its ID to the server, and refresh the admin notifications tab to reflect changes or show error messages on failure.
async function deleteNotification(id){
  const res=await POST('/api/admin/delete-notification',{id});
  if(res.ok){toast('Deleted','success');loadAdminTab('notifications');}
  else toast(res.error,'danger');
}
// Fetch and display revenue statistics and recent transactions in the admin panel, providing insights into total revenue, paid bookings, average booking value, and allowing admins to monitor financial performance effectively.
async function loadAdminRevenue(el){
  const res=await GET('/api/admin/stats');
  if(!res.ok){el.innerHTML='<p>Error</p>';return;}
  const s=res.stats; const txns=s.recent_transactions||[];
  el.innerHTML=`
  <div class="g3 mb-4">
    <div class="stat-card" style="border-left:4px solid var(--green)">
      <div style="font-size:1.8rem;font-weight:800;color:var(--navy)">₹${s.total_revenue.toLocaleString('en-IN')}</div>
      <div class="stat-lbl">Total Revenue</div>
    </div>
    <div class="stat-card" style="border-left:4px solid var(--sky)">
      <div style="font-size:1.8rem;font-weight:800;color:var(--navy)">${s.paid_bookings}</div>
      <div class="stat-lbl">Paid Bookings</div>
    </div>
    <div class="stat-card" style="border-left:4px solid var(--gold)">
      <div style="font-size:1.8rem;font-weight:800;color:var(--navy)">₹${s.paid_bookings>0?Math.round(s.total_revenue/s.paid_bookings).toLocaleString('en-IN'):'0'}</div>
      <div class="stat-lbl">Avg Booking Value</div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">💳 All Transactions</div>
    <div style="overflow-x:auto">
    <table class="data-table">
      <thead><tr><th>Payment ID</th><th>PNR</th><th>Passenger</th><th>Email</th><th>Route</th><th>Airline</th><th>Cabin</th><th>Amount</th><th>Date & Time</th></tr></thead>
      <tbody>
        ${txns.map(t=>`
          <tr>
            <td class="mono" style="font-size:.76rem">${t.id}</td>
            <td class="mono" style="font-weight:600">${t.pnr}</td>
            <td>${t.user}</td><td style="font-size:.78rem">${t.user_email}</td>
            <td style="font-weight:600">${t.route}</td>
            <td>${t.airline}</td><td>${(t.cabin||'').toUpperCase()}</td>
            <td style="font-weight:700;color:var(--green)">₹${(t.amount||0).toLocaleString('en-IN')}</td>
            <td style="font-size:.78rem;color:var(--t3)">${new Date(t.at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</td>
          </tr>`).join('')}
        ${!txns.length?'<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:1.5rem">No transactions recorded yet</td></tr>':''}
      </tbody>
    </table>
    </div>
  </div>`;
}
// Fetch and display the seat map for a specific flight and cabin class in the admin panel, showing booked, occupied, exit, and window seats with appropriate styling and providing insights into seat availability.
// Admin seat map viewer
async function loadAdminSeatMap(cabin){
  S.adminSeatCabin=cabin;
  const fid=S.adminFlightId;
  if(!fid){toast('No flight ID set','warning');return;}
  const el=document.getElementById('sv-body');
  el.innerHTML='<div class="spinner"></div>';
  const res=await GET(`/api/admin/seat-map/${fid}/${cabin}`);
  if(!res.ok){el.innerHTML='<p>Error loading seat map</p>';return;}
  const{seats,config}=res.seat_map; const cols=config.cols; const mid=Math.floor(cols.length/2);
  let html='<div class="seat-map-wrap" style="padding:1rem"><div class="seat-grid">';
  html+='<div class="seat-row"><div class="seat-rnum"></div>';
  for(let ci=0;ci<cols.length;ci++){
    if(ci===mid&&cols.length===6) html+='<div class="seat-gap"></div>';
    html+=`<div class="seat-chdr">${cols[ci]}</div>`;
  }
  html+='</div>';
  for(let r=1;r<=config.rows;r++){
    html+=`<div class="seat-row"><div class="seat-rnum">${r}</div>`;
    for(let ci=0;ci<cols.length;ci++){
      if(ci===mid&&cols.length===6) html+='<div class="seat-gap"></div>';
      const c=cols[ci],key=`${r}${c}`,s=seats[key]||{};
      let cls='seat';
      if(s.booked) cls+=' sbooked';
      else if(s.occupied) cls+=' socc';
      else if(s.exit) cls+=' sexit';
      else if(s.window) cls+=' swin';
      const title=s.booked?`${key} — ${s.passenger} (${s.pnr})`:s.occupied?`${key} — Occupied`:`${key}`;
      html+=`<div class="${cls}" title="${title}" style="cursor:default;font-size:.55rem">${s.booked?(s.pnr||'BKD').slice(0,4):s.exit?'🟢':key}</div>`;
    }
    html+='</div>';
  }
  html+='</div></div>';
  el.innerHTML=html;
  const booked=Object.values(seats).filter(s=>s.booked).length;
  const total=Object.keys(seats).length;
  el.insertAdjacentHTML('afterbegin',`<div class="flex-c gap-2 mb-2" style="padding:.75rem 1rem;background:var(--s2);border-radius:var(--r1)">
    <span style="font-size:.85rem;font-weight:600">${cabin.toUpperCase()} · ${booked} booked / ${total} total</span>
    <div style="flex:1;height:8px;background:var(--border);border-radius:99px;overflow:hidden">
      <div style="height:100%;width:${Math.round(booked/total*100)}%;background:var(--sky);border-radius:99px"></div>
    </div>
    <span style="font-size:.82rem;color:var(--t3)">${Math.round(booked/total*100)}% full</span>
  </div>`);
}
// Admin seat map viewer helper to show the seat map for a specific flight and cabin class in a modal, allowing admins to visualize seat availability and booking status effectively.
// Notification modal helpers
function onNotifTypeChange(){
  const t=document.getElementById('n-type')?.value;
  const dRow=document.getElementById('n-delay-row');
  if(dRow) dRow.style.display=(t==='delay'||t==='gate_change')?'block':'none';
}
// Handle sending notifications to passengers by collecting input values for notification type, flight ID, message, and delay, sending the notification data to the server, and providing feedback on success or failure while also updating the UI with the new notification.
async function sendNotification(){
  const type=document.getElementById('n-type')?.value||'general';
  const flight_id=document.getElementById('n-flight')?.value.trim();
  const message=document.getElementById('n-message')?.value.trim();
  const delay_min=parseInt(document.getElementById('n-delay')?.value||'0');
  if(!message){toast('Please enter a message','warning');return;}
  const res=await POST('/api/admin/notify',{type,flight_id,message,delay_min,target:flight_id||'all'});
  if(res.ok){
    closeModal('m-notify'); toast('Notification sent to passengers!','success');
    showNotifBar(res.notification);
    loadAdminTab(S.adminTab);
  } else toast(res.error||'Failed','danger');
}
//  Display a notification bar at the top of the page with details from the notification object, including type, message, affected flight (if any), and delay information, allowing users to see important updates in real-time.
function showNotifBar(n){
  const bar=document.getElementById('notif-bar');
  if(!bar) return;
  const icons={delay:'⏰',cancellation:'❌',gate_change:'🚪',boarding:'🛫',weather:'🌩',general:'📣'};
  bar.innerHTML=`<div class="notif-bar ${n.type}">
    <span>${icons[n.type]||'📣'}</span>
    <strong>${n.type.replace('_',' ').toUpperCase()}${n.flight_id?' · '+n.flight_id:''}</strong>
    ${n.delay_min>0?`<span>· +${n.delay_min} min delay</span>`:''}
    <span>—</span><span>${n.message}</span>
    <button onclick="this.parentElement.parentElement.style.display='none'" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:1rem">✕</button>
  </div>`;
  bar.style.display='block';
}
//
// AUTH
function renderLogin(){
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">
      <div class="auth-plane">✈</div>
      <div class="auth-title">Welcome Back</div>
      <div class="auth-sub">Sign in to your account</div>
    </div>
    <div id="pw-section">
      <div class="mb-2"><label class="form-label">Email Address</label>
        <input type="email" id="l-email" class="form-inp" placeholder="you@example.com" value="demo@skyway.com"></div>
      <div class="mb-3"><label class="form-label">Password</label>
        <input type="password" id="l-pw" class="form-inp" placeholder="Your password" value="Demo@123"></div>
      <button class="btn btn-primary btn-lg btn-full mb-2" onclick="doLogin()">🔐 Sign In</button>
      <div style="text-align:center;margin:.7rem 0;color:var(--t4);font-size:.8rem">— or —</div>
      <button class="btn btn-outline btn-full mb-3" onclick="showOtp()">📱 Sign In with OTP</button>
      <div style="text-align:center"><a href="#" onclick="nav('register')" style="color:var(--sky);font-weight:600;font-size:.88rem">Create new account →</a></div>
      <p class="text-muted mt-2" style="text-align:center;font-size:.73rem">
        User: demo@skyway.com / Demo@123<br>Admin: admin@skyway.com / Admin@123
      </p>
    </div>
    <div id="otp-section" style="display:none">
      <div class="mb-3"><label class="form-label">Phone or Email</label>
        <input type="text" id="l-contact" class="form-inp" placeholder="+91 9876543210 or email@..."></div>
      <button class="btn btn-primary btn-full mb-3" onclick="sendOtp()">📤 Send OTP</button>
      <div id="otp-verify" style="display:none">
        <p style="text-align:center;font-size:.83rem;color:var(--t3);margin-bottom:.7rem">Enter the 6-digit OTP</p>
        <div class="otp-row">
          ${[1,2,3,4,5,6].map(i=>`<input class="otp-box" maxlength="1" id="o${i}" oninput="otpFwd(this,'o${i<6?i+1:6}')" onkeydown="otpBk(event,'o${i>1?i-1:1}')">`).join('')}
        </div>
        <button class="btn btn-success btn-full mt-1" onclick="verifyOtp()">✅ Verify OTP</button>
      </div>
      <button class="btn btn-sec btn-full mt-2" onclick="showPw()">← Use Password Instead</button>
    </div>
    <div id="auth-msg"></div>
  </div></div>`;
}
// Render the registration form with fields for full name, phone number, email, password, and confirm password, along with buttons to continue with OTP or navigate to the login page, providing a user-friendly interface for new users to create an account.
function renderRegister(){
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">
      <div class="auth-plane">🛫</div>
      <div class="auth-title">Create Account</div>
      <div class="auth-sub">Join SkyWay — it's free!</div>
    </div>
    <div id="reg-s1">
      <div class="form-grid mb-3">
        <div><label class="form-label">Full Name</label><input type="text" id="r-name" class="form-inp" placeholder="Arjun Kumar"></div>
        <div><label class="form-label">Phone Number</label><input type="tel" id="r-phone" class="form-inp" placeholder="+91 9876543210"></div>
        <div class="form-full"><label class="form-label">Email Address</label><input type="email" id="r-email" class="form-inp" placeholder="you@example.com"></div>
        <div><label class="form-label">Password</label><input type="password" id="r-pw" class="form-inp" placeholder="Min 8 characters"></div>
        <div><label class="form-label">Confirm Password</label><input type="password" id="r-pw2" class="form-inp" placeholder="Repeat password"></div>
      </div>
      <button class="btn btn-primary btn-lg btn-full mb-3" onclick="sendRegOtp()">📱 Continue with OTP</button>
      <div style="text-align:center"><a href="#" onclick="nav('login')" style="color:var(--sky);font-weight:600;font-size:.88rem">Already have an account? Sign in →</a></div>
    </div>
    <div id="reg-s2" style="display:none">
      <div class="alert alert-info mb-3"><span class="alert-icon">📱</span>OTP sent! Check the server console for the code (demo mode).</div>
      <div class="otp-row">
        ${[1,2,3,4,5,6].map(i=>`<input class="otp-box" maxlength="1" id="ro${i}" oninput="otpFwd(this,'ro${i<6?i+1:6}')" onkeydown="otpBk(event,'ro${i>1?i-1:1}')">`).join('')}
      </div>
      <button class="btn btn-success btn-lg btn-full mt-2" onclick="completeReg()">✅ Verify &amp; Create Account</button>
    </div>
    <div id="reg-msg"></div>
  </div></div>`;
}

function showOtp(){ document.getElementById('pw-section').style.display='none'; document.getElementById('otp-section').style.display='block'; }
function showPw(){  document.getElementById('pw-section').style.display='block'; document.getElementById('otp-section').style.display='none'; }
function otpFwd(el,nid){ if(el.value.length===1){ const n=document.getElementById(nid); if(n) n.focus(); } }
function otpBk(e,pid){ if(e.key==='Backspace'&&!e.target.value){ const p=document.getElementById(pid); if(p){p.focus();p.value='';} } }
function authMsg(msg,type,id='auth-msg'){
  const el=document.getElementById(id);
  const icons={success:'✅',danger:'❌',info:'ℹ',warning:'⚠'};
  if(el) el.innerHTML=`<div class="alert alert-${type} mt-2"><span class="alert-icon">${icons[type]||'ℹ'}</span>${msg}</div>`;
}
// Handle user login by collecting email and password input values, sending them to the server for authentication, and providing feedback on success or failure while also updating the UI and navigating to the appropriate page based on user role.
async function doLogin(){
  const email=document.getElementById('l-email')?.value;
  const pw=document.getElementById('l-pw')?.value;
  const res=await POST('/api/login',{email,password:pw});
  if(res.ok){
    const me=await GET('/api/me'); S.user=me.user; updateNav();
    toast(`Welcome back, ${S.user.name.split(' ')[0]}!`,'success');
    // Admin goes to admin panel, users go to bookings
    nav(S.user.role==='admin'?'admin':'bookings');
  } else authMsg(res.error,'danger');
}
// Handle sending an OTP for login by collecting the contact information (phone or email), sending it to the server to generate and send the OTP, and providing feedback on success or failure while also updating the UI to show the OTP verification section.
async function sendOtp(){
  const contact=document.getElementById('l-contact')?.value;
  const res=await POST('/api/send-otp',{contact});
  if(res.ok){ document.getElementById('otp-verify').style.display='block'; authMsg(`OTP sent! (Demo: ${res.otp})`,'success'); }
  else authMsg(res.error,'danger');
}
// Handle verifying the OTP for login by collecting the contact information and OTP input values, sending them to the server for verification, and providing feedback on success or failure while also updating the UI and navigating to the appropriate page based on user role if successful.
async function verifyOtp(){
  const contact=document.getElementById('l-contact')?.value;
  const otp=[1,2,3,4,5,6].map(i=>document.getElementById(`o${i}`)?.value||'').join('');
  const res=await POST('/api/verify-otp',{contact,otp});
  if(res.ok){ const me=await GET('/api/me'); S.user=me.user; updateNav(); toast('Signed in!','success'); nav(S.user.role==='admin'?'admin':'bookings'); }
  else authMsg(res.error,'danger');
}
// Handle sending an OTP for registration by collecting user input values for name, phone, email, and password, validating the inputs, sending them to the server to generate and send the OTP, and providing feedback on success or failure while also updating the UI to show the OTP verification section if successful.
async function sendRegOtp(){
  const name=document.getElementById('r-name')?.value?.trim();
  const phone=document.getElementById('r-phone')?.value?.trim();
  const email=document.getElementById('r-email')?.value?.trim();
  const pw=document.getElementById('r-pw')?.value;
  const pw2=document.getElementById('r-pw2')?.value;
  if(!name||!phone||!email||!pw){authMsg('Please fill all fields','danger','reg-msg');return;}
  if(pw!==pw2){authMsg('Passwords do not match','danger','reg-msg');return;}
  if(pw.length<8){authMsg('Password must be ≥ 8 characters','danger','reg-msg');return;}
  const res=await POST('/api/register-otp',{name,phone,email,password:pw});
  if(res.ok){ document.getElementById('reg-s1').style.display='none'; document.getElementById('reg-s2').style.display='block'; authMsg(`OTP sent! (Demo: ${res.otp})`,'success','reg-msg'); }
  else authMsg(res.error,'danger','reg-msg');
}
// Handle completing the registration process by collecting the email and OTP input values, sending them to the server for verification and account creation, and providing feedback on success or failure while also updating the UI and navigating to the bookings page if successful.
async function completeReg(){
  const email=document.getElementById('r-email')?.value?.trim();
  const otp=[1,2,3,4,5,6].map(i=>document.getElementById(`ro${i}`)?.value||'').join('');
  const res=await POST('/api/register-verify',{email,otp});
  if(res.ok){ const me=await GET('/api/me'); S.user=me.user; updateNav(); toast('Welcome to SkyWay!','success'); nav('bookings'); }
  else authMsg(res.error,'danger','reg-msg');
}
// Handle user logout by sending a request to the server to end the session, clearing the user data from the client-side state, updating the navigation, providing feedback on successful logout, and navigating back to the home page.
async function doLogout(){
  await POST('/api/logout'); S.user=null; updateNav(); toast('Signed out','info'); nav('home');
}
// CANCEL / RESCHEDULE
function openCancel(bid,reason,refundPct){
  const body=document.getElementById('m-cancel-body');
  body.innerHTML=`
    <div class="alert alert-warning mb-2"><span class="alert-icon">⚠</span>${reason}</div>
    ${refundPct>0?`<div class="alert alert-success mb-2"><span class="alert-icon">💰</span>Refund: ${refundPct}% credited within 5–7 business days</div>`:''}
    <p class="mb-2">Cancel PNR <strong>${S.currentBk?.pnr}</strong>?</p>`;
  const btn=document.getElementById('btn-cancel-confirm');
  btn.style.display=''; btn.textContent='Confirm Cancellation'; btn.className='btn btn-danger btn-full';
  btn.onclick=async()=>{
    const res=await POST('/api/cancel',{booking_id:bid});
    if(res.ok){closeModal('m-cancel');toast(`Cancelled. ${res.refund_pct}% refund initiated.`,'success');nav('bookings');}
    else toast(res.error,'danger');
  };
  document.getElementById('m-cancel').classList.add('open');
}
// Handle opening the reschedule modal by displaying the reason for rescheduling, setting the minimum date for the new travel date, and attaching an event listener to the confirm button to send the new date and time to the server for processing, while providing feedback on success or failure and updating the UI accordingly.
function openReschedule(bid,reason){
  document.getElementById('m-reschedule-body').innerHTML=`<div class="alert alert-warning mb-3"><span class="alert-icon">⚠</span>${reason}</div>`;
  const minDate=new Date(); minDate.setDate(minDate.getDate()+1);
  document.getElementById('r-new-date').min=minDate.toISOString().slice(0,10);
  document.getElementById('r-new-date').value=''; document.getElementById('r-new-time').value='';
  document.getElementById('btn-reschedule-confirm').onclick=async()=>{
    const nd=document.getElementById('r-new-date')?.value;
    const nt=document.getElementById('r-new-time')?.value;
    if(!nd){toast('Please select a new date','warning');return;}
    const res=await POST('/api/reschedule',{booking_id:bid,new_date:nd,new_dep:nt});
    if(res.ok){closeModal('m-reschedule');toast('Rescheduled! ₹750 fee charged.','success');nav('booking',{bookingId:bid});}
    else toast(res.error,'danger');
  };
  document.getElementById('m-reschedule').classList.add('open');
}

// NOTIFICATIONS (user-facing)
async function checkNotifications(){
  const res=await GET('/api/notifications');
  if(!res.ok) return;
  const notifs=res.notifications||[];
  if(!notifs.length) return;
  // Show the latest one in the bar
  const latest=notifs[0];
  showNotifBar(latest);
}

// INIT
async function init(){
  const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  S.sp.date=tomorrow.toISOString().slice(0,10);
  const me=await GET('/api/me');
  if(me.ok){ S.user=me.user; updateNav(); }
  // Check for any active notifications
  await checkNotifications();
  nav('home');
  // Poll notifications every 30s for logged-in users
  setInterval(async()=>{ if(S.user) await checkNotifications(); },30000);
}

init();