#!/usr/bin/env python3
"""
SkyWay Flight Booking System v3
Run:    python3 app.py
Open:   http://localhost:8765
Demo:   demo@skyway.com / Demo@123
Admin:  admin@skyway.com / Admin@123
Needs:  pip install reportlab
"""
#create a app.py for flight ticket booking system with below features:
# - Search flights between airports on specific dates and round trips with proper pricing with different classes (economy, business, first)
# - View flight details, seat map, meal options, and special services 
# - Book flights with passenger details, seat selection, meal preferences, and additional services of extra baggage, wheeelchair requirement ,veg meal,infant in lap, priority boarding, lounge access etc
# - Manage bookings: view, cancel (with refund rules), reschedule (with fee rules), and check-in (with time restrictions) and mock payment with card or upi
# - Admin panel: view all bookings, manage flight status updates, send notifications to users, and view revenue reports

import json, hashlib, random, string, os, io, time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import mm

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_FILE    = os.path.join(BASE_DIR, "db.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# ── Static data ────────────────────────────────────────────────────────────────
AIRPORTS = {
    "DEL":("Indira Gandhi Intl","New Delhi","IN"),
    "BOM":("Chhatrapati Shivaji Intl","Mumbai","IN"),
    "MAA":("Chennai International","Chennai","IN"),
    "BLR":("Kempegowda International","Bengaluru","IN"),
    "CCU":("Netaji Subhas Chandra Bose","Kolkata","IN"),
    "HYD":("Rajiv Gandhi International","Hyderabad","IN"),
    "COK":("Cochin International","Kochi","IN"),
    "PNQ":("Pune Airport","Pune","IN"),
    "DXB":("Dubai International","Dubai","AE"),
    "SIN":("Changi Airport","Singapore","SG"),
    "LHR":("Heathrow Airport","London","GB"),
    "JFK":("John F. Kennedy Intl","New York","US"),
}

AIRLINES = {
    "6E":{"name":"IndiGo","color":"#1a56db"},
    "AI":{"name":"Air India","color":"#c0392b"},
    "SG":{"name":"SpiceJet","color":"#e84118"},
    "UK":{"name":"Vistara","color":"#6c3483"},
    "EK":{"name":"Emirates","color":"#c0392b"},
    "IX":{"name":"Air India Express","color":"#1e3799"},
}

ROUTE_TIMES = {
    ("DEL","BOM"):130,("DEL","MAA"):170,("DEL","BLR"):165,("DEL","CCU"):120,
    ("DEL","HYD"):135,("DEL","COK"):195,("DEL","PNQ"):115,("DEL","DXB"):215,
    ("DEL","SIN"):345,("DEL","LHR"):540,("DEL","JFK"):840,
    ("BOM","MAA"):100,("BOM","BLR"):85,("BOM","CCU"):150,("BOM","HYD"):90,
    ("BOM","DXB"):195,("BOM","SIN"):300,("MAA","SIN"):255,("MAA","DXB"):240,
    ("BLR","SIN"):240,("HYD","DXB"):220,("COK","DXB"):210,("CCU","SIN"):270,
}

MEAL_MENUS = {
    "economy":[
        {"id":"none","name":"No Meal","desc":"I'll eat at the airport","price":0},
        {"id":"veg","name":"Vegetarian","desc":"Paneer / Dal / Rice / Salad","price":350},
        {"id":"nonveg","name":"Non-Veg Meal","desc":"Chicken Curry / Rice / Salad","price":400},
        {"id":"jain","name":"Jain Meal","desc":"No root vegetables, pure Jain","price":380},
        {"id":"diabetic","name":"Diabetic Meal","desc":"Low-sugar, high-fibre","price":420},
        {"id":"vegan","name":"Vegan Meal","desc":"100% plant-based","price":380},
    ],
    "business":[
        {"id":"none","name":"No Preference","desc":"Crew's choice","price":0},
        {"id":"veg_gourmet","name":"Gourmet Veg","desc":"3-course vegetarian fine dining","price":0},
        {"id":"nonveg_gourmet","name":"Gourmet Non-Veg","desc":"Grilled chicken / seafood","price":0},
        {"id":"vegan_biz","name":"Vegan Platter","desc":"Premium plant-based 3-course","price":0},
    ],
    "first":[
        {"id":"none","name":"No Preference","desc":"Personalised by crew","price":0},
        {"id":"chef","name":"Chef's Table","desc":"5-course degustation menu","price":0},
        {"id":"veg_chef","name":"Veg Chef's Table","desc":"Premium plant-based degustation","price":0},
    ],
}

SPECIAL_SERVICES = [
    {"id":"none","name":"None","price":0},
    {"id":"wheelchair","name":"Wheelchair Assistance","price":0},
    {"id":"extra_bag","name":"Extra Baggage (15 kg)","price":1500},
    {"id":"sport_bag","name":"Sports Equipment","price":2000},
    {"id":"infant","name":"Infant in Lap (under 2 yrs)","price":500},
    {"id":"priority","name":"Priority Boarding","price":350},
    {"id":"lounge","name":"Airport Lounge Access","price":1200},
]

NOTIFICATION_TYPES = [
    "delay","cancellation","gate_change","boarding","weather","general"
]
#database connection
# ── DB ─────────────────────────────────────────────────────────────────────────
def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE) as f: return json.load(f)
    return _init_db()

def save_db(db):
    with open(DB_FILE,"w") as f: json.dump(db,f,indent=2,default=str)

