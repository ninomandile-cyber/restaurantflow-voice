const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const path = require('path');
const { Pool } = require('pg');
const RESTAURANT = require('./restaurant.config.js');
const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const transcripts = new Map();

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

async function initDB() {
  if (!pool) { console.log('No DATABASE_URL - using memory storage'); return; }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS inquiries (
      id BIGINT PRIMARY KEY,
      session_id TEXT,
      customer_name TEXT,
      phone TEXT,
      email TEXT,
      inquiry_type TEXT,
      event_type TEXT,
      event_date TEXT,
      event_time TEXT,
      guest_count TEXT,
      private_room TEXT,
      food_style TEXT,
      bar_needs TEXT,
      dietary_needs TEXT,
      budget_concern TEXT,
      urgency TEXT DEFAULT 'normal',
      emotional_tone TEXT,
      revenue_signal TEXT,
      service_recovery_risk BOOLEAN DEFAULT false,
      recommended_manager_tone TEXT,
      manager_note TEXT,
      status TEXT DEFAULT 'new',
      transcript TEXT,
      manager_brief_subject TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log('Database ready');
  } catch(e) { console.error('DB init error:', e.message); }
}
initDB();

const memInquiries = [];

async function saveInquiry(inquiry) {
  memInquiries.push(inquiry);
  if (!pool) return;
  try {
    await pool.query(`INSERT INTO inquiries (id,session_id,customer_name,phone,email,inquiry_type,event_type,event_date,event_time,guest_count,private_room,food_style,bar_needs,dietary_needs,budget_concern,urgency,emotional_tone,revenue_signal,service_recovery_risk,recommended_manager_tone,manager_note,status,transcript,manager_brief_subject) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [inquiry.id,inquiry.sessionId,inquiry.customerName,inquiry.phone,inquiry.email,inquiry.inquiryType,inquiry.eventType,inquiry.date,inquiry.time,inquiry.guestCount,inquiry.privateRoom,inquiry.foodStyle,inquiry.barNeeds,inquiry.dietaryNeeds,inquiry.budgetConcern,inquiry.urgency,inquiry.emotionalTone,inquiry.revenueSignal,inquiry.serviceRecoveryRisk,inquiry.recommendedManagerTone,inquiry.managerNote,inquiry.status,inquiry.transcript,inquiry.managerBriefSubject]);
    console.log('Inquiry saved to DB:', inquiry.id);
  } catch(e) { console.error('DB save error:', e.message); }
}

async function getInquiries() {
  if (!pool) return memInquiries;
  try {
    var result = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 200');
    return result.rows.map(function(r) {
      return {id:r.id,sessionId:r.session_id,customerName:r.customer_name,phone:r.phone,email:r.email,inquiryType:r.inquiry_type,eventType:r.event_type,date:r.event_date,time:r.event_time,guestCount:r.guest_count,privateRoom:r.private_room,foodStyle:r.food_style,barNeeds:r.bar_needs,dietaryNeeds:r.dietary_needs,budgetConcern:r.budget_concern,urgency:r.urgency,emotionalTone:r.emotional_tone,revenueSignal:r.revenue_signal,serviceRecoveryRisk:r.service_recovery_risk,recommendedManagerTone:r.recommended_manager_tone,managerNote:r.manager_note,status:r.status,createdAt:r.created_at};
    });
  } catch(e) { console.error('DB fetch error:', e.message); return memInquiries; }
}

async function updateInquiryStatus(id, status) {
  var mem = memInquiries.find(function(i){return i.id===id;});
  if (mem) mem.status = status;
  if (!pool) return;
  try { await pool.query('UPDATE inquiries SET status=$1 WHERE id=$2', [status, id]); }
  catch(e) { console.error('DB update error:', e.message); }
}

function buildSystemPrompt(r){var spaces=r.spaces.map(function(s){return"- "+s.name+": up to "+s.capacity+" guests ("+s.type+")";}).join("\n");var menu=r.menuItems.map(function(m){return"- "+m.name+": "+m.description+(m.dietaryTags.length?" | "+m.dietaryTags.join(", "):"");}).join("\n");var wines=r.wineList.map(function(w){return"- "+w.name+" ("+w.type+"): "+w.style+" | pairs with: "+w.pairsWith.join(", ")+" | $"+w.priceGlass+"/glass";}).join("\n");var specials=r.todaysSpecials.filter(function(s){return s.active&&!s.soldOut;}).map(function(s){return"- "+s.name+" ($"+s.price+"): "+s.description;}).join("\n")||"No specials today";var packages=r.cateringPackages.map(function(p){return"- "+p.style+": from $"+p.priceFrom+"/person";}).join("\n");return "You are Sofia, the AI concierge at "+r.name+", "+r.cuisine+" in "+r.city+".\n\nSpeak warmly. Ask ONE question at a time. Keep replies 1-3 sentences. Never sound like a form. Mirror the guest energy. Sound like a real host.\n\nRESTAURANT INFO:\nPhone: "+r.phone+"\nSpaces:\n"+spaces+"\nCatering:\n"+packages+"\nEvent minimum: $"+r.eventMinimum+"\nBar: "+r.barOptions.join(" / ")+"\nDietary: "+r.dietaryAccommodations+"\n\nMENU:\n"+menu+"\n\nWINE LIST:\n"+wines+"\n\nTODAYS SPECIALS:\n"+specials+"\n\nPSYCHOLOGY: If excited match energy. If overwhelmed slow down. If price-sensitive acknowledge gently. If frustrated do not defend, apologize and escalate.\n\nGUARDRAILS: Never guarantee availability. Never confirm exact pricing. Never guarantee allergy safety. Never confirm booking. Never invent menu items or wine. Never use markdown formatting like asterisks bold bullets or headers. Plain conversational text only.\n\nSERVICE RECOVERY: If customer mentions bad experience do not defend. Apologize lightly. Collect facts and contact info. Escalate urgently.\n\nWhen you have name, inquiry type, date, guest count if applicable, and contact info, wrap up warmly then output this JSON on its own line:\n\nINQUIRY_COMPLETE:{\"inquiryType\":\"\",\"customerName\":\"\",\"phone\":\"\",\"email\":\"\",\"eventType\":\"\",\"date\":\"\",\"time\":\"\",\"guestCount\":\"\",\"privateRoom\":\"\",\"foodStyle\":\"\",\"barNeeds\":\"\",\"dietaryNeeds\":\"\",\"budgetConcern\":\"\",\"urgency\":\"normal\",\"notes\":\"\",\"emotionalTone\":\"\",\"guestIntent\":\"\",\"revenueSignal\":\"\",\"priceSensitivity\":\"\",\"confidenceLevel\":\"\",\"serviceRecoveryRisk\":false,\"recommendedManagerTone\":\"\",\"managerNote\":\"\",\"missingFields\":[]}";}

function generateManagerBrief(state,transcript,r){var urgency=state.urgency==="urgent"?"URGENT":state.urgency==="high"?"HOT":"NORMAL";var subject="["+urgency+"] "+r.name+" - "+(state.customerName||"Guest")+" - "+(state.inquiryType||"General")+" - "+(state.date||"Date TBD");var body="RESTAURANTFLOW MANAGER BRIEF\n"+r.name+" | "+new Date().toLocaleString()+"\n"+(state.serviceRecoveryRisk?"\nSERVICE RECOVERY RISK\n":"")+"\nCUSTOMER\nName: "+(state.customerName||"Not provided")+"\nPhone: "+(state.phone||"Not provided")+"\nEmail: "+(state.email||"Not provided")+"\n\nINQUIRY: "+(state.inquiryType||"General")+"\nEvent: "+(state.eventType||"NA")+" | Date: "+(state.date||"TBD")+" | Time: "+(state.time||"TBD")+" | Guests: "+(state.guestCount||"TBD")+"\nRoom: "+(state.privateRoom||"TBD")+" | Food: "+(state.foodStyle||"TBD")+" | Bar: "+(state.barNeeds||"NA")+"\nDietary: "+(state.dietaryNeeds||"None")+" | Budget: "+(state.budgetConcern||"None")+"\n\nAI ASSESSMENT\nTone: "+(state.emotionalTone||"Neutral")+" | Revenue: "+(state.revenueSignal||"Unknown")+"\nService recovery: "+(state.serviceRecoveryRisk?"YES":"No")+"\nManager tone: "+(state.recommendedManagerTone||"Warm and professional")+"\nNote: "+(state.managerNote||"None")+"\n\nSUGGESTED REPLY\nHi "+(state.customerName||"there")+", thanks for reaching out to "+r.name+". We would love to host your event. I will follow up shortly.\n\nTRANSCRIPT\n"+(transcript||"Not available")+"\n\nPowered by RestaurantFlow - NM Automation";return {subject:subject,body:body};}

function sendManagerBrief(subject,body,r){if(!process.env.EMAIL_USER||!process.env.EMAIL_PASS){console.log("Email not configured");return Promise.resolve();}var transporter=nodemailer.createTransport({service:"gmail",auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}});return transporter.sendMail({from:process.env.EMAIL_USER,to:r.notificationEmail,subject:subject,text:body}).then(function(){console.log("Brief sent to:",r.notificationEmail);}).catch(function(e){console.error("Email error:",e.message);});}

function scheduleFollowUp(inquiry,r){if(!r.followUpSequence||!inquiry.email)return;r.followUpSequence.forEach(function(step){var delay=step.dayOffset*24*60*60*1000;setTimeout(function(){if(inquiry.status!=="contacted"&&inquiry.status!=="booked"){var msg=step.message.replace("{name}",inquiry.customerName||"there").replace("{restaurant}",r.name).replace("{date}",inquiry.date||"your requested date").replace("{phone}",r.phone);console.log("FOLLOW UP DUE:",inquiry.customerName,"Day",step.dayOffset);}},delay);});}

app.post("/api/chat",function(req,res){var messages=req.body.messages;var sessionId=req.body.sessionId;if(!messages)return res.status(400).json({error:"messages required"});if(!process.env.ANTHROPIC_API_KEY)return res.status(500).json({error:"API key not configured"});fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1200,system:buildSystemPrompt(RESTAURANT),messages:messages})}).then(function(response){if(!response.ok){return response.text().then(function(rawText){var errMsg="API error";try{errMsg=JSON.parse(rawText).error.message||errMsg;}catch(e){}res.status(response.status).json({error:errMsg});});}return response.json().then(function(data){var reply=data.content[0].text||"";var inquiryState=null;var readyToSubmit=false;var match=reply.match(/INQUIRY_COMPLETE:(\{[\s\S]*?\})/);if(match){try{inquiryState=JSON.parse(match[1]);readyToSubmit=true;reply=reply.replace(/INQUIRY_COMPLETE:[\s\S]*$/,"").trim();}catch(e){console.error("Parse error:",e.message);}}if(sessionId){var existing=transcripts.get(sessionId)||[];existing.push("Guest: "+(messages[messages.length-1].content||""));existing.push("Sofia: "+reply);transcripts.set(sessionId,existing);}if(readyToSubmit&&inquiryState){var transcript=(transcripts.get(sessionId)||[]).join("\n");var brief=generateManagerBrief(inquiryState,transcript,RESTAURANT);sendManagerBrief(brief.subject,brief.body,RESTAURANT);if(transcripts.get(sessionId+"_saved"))return;transcripts.set(sessionId+"_saved",true);var inquiry={id:Date.now(),sessionId:sessionId,customerName:inquiryState.customerName,phone:inquiryState.phone,email:inquiryState.email,inquiryType:inquiryState.inquiryType,eventType:inquiryState.eventType,date:inquiryState.date,time:inquiryState.time,guestCount:inquiryState.guestCount,privateRoom:inquiryState.privateRoom,foodStyle:inquiryState.foodStyle,barNeeds:inquiryState.barNeeds,dietaryNeeds:inquiryState.dietaryNeeds,budgetConcern:inquiryState.budgetConcern,urgency:inquiryState.urgency,emotionalTone:inquiryState.emotionalTone,revenueSignal:inquiryState.revenueSignal,serviceRecoveryRisk:inquiryState.serviceRecoveryRisk,recommendedManagerTone:inquiryState.recommendedManagerTone,managerNote:inquiryState.managerNote,status:"new",createdAt:new Date().toISOString(),transcript:transcript,managerBriefSubject:brief.subject};saveInquiry(inquiry);scheduleFollowUp(inquiry,RESTAURANT);}var notificationPriority="normal";if(inquiryState&&inquiryState.serviceRecoveryRisk)notificationPriority="service_recovery";else if(inquiryState&&inquiryState.urgency==="urgent")notificationPriority="urgent";else if(inquiryState&&inquiryState.urgency==="high")notificationPriority="hot";res.json({reply:reply,readyToSubmit:readyToSubmit,notificationPriority:notificationPriority,inquiryType:inquiryState?inquiryState.inquiryType:null,emotionalTone:inquiryState?inquiryState.emotionalTone:null,urgency:inquiryState?inquiryState.urgency:null,revenueSignal:inquiryState?inquiryState.revenueSignal:null,serviceRecoveryRisk:inquiryState?inquiryState.serviceRecoveryRisk:false,recommendedManagerTone:inquiryState?inquiryState.recommendedManagerTone:null,managerNote:inquiryState?inquiryState.managerNote:null,missingFields:inquiryState?inquiryState.missingFields:[],state:inquiryState});});}).catch(function(err){console.error("Server error:",err.message);res.status(500).json({error:err.message});});});

app.post("/api/speak",function(req,res){var text=req.body.text;if(!text)return res.status(400).json({error:"text required"});if(!process.env.ELEVENLABS_API_KEY)return res.status(500).json({error:"ElevenLabs not configured"});fetch("https://api.elevenlabs.io/v1/text-to-speech/DODLEQrClDo8wCz460ld",{method:"POST",headers:{"Content-Type":"application/json","xi-api-key":process.env.ELEVENLABS_API_KEY},body:JSON.stringify({text:text,model_id:"eleven_turbo_v2",voice_settings:{stability:0.5,similarity_boost:0.75}})}).then(function(response){if(!response.ok){return response.text().then(function(err){res.status(response.status).json({error:"TTS failed"});});}res.set("Content-Type","audio/mpeg");response.body.pipe(res);}).catch(function(err){res.status(500).json({error:err.message});});});

app.get("/api/inquiries",function(req,res){getInquiries().then(function(list){res.json({total:list.length,inquiries:list});}).catch(function(e){res.status(500).json({error:e.message});});});

app.post("/api/inquiries/:id/status",function(req,res){var id=parseInt(req.params.id);var status=req.body.status||"contacted";updateInquiryStatus(id,status).then(function(){res.json({success:true,id:id,status:status});}).catch(function(e){res.status(500).json({error:e.message});});});

var runtimeSpecials = null;
var runtimeMenu = null;
app.get("/api/specials",function(req,res){res.json({specials:runtimeSpecials||RESTAURANT.todaysSpecials});});
app.post("/api/specials",function(req,res){runtimeSpecials=req.body.specials;res.json({success:true});});
app.get("/api/menu",function(req,res){res.json({menu:runtimeMenu||RESTAURANT.menuItems});});
app.post("/api/menu",function(req,res){runtimeMenu=req.body.menu;res.json({success:true});});
var runtimeWine=null;
app.get("/api/wine",function(req,res){res.json({wine:runtimeWine||RESTAURANT.wineList});});
app.post("/api/wine",function(req,res){runtimeWine=req.body.wine;res.json({success:true});});
app.get("/api/config",function(req,res){res.json({name:RESTAURANT.name,phone:RESTAURANT.phone,barOptions:RESTAURANT.barOptions,eventMinimum:RESTAURANT.eventMinimum,depositPolicy:RESTAURANT.depositPolicy,spaces:RESTAURANT.spaces});});

app.get("/api/health",function(req,res){res.json({status:"ok",version:"3.0.0",restaurant:RESTAURANT.name,apiKeySet:!!process.env.ANTHROPIC_API_KEY,dbConnected:!!pool});});

app.get("*",function(req,res){res.sendFile(path.join(__dirname,"public","index.html"));});

var PORT=process.env.PORT||3000;
app.listen(PORT,function(){console.log("RestaurantFlow v3 running on port "+PORT);});