def _init_db():
    db={
        "users":{
            "demo@skyway.com":{
                "name":"Arjun Kumar","email":"demo@skyway.com",
                "phone":"+91 98765 43210","dob":"1990-05-15","gender":"Male",
                "passport":"Z1234567","nationality":"Indian",
                "password_hash":hashlib.sha256("Demo@123".encode()).hexdigest(),
                "bookings":[],"verified":True,"role":"user",
                "created_at":datetime.now().isoformat(),
            },
            "admin@skyway.com":{
                "name":"SkyWay Admin","email":"admin@skyway.com",
                "phone":"+91 99999 00000","dob":"","gender":"","passport":"","nationality":"",
                "password_hash":hashlib.sha256("Admin@123".encode()).hexdigest(),
                "bookings":[],"verified":True,"role":"admin",
                "created_at":datetime.now().isoformat(),
            },
        },
        "sessions":{},"otps":{},"bookings":{},"booking_counter":1000,
        "notifications":[],"flight_status":{},"revenue":{"total":0,"transactions":[]},
    }
    save_db(db); return db
# implement booking flow with passenger details, seat selection, meal preferences, and additional services of extra baggage, wheelchair requirement, veg meal, infant in lap, priority boarding, lounge access etc. also implement manage bookings features like view, cancel (with refund rules), reschedule (with fee rules), and check-in (with time restrictions). and also for the admin panel, implement features to view all bookings, manage flight status updates, send notifications to users, and view revenue reports. ensure all business rules are enforced and edge cases handled properly.
# ── Flight generation ──────────────────────────────────────────────────────────
def get_dur(o,d): return ROUTE_TIMES.get((o,d),ROUTE_TIMES.get((d,o),160))
# Generate mock flight data based on origin, destination, and date with realistic departure times, durations, prices for different classes, seat availability, and other details while ensuring consistency for the same inputs and incorporating any admin-set status or delays.
def generate_flights(origin,dest,date_str):
    if origin==dest: return []
    random.seed(f"{origin}{dest}{date_str}")
    dur=get_dur(origin,dest); base=random.randint(3200,14000)
    al_keys=list(AIRLINES.keys())
    chosen=sorted(random.sample(["04:45","06:00","07:30","09:15","11:00","13:30",
                                  "15:00","17:00","18:45","20:30","22:15"],min(6,11)))
    flights=[]
    for i,dep in enumerate(chosen):
        dh,dm=map(int,dep.split(":")); am=dh*60+dm+dur
        arr=f"{(am//60)%24:02d}:{am%60:02d}"; nd=am>=1440
        al=al_keys[i%len(al_keys)]; num=f"{al}{random.randint(100,999)}"
        mult=1+i*.07+random.uniform(-.04,.13); eco=int(base*mult)
        biz=int(eco*random.uniform(2.8,4.2)); first=int(eco*random.uniform(5.5,8.5)) if dur>90 else None
        flights.append({
            "id":f"{num}_{date_str}","number":num,"airline":al,
            "airline_name":AIRLINES[al]["name"],"airline_color":AIRLINES[al]["color"],
            "origin":origin,"dest":dest,"dep":dep,"arr":arr,"next_day":nd,"duration":dur,
            "prices":{"economy":eco,"business":biz,"first":first},
            "seats":{"economy":random.randint(10,180),"business":random.randint(2,30),
                     "first":random.randint(0,8) if first else 0},
            "refundable":random.choice([True,True,False]),
            "meals_avail":random.choice([True,True,False]),
            "baggage":{"economy":"15 kg","business":"35 kg","first":"50 kg"},
            "stops":0 if dur<300 else 1,"date":date_str,
        })
    return flights
# Generate a seat map for a given flight and cabin class with realistic occupancy rates, exit rows, window/aisle seats, and price additions while ensuring consistency for the same flight and cabin inputs.
def generate_seat_map(flight_id,cabin):
    random.seed(flight_id+cabin)
    cfg={"economy":{"rows":30,"cols":"ABCDEF","occ":.62},
         "business":{"rows":6,"cols":"ABCD","occ":.38},
         "first":{"rows":3,"cols":"AB","occ":.25}}.get(cabin,{"rows":30,"cols":"ABCDEF","occ":.62})
    EXIT={10,20} if cabin=="economy" else set()
    seats={}
    for r in range(1,cfg["rows"]+1):
        for c in cfg["cols"]:
            k=f"{r}{c}"; ie=r in EXIT; iw=c in[cfg["cols"][0],cfg["cols"][-1]]
            ia=c in(["C","D"] if len(cfg["cols"])==6 else["B","C"])
            occ=random.random()<cfg["occ"]
            add=600 if ie else(250 if iw else(150 if ia else 0))
            seats[k]={"occupied":occ,"exit":ie,"window":iw,"aisle":ia,"price_add":add}
    return {"seats":seats,"config":cfg}

# ── Rules ──────────────────────────────────────────────────────────────────────
def _hrs(b):
    try: return (datetime.strptime(f"{b['travel_date']} {b.get('dep','00:00')}","%Y-%m-%d %H:%M")-datetime.now()).total_seconds()/3600
    except: return -999
# Implement business rules for cancellation, rescheduling, and check-in based on booking status, time to departure, fare conditions, and other factors while providing appropriate messages and refund/fee percentages.
def can_cancel(b):
    h=_hrs(b); s=b.get("status","confirmed")
    if s in("cancelled","checked_in"): return False,f"Booking is already {s}",0
    if b.get("non_refundable"): return False,"Non-refundable ticket",0
    if h<0:  return False,"Flight has already departed",0
    if h<2:  return False,"Cannot cancel within 2 hours of departure",0
    if h<24: return True,"Late cancellation — 10% refund",10
    if h<72: return True,"Cancellation within 72h — 50% refund",50
    if not b.get("refundable",True): return True,"Non-refundable fare — ₹300 fee, no refund",0
    return True,"Full cancellation — 90% refund (minus ₹300 fee)",90
# Implement business rules for rescheduling based on booking status, time to departure, fare conditions, and other factors while providing appropriate messages and fee percentages.
def can_reschedule(b):
    h=_hrs(b); s=b.get("status","confirmed")
    if s=="cancelled": return False,"Booking is cancelled"
    if s=="checked_in": return False,"Already checked in"
    if h<4: return False,"Cannot reschedule within 4 hours of departure"
    return True,"Reschedule fee ₹750 + fare difference applies"
# Implement business rules for check-in based on booking status, time to departure, and other factors while providing appropriate messages about check-in availability and restrictions.
def can_checkin(b):
    h=_hrs(b); s=b.get("status","confirmed")
    if s=="cancelled": return False,"Booking is cancelled"
    if s=="checked_in": return False,"Already checked in"
    if h>48: return False,"Check-in opens 48h before departure"
    if h<1:  return False,"Check-in closed (less than 1h to departure)"
    return True,"Check-in is open"

# ── Auth ───────────────────────────────────────────────────────────────────────
gen_sid = lambda: ''.join(random.choices(string.ascii_letters+string.digits,k=32))
gen_otp = lambda: str(random.randint(100000,999999))
gen_pnr = lambda: ''.join(random.choices(string.ascii_uppercase+string.digits,k=6))
hash_pw = lambda p: hashlib.sha256(p.encode()).hexdigest()
ok_email= lambda e: "@" in e and "." in e.split("@")[-1] and len(e)>=5
ok_pw   = lambda p: len(p)>=8
# Implement user authentication with OTP login, secure password handling, session management with expiration, and input validation for registration and login while providing appropriate feedback messages for success and failure cases.
def get_user(db,cookies):
    sid=None
    for p in (cookies or "").split(";"):
        p=p.strip()
        if p.startswith("session="): sid=p[8:]
    if not sid: return None
    sess=db["sessions"].get(sid)
    if not sess or time.time()-sess["created"]>86400: return None
    return db["users"].get(sess["email"])

def is_admin(user): return user and user.get("role")=="admin"
#add a download ticket and boarding pass button that generates a PDF with the booking details and a QR code for check-in.
# ── PDF ────────────────────────────────────────────────────────────────────────
def gen_pdf(b):
    buf=io.BytesIO(); W,H=210*mm,99*mm
    c=pdfcanvas.Canvas(buf,pagesize=(W,H))
    # Background
    c.setFillColorRGB(.05,.10,.25); c.rect(0,0,W,H,fill=1,stroke=0)
    # Left colour strip
    c.setFillColorRGB(.20,.60,1.0); c.rect(0,0,4*mm,H,fill=1,stroke=0)
    # White main panel
    c.setFillColorRGB(1,1,1); c.roundRect(8*mm,5*mm,140*mm,89*mm,3*mm,fill=1,stroke=0)
    # Stub background
    c.setFillColorRGB(.95,.97,1.0); c.roundRect(152*mm,5*mm,54*mm,89*mm,3*mm,fill=1,stroke=0)
    #Tear-line
    c.setStrokeColorRGB(.70,.80,.90); c.setDash([3,3]); c.line(150*mm,8*mm,150*mm,91*mm); c.setDash()
    # Airline name
    c.setFillColorRGB(.05,.10,.25); c.setFont("Helvetica-Bold",15); c.drawString(14*mm,82*mm,b.get("airline_name","SkyWay").upper())
    c.setFont("Helvetica",8); c.setFillColorRGB(.45,.55,.70); c.drawString(14*mm,78*mm,f"Flight {b['flight_number']}  ·  {b['cabin'].upper()} CLASS")
     # Status badge
    sc={"confirmed":(.10,.70,.40),"checked_in":(.20,.60,1.0),"cancelled":(.85,.25,.25)}.get(b["status"],(.10,.70,.40))
    c.setFillColorRGB(*sc); c.roundRect(100*mm,76*mm,36*mm,8*mm,2*mm,fill=1,stroke=0)
    c.setFillColorRGB(1,1,1); c.setFont("Helvetica-Bold",7); c.drawCentredString(118*mm,79*mm,b["status"].upper().replace("_"," "))
    # City codes
    c.setFillColorRGB(.05,.10,.25); c.setFont("Helvetica-Bold",30)
    c.drawString(14*mm,57*mm,b["origin"]); c.drawRightString(144*mm,57*mm,b["dest"])
    # Arrow
    c.setStrokeColorRGB(.20,.60,1.0); c.setFillColorRGB(.20,.60,1.0); c.setLineWidth(1.5); c.line(50*mm,63*mm,110*mm,63*mm)
    p=c.beginPath(); p.moveTo(110*mm,65*mm); p.lineTo(114*mm,63*mm); p.lineTo(110*mm,61*mm); p.close(); c.drawPath(p,fill=1,stroke=0)
    c.setFont("Helvetica",7); c.setFillColorRGB(.40,.50,.70); c.drawCentredString(79*mm,65.5*mm,"Non-Stop" if b.get("stops",0)==0 else f"{b.get('stops',1)} Stop")
    # City names
    c.setFont("Helvetica",8); c.drawString(14*mm,54*mm,AIRPORTS.get(b["origin"],("","",""))[1]); c.drawRightString(144*mm,54*mm,AIRPORTS.get(b["dest"],("","",""))[1])
    # Times
    c.setFont("Helvetica-Bold",13); c.setFillColorRGB(.05,.10,.25); c.drawString(14*mm,47*mm,b.get("dep","--:--")); c.drawRightString(144*mm,47*mm,b.get("arr","--:--"))
     # Divider
    c.setStrokeColorRGB(.85,.90,.95); c.setLineWidth(.5); c.line(14*mm,43*mm,144*mm,43*mm)
    # Passenger details row
    ph=sum(ord(ch) for ch in b["pnr"]); pn=(b["passengers"][0][:16] if b.get("passengers") else "—")
    for items,yt,yb,st in[([("DATE",b["travel_date"]),("PASSENGER",pn),("SEAT",b.get("seat","Auto")),("CABIN",b["cabin"].upper()),("PNR",b["pnr"])],38,33,26),
                           ([("BAGGAGE",b.get("baggage","15 kg")),("MEAL",b.get("pre_meal","Std")),("GATE",f"B{(ph%20)+1}"),("TERMINAL",f"T{(ph%3)+1}")],26,21,35)]:
        x=14*mm
        for lbl,val in items:
            c.setFont("Helvetica",6); c.setFillColorRGB(.50,.60,.70); c.drawString(x,yt*mm,lbl)
            c.setFont("Helvetica-Bold",8); c.setFillColorRGB(.05,.10,.25); c.drawString(x,yb*mm,str(val)[:14]); x+=st*mm
    #footer
    c.setFont("Helvetica",5); c.setFillColorRGB(.50,.60,.70); c.drawCentredString(79*mm,9*mm,"SKYWAY AIRLINES  ·  skyway.aero  ·  1800-SKYWAY")
    #stub
    c.setFillColorRGB(.05,.10,.25); c.setFont("Helvetica-Bold",12); c.drawCentredString(179*mm,82*mm,b["pnr"])
    c.setFont("Helvetica",7); c.setFillColorRGB(.40,.50,.70); c.drawCentredString(179*mm,78*mm,"BOOKING REF")
    # QR pattern
    qx,qy,cell=161*mm,30*mm,3.0*mm
    pat=[[1,1,1,1,1,1,1,0,1,0],[1,0,0,0,0,0,1,0,0,1],[1,0,1,1,1,0,1,0,1,0],[1,0,1,1,1,0,1,0,0,1],
         [1,0,1,1,1,0,1,0,1,1],[1,0,0,0,0,0,1,0,0,0],[1,1,1,1,1,1,1,0,1,0],[0,0,0,0,0,0,0,0,1,1],
         [1,0,1,0,1,1,1,0,0,1],[0,1,0,1,0,0,0,1,0,1]]
    c.setFillColorRGB(.05,.10,.25)
    for ri,row in enumerate(pat):
        for ci,v in enumerate(row):
            if v: c.rect(qx+ci*cell,qy+(9-ri)*cell,cell*.85,cell*.85,fill=1,stroke=0)
    # 
    c.setFont("Helvetica",6); c.setFillColorRGB(.40,.50,.70)
    c.drawCentredString(179*mm,26*mm,b["flight_number"]); c.drawCentredString(179*mm,22*mm,b["travel_date"])
    c.drawCentredString(179*mm,18*mm,f"{b['origin']} > {b['dest']}")
    c.save(); return buf.getvalue()
# include proper api calls:get,post,put,delete for admin panel,revenue collection,delays,searching flights, viewing details, booking, managing bookings, and generating tickets. ensure all business rules are enforced and edge cases handled..
#include otp login for user authentication and session management. implement secure password handling and session expiration. also add input validation and error handling for all API endpoints.
#include profile details of user and allow them to update their information and view their booking history.
# ── HTTP Handler ───────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def _db(self):       return load_db()
    def _user(self,db):  return get_user(db,self.headers.get("Cookie",""))

    def _html(self,html,code=200):
        d=html.encode(); self.send_response(code)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d)

    def _json(self,obj,code=200):
        d=json.dumps(obj).encode(); self.send_response(code)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d)

    def _redirect(self,url,cookie=None):
        self.send_response(302)
        if cookie: self.send_header("Set-Cookie",cookie)
        self.send_header("Location",url); self.end_headers()

    def _body(self):
        n=int(self.headers.get("Content-Length",0)); raw=self.rfile.read(n)
        try: return json.loads(raw)
        except: return {}

    def _cookie(self,sid):
        return f"session={sid}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax"

    def _session_resp(self,db,email,extra=None):
        sid=gen_sid(); db["sessions"][sid]={"email":email,"created":time.time()}; save_db(db)
        d=json.dumps({"ok":True,**(extra or {})}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json")
        self.send_header("Set-Cookie",self._cookie(sid))
        self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d)

    def _serve_static(self,rel):
        fp=os.path.join(STATIC_DIR,rel.lstrip("/"))
        if not os.path.exists(fp): self._html("<h1>404</h1>",404); return
        ext=fp.rsplit(".",1)[-1].lower()
        mime={"css":"text/css","js":"application/javascript","png":"image/png","jpg":"image/jpeg",
              "jpeg":"image/jpeg","ico":"image/x-icon","svg":"image/svg+xml","html":"text/html"}.get(ext,"application/octet-stream")
        with open(fp,"rb") as f: data=f.read()
        self.send_response(200); self.send_header("Content-Type",mime)
        self.send_header("Content-Length",str(len(data))); self.send_header("Cache-Control","public,max-age=60")
        self.end_headers(); self.wfile.write(data)
    #GET--handle all the get requests for searching flights, viewing details, booking, managing bookings, generating tickets, and admin panel features while ensuring all business rules are enforced and edge cases handled properly.
    def do_GET(self):
        parsed=urlparse(self.path); path=parsed.path; qs=parse_qs(parsed.query)
        if path.startswith("/static/"): self._serve_static(path[7:]); return
        db=self._db(); user=self._user(db)

        if path=="/api/flights":
            o=qs.get("origin",["DEL"])[0]; d=qs.get("dest",["BOM"])[0]
            dt=qs.get("date",[datetime.now().strftime("%Y-%m-%d")])[0]
            flights=generate_flights(o,d,dt)
            # Attach any admin-set status/delays
            for f in flights:
                fs=db["flight_status"].get(f["id"],{})
                f["admin_status"]=fs.get("status",""); f["delay_min"]=fs.get("delay_min",0)
                f["status_msg"]=fs.get("message","")
            self._json(flights); return

        if path=="/api/seat-map":
            self._json(generate_seat_map(qs.get("flight_id",[""])[0],qs.get("cabin",["economy"])[0])); return

        if path=="/api/meal-options":
            cabin=qs.get("cabin",["economy"])[0]; self._json(MEAL_MENUS.get(cabin,MEAL_MENUS["economy"])); return

        if path=="/api/special-services": self._json(SPECIAL_SERVICES); return

        if path=="/api/airports":
            self._json({k:{"name":v[0],"city":v[1],"country":v[2]} for k,v in AIRPORTS.items()}); return

        if path=="/api/me":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            safe={k:v for k,v in user.items() if k!="password_hash"}
            self._json({"ok":True,"user":safe}); return

        if path=="/api/bookings":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            bks=[db["bookings"][bid] for bid in user.get("bookings",[]) if bid in db["bookings"]]
            self._json({"ok":True,"bookings":bks}); return

        if path.startswith("/api/booking/"):
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            bid=path[13:]; bk=db["bookings"].get(bid)
            if not bk or bk["user_email"]!=user["email"]:
                self._json({"ok":False,"error":"Booking not found"},404); return
            cc,cr,cp=can_cancel(bk); cr2,rr=can_reschedule(bk); ci,cir=can_checkin(bk)
            self._json({"ok":True,"booking":bk,"can_cancel":cc,"cancel_reason":cr,"refund_pct":cp,
                        "can_reschedule":cr2,"reschedule_reason":rr,"can_checkin":ci,"checkin_reason":cir}); return

        if path.startswith("/api/ticket/"):
            if not user: self._html("<h1>Please log in</h1>",401); return
            bid=path[12:]; bk=db["bookings"].get(bid)
            if not bk or bk["user_email"]!=user["email"]: self._html("<h1>Not found</h1>",404); return
            pdf=gen_pdf(bk)
            self.send_response(200); self.send_header("Content-Type","application/pdf")
            self.send_header("Content-Disposition",f'attachment; filename="SkyWay_{bk["pnr"]}.pdf"')
            self.send_header("Content-Length",str(len(pdf))); self.end_headers(); self.wfile.write(pdf); return

        if path=="/api/notifications":
            self._json({"ok":True,"notifications":db.get("notifications",[])}); return

        # ── ADMIN GET routes ──────────────────────────────────────────────────
        if path=="/api/admin/stats":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            bks=list(db["bookings"].values())
            paid=[b for b in bks if b.get("payment_status")=="paid"]
            revenue=sum(b.get("total_amount",0) for b in paid)
            users_count=len([u for u in db["users"].values() if u.get("role")!="admin"])
            by_status={}
            for b in bks: by_status[b["status"]]=by_status.get(b["status"],0)+1
            by_airline={}
            for b in bks: by_airline[b.get("airline_name","Unknown")]=by_airline.get(b.get("airline_name","Unknown"),0)+1
            recent_txn=sorted(db.get("revenue",{}).get("transactions",[]),key=lambda x:x.get("at",""),reverse=True)[:10]
            self._json({"ok":True,"stats":{
                "total_bookings":len(bks),"paid_bookings":len(paid),
                "total_revenue":revenue,"total_users":users_count,
                "by_status":by_status,"by_airline":by_airline,
                "recent_transactions":recent_txn,
            }}); return

        if path=="/api/admin/bookings":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            bks=list(db["bookings"].values())
            bks.sort(key=lambda x:x.get("booked_at",""),reverse=True)
            self._json({"ok":True,"bookings":bks}); return

        if path=="/api/admin/users":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            users=[{k:v for k,v in u.items() if k!="password_hash"} for u in db["users"].values() if u.get("role")!="admin"]
            self._json({"ok":True,"users":users}); return

        if path.startswith("/api/admin/user-bookings/"):
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            email=path[25:]
            u=db["users"].get(email)
            if not u: self._json({"ok":False,"error":"User not found"}); return
            bks=[db["bookings"][bid] for bid in u.get("bookings",[]) if bid in db["bookings"]]
            safe_u={k:v for k,v in u.items() if k!="password_hash"}
            self._json({"ok":True,"user":safe_u,"bookings":bks}); return

        if path.startswith("/api/admin/seat-map/"):
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            # /api/admin/seat-map/<flight_id>/<cabin>
            parts=path[20:].split("/")
            fid="/".join(parts[:-1]) if len(parts)>1 else parts[0]
            cabin=parts[-1] if len(parts)>1 else "economy"
            sm=generate_seat_map(fid,cabin)
            # Overlay actually booked seats
            for bk in db["bookings"].values():
                if bk.get("flight_id")==fid and bk.get("cabin")==cabin and bk.get("status")!="cancelled":
                    seat=bk.get("seat","")
                    if seat in sm["seats"]:
                        sm["seats"][seat]["booked"]=True
                        sm["seats"][seat]["pnr"]=bk["pnr"]
                        sm["seats"][seat]["passenger"]=(bk.get("passengers") or ["?"])[0]
            self._json({"ok":True,"seat_map":sm}); return

        if path=="/api/admin/notifications":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            self._json({"ok":True,"notifications":db.get("notifications",[])}); return

        if path=="/api/admin/flight-status":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            self._json({"ok":True,"flight_status":db.get("flight_status",{})}); return

        # SPA fallback
        idx=os.path.join(STATIC_DIR,"index.html")
        if os.path.exists(idx):
            with open(idx,"rb") as f: data=f.read()
            self.send_response(200); self.send_header("Content-Type","text/html; charset=utf-8")
            self.send_header("Content-Length",str(len(data))); self.end_headers(); self.wfile.write(data)
        else:
            self._html("<h1>500: static/index.html not found</h1>",500)

    # ── POST ──────────────────────────────────────────────────────────────────
    def do_POST(self):
        path=urlparse(self.path).path; data=self._body(); db=self._db(); user=self._user(db)

        if path=="/api/login":
            email=data.get("email","").lower().strip(); pw=data.get("password","")
            if not email or not pw: self._json({"ok":False,"error":"Email and password required"}); return
            u=db["users"].get(email)
            if not u: self._json({"ok":False,"error":"No account found. Please register first."}); return
            if not u.get("password_hash"): self._json({"ok":False,"error":"This account uses a different login method."}); return
            if u["password_hash"]!=hash_pw(pw): self._json({"ok":False,"error":"Incorrect password."}); return
            self._session_resp(db,email,{"name":u["name"],"role":u.get("role","user")}); return

        if path=="/api/send-otp":
            contact=data.get("contact","").strip()
            if not contact: self._json({"ok":False,"error":"Enter phone or email"}); return
            found=next((u for u in db["users"].values() if u["email"]==contact or u.get("phone","")==contact),None)
            if not found: self._json({"ok":False,"error":"No account found"}); return
            otp=gen_otp(); db["otps"][contact]={"otp":otp,"email":found["email"],"created":time.time()}
            save_db(db); print(f"  [OTP] {contact} → {otp}")
            self._json({"ok":True,"otp":otp}); return

        if path=="/api/verify-otp":
            contact=data.get("contact","").strip(); otp=data.get("otp","").strip()
            rec=db["otps"].get(contact)
            if not rec or time.time()-rec["created"]>300: self._json({"ok":False,"error":"OTP expired"}); return
            if rec["otp"]!=otp: self._json({"ok":False,"error":"Incorrect OTP"}); return
            del db["otps"][contact]
            u=db["users"].get(rec["email"],{})
            self._session_resp(db,rec["email"],{"role":u.get("role","user")}); return

        if path=="/api/register-otp":
            name=data.get("name","").strip(); phone=data.get("phone","").strip()
            email=data.get("email","").lower().strip(); pw=data.get("password","")
            if not all([name,phone,email,pw]): self._json({"ok":False,"error":"All fields required"}); return
            if not ok_email(email): self._json({"ok":False,"error":"Invalid email"}); return
            if not ok_pw(pw): self._json({"ok":False,"error":"Password must be ≥ 8 characters"}); return
            if email in db["users"]: self._json({"ok":False,"error":"Account already exists. Sign in."}); return
            otp=gen_otp()
            db["otps"][f"reg_{email}"]={"otp":otp,"name":name,"phone":phone,"email":email,"password_hash":hash_pw(pw),"created":time.time()}
            save_db(db); print(f"  [REG OTP] {email} → {otp}")
            self._json({"ok":True,"otp":otp}); return

        if path=="/api/register-verify":
            email=data.get("email","").lower().strip(); otp=data.get("otp","").strip()
            key=f"reg_{email}"; rec=db["otps"].get(key)
            if not rec or time.time()-rec["created"]>600: self._json({"ok":False,"error":"OTP expired"}); return
            if rec["otp"]!=otp: self._json({"ok":False,"error":"Incorrect OTP"}); return
            if email in db["users"]: self._json({"ok":False,"error":"Account already exists"}); return
            db["users"][email]={"name":rec["name"],"email":email,"phone":rec["phone"],
                "dob":"","gender":"","passport":"","nationality":"","password_hash":rec["password_hash"],
                "bookings":[],"verified":True,"role":"user","created_at":datetime.now().isoformat()}
            del db["otps"][key]
            self._session_resp(db,email,{"name":rec["name"],"role":"user"}); return

        if path=="/api/profile":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            for k in["name","phone","dob","gender","passport","nationality"]:
                if k in data: db["users"][user["email"]][k]=data[k]
            save_db(db); self._json({"ok":True}); return

        if path=="/api/change-password":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            old=data.get("old_password",""); new=data.get("new_password","")
            if db["users"][user["email"]]["password_hash"]!=hash_pw(old):
                self._json({"ok":False,"error":"Current password incorrect"}); return
            if not ok_pw(new): self._json({"ok":False,"error":"Password must be ≥ 8 characters"}); return
            db["users"][user["email"]]["password_hash"]=hash_pw(new)
            save_db(db); self._json({"ok":True}); return

        if path=="/api/book":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            fid=data.get("flight_id",""); cabin=data.get("cabin","economy")
            seat=data.get("seat"); pax_list=data.get("passengers",[]); pax_n=max(1,int(data.get("pax",1)))
            origin=data.get("origin","DEL"); dest=data.get("dest","BOM")
            dep=data.get("dep","10:00"); arr=data.get("arr","12:00")
            tdate=data.get("travel_date",datetime.now().strftime("%Y-%m-%d"))
            pm=data.get("pre_meal","none"); svc=data.get("special_service","none"); sa=int(data.get("seat_price_add",0))
            random.seed(fid); be=random.randint(3200,14000)
            mults={"economy":1.0,"business":random.uniform(2.8,4.2),"first":random.uniform(5.5,8.5)}
            bp=int(be*mults.get(cabin,1.0)); tx=int(bp*.12)
            mp=next((m["price"] for m in MEAL_MENUS.get(cabin,MEAL_MENUS["economy"]) if m["id"]==pm),0)*pax_n
            sp2=next((s["price"] for s in SPECIAL_SERVICES if s["id"]==svc),0)
            total=(bp+tx)*pax_n+mp+sp2+sa
            db["booking_counter"]=db.get("booking_counter",1000)+1
            bid=f"BK{db['booking_counter']}"; pnr=gen_pnr()
            fn=fid.split("_")[0] if "_" in fid else fid; al=fn[:2] if len(fn)>=2 else "6E"
            ph=sum(ord(x) for x in pnr); auto_seat=f"{(ph%30)+1}{'ABCDEF'[ph%6]}"
            bk={"id":bid,"pnr":pnr,"user_email":user["email"],"flight_id":fid,"flight_number":fn,
                "airline":al,"airline_name":AIRLINES.get(al,{"name":"SkyWay"})["name"],
                "airline_color":AIRLINES.get(al,{"color":"#1a56db"})["color"],
                "origin":origin,"dest":dest,"dep":dep,"arr":arr,"travel_date":tdate,
                "cabin":cabin,"seat":seat if seat else auto_seat,
                "passengers":pax_list if pax_list else[user["name"]],
                "pre_meal":pm,"special_service":svc,
                "base_price":bp,"taxes":tx,"meal_charge":mp,"svc_charge":sp2,"seat_charge":sa,
                "total_amount":total,"status":"confirmed","payment_status":"pending",
                "refundable":(sum(ord(c) for c in fid)%3)!=1,"non_refundable":False,
                "baggage":{"economy":"15 kg","business":"35 kg","first":"50 kg"}.get(cabin,"15 kg"),
                "stops":0,"booked_at":datetime.now().isoformat()}
            db["bookings"][bid]=bk
            if bid not in db["users"][user["email"]]["bookings"]:
                db["users"][user["email"]]["bookings"].append(bid)
            save_db(db); self._json({"ok":True,"booking_id":bid,"pnr":pnr}); return

        if path=="/api/create-payment":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            amount=data.get("amount",0); booking_id=data.get("booking_id","")
            bk=db["bookings"].get(booking_id)
            if not bk: self._json({"ok":False,"error":"Booking not found"}); return
            order_id=f"ORDER_{gen_pnr()}"
            bk["payment_status"]="pending"; bk["payment_order"]=order_id
            save_db(db); self._json({"ok":True,"order_id":order_id,"amount":amount}); return

        if path=="/api/verify-payment":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            booking_id=data.get("booking_id",""); order_id=data.get("order_id","")
            bk=db["bookings"].get(booking_id)
            if not bk: self._json({"ok":False,"error":"Booking not found"}); return
            pay_id=f"PAY_{gen_pnr()}"
            bk["payment_status"]="paid"; bk["payment_id"]=pay_id; bk["payment_order"]=order_id
            bk["paid_at"]=datetime.now().isoformat()
            # Record revenue
            if "revenue" not in db: db["revenue"]={"total":0,"transactions":[]}
            db["revenue"]["total"]=db["revenue"].get("total",0)+bk.get("total_amount",0)
            db["revenue"]["transactions"].append({
                "id":pay_id,"booking_id":booking_id,"pnr":bk["pnr"],
                "user":user["name"],"user_email":user["email"],
                "amount":bk.get("total_amount",0),"route":f"{bk['origin']}→{bk['dest']}",
                "airline":bk.get("airline_name",""),"cabin":bk.get("cabin",""),
                "at":datetime.now().isoformat(),
            })
            save_db(db); self._json({"ok":True,"payment_id":pay_id}); return

        if path=="/api/cancel":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            bid=data.get("booking_id",""); bk=db["bookings"].get(bid)
            if not bk or bk["user_email"]!=user["email"]: self._json({"ok":False,"error":"Not found"}); return
            ok,reason,pct=can_cancel(bk)
            if not ok: self._json({"ok":False,"error":reason}); return
            bk["status"]="cancelled"; bk["cancelled_at"]=datetime.now().isoformat(); bk["refund_pct"]=pct
            save_db(db); self._json({"ok":True,"refund_pct":pct,"reason":reason}); return

        if path=="/api/reschedule":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            bid=data.get("booking_id",""); nd=data.get("new_date",""); ndep=data.get("new_dep","")
            bk=db["bookings"].get(bid)
            if not bk or bk["user_email"]!=user["email"]: self._json({"ok":False,"error":"Not found"}); return
            ok,reason=can_reschedule(bk)
            if not ok: self._json({"ok":False,"error":reason}); return
            if not nd or nd<=datetime.now().strftime("%Y-%m-%d"): self._json({"ok":False,"error":"Date must be future"}); return
            bk["travel_date"]=nd
            if ndep: bk["dep"]=ndep
            bk["rescheduled_at"]=datetime.now().isoformat(); save_db(db); self._json({"ok":True}); return

        if path=="/api/checkin":
            if not user: self._json({"ok":False,"error":"Not logged in"},401); return
            bid=data.get("booking_id",""); bk=db["bookings"].get(bid)
            if not bk or bk["user_email"]!=user["email"]: self._json({"ok":False,"error":"Not found"}); return
            ok,reason=can_checkin(bk)
            if not ok: self._json({"ok":False,"error":reason}); return
            bk["status"]="checked_in"; bk["checkedin_at"]=datetime.now().isoformat()
            save_db(db); self._json({"ok":True}); return

        if path=="/api/logout":
            cookies=self.headers.get("Cookie",""); sid=None
            for p in cookies.split(";"): p=p.strip(); sid=p[8:] if p.startswith("session=") else sid
            if sid and sid in db["sessions"]: del db["sessions"][sid]; save_db(db)
            d=json.dumps({"ok":True}).encode()
            self.send_response(200); self.send_header("Content-Type","application/json")
            self.send_header("Set-Cookie","session=; Path=/; HttpOnly; Max-Age=0")
            self.send_header("Content-Length",str(len(d))); self.end_headers(); self.wfile.write(d); return

        # ── ADMIN POST routes ─────────────────────────────────────────────────
        if path=="/api/admin/notify":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            ntype=data.get("type","general"); flight_id=data.get("flight_id","")
            message=data.get("message",""); target=data.get("target","all")  # "all" or flight_id
            delay_min=int(data.get("delay_min",0))
            notif={
                "id":f"N{gen_pnr()}","type":ntype,"message":message,
                "flight_id":flight_id,"delay_min":delay_min,
                "target":target,"created_by":user["email"],
                "created_at":datetime.now().isoformat(),"read_by":[],
            }
            if "notifications" not in db: db["notifications"]=[]
            db["notifications"].insert(0,notif)
            db["notifications"]=db["notifications"][:100]  # keep last 100
            # If it's a delay, update flight_status
            if ntype=="delay" and flight_id:
                if "flight_status" not in db: db["flight_status"]={}
                db["flight_status"][flight_id]={"status":"delayed","delay_min":delay_min,
                    "message":message,"updated_at":datetime.now().isoformat()}
            if ntype=="cancellation" and flight_id:
                if "flight_status" not in db: db["flight_status"]={}
                db["flight_status"][flight_id]={"status":"cancelled","delay_min":0,
                    "message":message,"updated_at":datetime.now().isoformat()}
            if ntype=="gate_change" and flight_id:
                if "flight_status" not in db: db["flight_status"]={}
                db["flight_status"][flight_id]={"status":"gate_changed","delay_min":delay_min,
                    "message":message,"updated_at":datetime.now().isoformat()}
            save_db(db); self._json({"ok":True,"notification":notif}); return

        if path=="/api/admin/delete-notification":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            nid=data.get("id","")
            db["notifications"]=[n for n in db.get("notifications",[]) if n["id"]!=nid]
            save_db(db); self._json({"ok":True}); return

        if path=="/api/admin/update-flight-status":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            flight_id=data.get("flight_id",""); status=data.get("status",""); message=data.get("message",""); delay=int(data.get("delay_min",0))
            if not flight_id: self._json({"ok":False,"error":"flight_id required"}); return
            if "flight_status" not in db: db["flight_status"]={}
            db["flight_status"][flight_id]={"status":status,"delay_min":delay,"message":message,"updated_at":datetime.now().isoformat()}
            save_db(db); self._json({"ok":True}); return

        if path=="/api/admin/clear-flight-status":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            flight_id=data.get("flight_id","")
            if flight_id in db.get("flight_status",{}): del db["flight_status"][flight_id]
            save_db(db); self._json({"ok":True}); return

        if path=="/api/admin/cancel-booking":
            if not is_admin(user): self._json({"ok":False,"error":"Admin only"},403); return
            bid=data.get("booking_id",""); reason=data.get("reason","Admin cancellation")
            bk=db["bookings"].get(bid)
            if not bk: self._json({"ok":False,"error":"Booking not found"}); return
            bk["status"]="cancelled"; bk["cancelled_at"]=datetime.now().isoformat()
            bk["cancel_reason"]=reason; bk["cancelled_by"]="admin"
            save_db(db); self._json({"ok":True}); return

        self._json({"ok":False,"error":"Unknown endpoint"},404)
# ── Seed ───────────────────────────────────────────────────────────────────────
def seed(db):
    u=db["users"].get("demo@skyway.com")
    if not u or u["bookings"]: return
    future=(datetime.now()+timedelta(days=6)).strftime("%Y-%m-%d")
    past=(datetime.now()-timedelta(days=12)).strftime("%Y-%m-%d")
    b1={"id":"BK1001","pnr":"SKY001","user_email":"demo@skyway.com","flight_id":f"6E205_{future}",
        "flight_number":"6E205","airline":"6E","airline_name":"IndiGo","airline_color":"#1a56db",
        "origin":"MAA","dest":"DEL","dep":"06:15","arr":"09:05","travel_date":future,
        "cabin":"economy","seat":"14C","passengers":["Arjun Kumar"],"pre_meal":"veg","special_service":"none",
        "base_price":4850,"taxes":582,"meal_charge":350,"svc_charge":0,"seat_charge":250,
        "total_amount":6032,"status":"confirmed","payment_status":"paid","payment_id":"PAY_SEED1",
        "refundable":True,"non_refundable":False,"baggage":"15 kg","stops":0,
        "booked_at":datetime.now().isoformat(),"paid_at":datetime.now().isoformat()}
    b2={**b1,"id":"BK1002","pnr":"SKY002","origin":"BOM","dest":"BLR","flight_number":"AI503",
        "airline":"AI","airline_name":"Air India","airline_color":"#c0392b","flight_id":f"AI503_{past}",
        "travel_date":past,"cabin":"business","seat":"3A","pre_meal":"nonveg_gourmet",
        "total_amount":18900,"status":"cancelled","payment_status":"paid","payment_id":"PAY_SEED2"}
    db["bookings"]["BK1001"]=b1; db["bookings"]["BK1002"]=b2
    db["booking_counter"]=1002; db["users"]["demo@skyway.com"]["bookings"]=["BK1001","BK1002"]
    if "revenue" not in db: db["revenue"]={"total":0,"transactions":[]}
    db["revenue"]["total"]=6032+18900
    db["revenue"]["transactions"]=[
        {"id":"PAY_SEED1","booking_id":"BK1001","pnr":"SKY001","user":"Arjun Kumar","user_email":"demo@skyway.com",
         "amount":6032,"route":"MAA→DEL","airline":"IndiGo","cabin":"economy","at":datetime.now().isoformat()},
        {"id":"PAY_SEED2","booking_id":"BK1002","pnr":"SKY002","user":"Arjun Kumar","user_email":"demo@skyway.com",
         "amount":18900,"route":"BOM→BLR","airline":"Air India","cabin":"business","at":(datetime.now()-timedelta(days=12)).isoformat()},
    ]
    save_db(db); print("  Seed data created ✅")

if __name__=="__main__":
    os.makedirs(STATIC_DIR,exist_ok=True)
    db=load_db(); seed(db)
    PORT=8765; srv=HTTPServer(("0.0.0.0",PORT),Handler)
    print(f"\n  ✈  SkyWay v3  →  http://localhost:{PORT}")
    print(f"  User  : demo@skyway.com  /  Demo@123")
    print(f"  Admin : admin@skyway.com /  Admin@123\n")
    srv.serve_forever()