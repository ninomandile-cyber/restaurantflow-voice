const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RESTAURANT = {
  name: "Bella Tavola",
  cuisine: "Upscale Italian",
  city: "Elk Grove Village, IL",
  phone: "847-555-0192",
  address: "1234 Elmhurst Rd, Elk Grove Village, IL 60007",
  hours: "Mon-Thu 11am-10pm, Fri-Sat 11am-11pm, Sun 12pm-9pm",
  notificationEmail: process.env.NOTIFICATION_EMAIL || "events@bellatavola.com",
  spaces: [
    { name: "The Rosario Room", capacity: 80, type: "private", features: "Full AV, private entrance, dance floor available" },
    { name: "The Garden Alcove", capacity: 25, type: "semi-private", features: "Great for rehearsal dinners and intimate celebrations" },
    { name: "Full Restaurant Buyout", capacity: 150, type: "buyout", features: "Exclusive use, full menu flexibility" }
  ],
  cateringRange: { min: 20, max: 300 },
  menuItems: [
    { name: "Osso Buco", category: "entree", description: "Braised veal shank with gremolata and saffron risotto", popular: true, goodForGroups: true, dietaryTags: [] },
    { name: "Branzino al Forno", category: "entree", description: "Whole roasted Mediterranean sea bass with lemon and herbs", popular: true, goodForGroups: false, dietaryTags: ["gluten-free"] },
    { name: "House-made Tagliatelle", category: "pasta", description: "Fresh pasta with slow-cooked Bolognese ragu", popular: true, goodForGroups: true, dietaryTags: [] },
    { name: "Eggplant Parmigiana", category: "entree", description: "Classic baked eggplant with house marinara and mozzarella", popular: true, goodForGroups: true, dietaryTags: ["vegetarian"] },
    { name: "Chicken Marsala", category: "entree", description: "Pan-seared chicken with Marsala wine and mushroom sauce", popular: true, goodForGroups: true, dietaryTags: [] },
    { name: "Tiramisu", category: "dessert", description: "Classic house-made tiramisu with espresso and mascarpone", popular: true, goodForGroups: true, dietaryTags: ["vegetarian"] },
    { name: "Penne Arrabbiata", category: "pasta", description: "Penne with spicy tomato sauce and fresh basil", popular: false, goodForGroups: true, dietaryTags: ["vegetarian", "vegan"] },
    { name: "Caprese Salad", category: "appetizer", description: "Fresh mozzarella, heirloom tomatoes, basil, and olive oil", popular: true, goodForGroups: true, dietaryTags: ["vegetarian", "gluten-free"] }
  ],
  wineList: [
    { name: "Chianti Classico", type: "red", region: "Tuscany, Italy", style: "medium-bodied, dry", pairsWith: ["pasta", "chicken", "eggplant parmigiana", "red sauce dishes"], priceGlass: 14, priceBottle: 52 },
    { name: "Montepulciano d'Abruzzo", type: "red", region: "Abruzzo, Italy", style: "medium-bodied, earthy", pairsWith: ["braised meats", "osso buco", "pasta bolognese", "red sauce dishes"], priceGlass: 13, priceBottle: 48 },
    { name: "Barolo", type: "red", region: "Piedmont, Italy", style: "full-bodied, tannic", pairsWith: ["osso buco", "braised veal", "aged cheese", "truffle dishes"], priceGlass: 22, priceBottle: 85 },
    { name: "Pinot Grigio", type: "white", region: "Alto Adige, Italy", style: "light, crisp, dry", pairsWith: ["seafood", "branzino", "light pasta", "caprese salad"], priceGlass: 13, priceBottle: 46 },
    { name: "Vermentino", type: "white", region: "Sardinia, Italy", style: "aromatic, light-bodied", pairsWith: ["seafood", "fish", "light appetizers"], priceGlass: 14, priceBottle: 50 },
    { name: "Prosecco", type: "sparkling", region: "Veneto, Italy", style: "light, bubbly, slightly sweet", pairsWith: ["appetizers", "celebrations", "light desserts", "brunch"], priceGlass: 12, priceBottle: 44 },
    { name: "Moscato d'Asti", type: "dessert", region: "Piedmont, Italy", style: "sweet, light, lightly sparkling", pairsWith: ["tiramisu", "fruit desserts", "after dinner"], priceGlass: 11, priceBottle: 40 }
  ],
  todaysSpecials: [
    { name: "Rigatoni al Tartufo", description: "Rigatoni with black truffle cream sauce and pecorino", mealPeriod: "dinner", price: 28, active: true, soldOut: false },
    { name: "Branzino with Caponata", description: "Pan-seared branzino with Sicilian sweet and sour vegetable relish", mealPeriod: "dinner", price: 34, active: true, soldOut: false },
    { name: "Lunch Minestrone", description: "House-made vegetable minestrone with crusty bread", mealPeriod: "lunch", price: 12, active: true, soldOut: false }
  ],
  cateringPackages: [
    { style: "Family-style", priceFrom: 38, pricePer: "person", description: "Shared platters for the table, great for groups" },
    { style: "Buffet", priceFrom: 44, pricePer: "person", description: "Self-serve stations, good for large or casual events" },
    { style: "Plated dinner", priceFrom: 52, pricePer: "person", description: "Individual plated courses, more formal" },
    { style: "Passed appetizers only", priceFrom: 24, pricePer: "person", description: "Cocktail-style reception" }
  ],
  eventMinimum: 500,
  depositPolicy: "25% deposit to hold your date, fully applied to the final bill",
  barOptions: ["Full open bar", "Beer and wine package", "Soft drinks only"],
  dietaryAccommodations: "Gluten-free, vegetarian, vegan, and most allergen needs accommodated with advance notice. Kitchen cannot guarantee zero cross-contact for severe allergies.",
  doNotSay: [
    "Never guarantee date availability",
    "Never quote exact final pricing",
    "Never guarantee allergy safety",
    "Never confirm a booking or reservation",
    "Never invent menu items, specials, or wine not in the stored profile"
  ]
};

const transcripts = new Map();

function buildSystemPrompt(r) {
  const spaces = r.spaces.map(s => `  - ${s.name}: up to ${s.capacity} guests (${s.type}) — ${s.features}`).join('\n');
  const menuItems = r.menuItems.map(m => `  - ${m.name} [${m.category}]: ${m.description}${m.popular ? ' *popular' : ''}${m.dietaryTags.length ? ' | ' + m.dietaryTags.join(', ') : ''}`).join('\n');
  const wines = r.wineList.map(w => `  - ${w.name} (${w.type}, ${w.region}): ${w.style} | pairs with: ${w.pairsWith.join(', ')} | $${w.priceGlass}/glass, $${w.priceBottle}/bottle`).join('\n');
  const activeSpecials = r.todaysSpecials.filter(s => s.active && !s.soldOut);
  const specials = activeSpecials.length > 0 ? activeSpecials.map(s => `  - ${s.name} (${s.mealPeriod}, $${s.price}): ${s.description}`).join('\n') : '  - No specials currently loaded. Tell the customer the restaurant can confirm today\'s specials.';
  const packages = r.cateringPackages.map(p => `  - ${p.style}: from $${p.priceFrom}/${p.pricePer} — ${p.description}`).join('\n');
  const doNot = r.doNotSay.map(d => `  - ${d}`).join('\n');

  return `You are Sofia, the AI concierge at ${r.name}, ${r.cuisine} in ${r.city}.

You have two jobs running simultaneously:
1. CUSTOMER BRAIN: Speak naturally, warmly, and simply — one question at a time.
2. MANAGER BRAIN: Analyze tone, intent, urgency, and value for structured intelligence.

RESTAURANT PROFILE:
Phone: ${r.phone} | Hours: ${r.hours}

SPACES:
${spaces}

CATERING PACKAGES:
${packages}

EVENT MINIMUM: $${r.eventMinimum} | DEPOSIT: ${r.depositPolicy}
BAR: ${r.barOptions.join(' / ')}
DIETARY: ${r.dietaryAccommodations}

MENU:
${menuItems}

WINE LIST:
${wines}

TODAY'S SPECIALS:
${specials}

CONVERSATION RULES:
- Ask ONE question at a time
- Keep replies short — 1 to 3 sentences
- Acknowledge what customer said before asking next
- Never sound like a survey
- Let customer say "not sure"
- Mirror their language and energy
- Sound like a real host, not a robot

GOOD: "Got it — birthday dinner for about 45 people. What date are you hoping for?"
BAD: "Please provide event date, guest count, seating preference..."

HOSPITALITY PSYCHOLOGY:
- EXCITED: Match energy. "That sounds like a great night."
- OVERWHELMED: Slow down. "You don't need to have it all figured out."
- PRICE-SENSITIVE: "I'll note you want practical options."
- RUSHED: "I'll mark this time-sensitive."
- FRUSTRATED: Do not defend. "I'm sorry that happened. Let me get this to the manager."
- Use social proof, scarcity, choice architecture, soft commitment naturally

INTENT ROUTING:
private_event / banquet / large_party → collect event details
catering → collect catering details
menu_question → guide from stored menu only
wine_pairing → recommend from stored wine list only
todays_specials → share from stored specials only
dietary_question → route safely, never guarantee allergy safety
service_recovery / complaint → switch to recovery mode immediately
hours_location → answer from stored data

WINE PAIRING RULES:
- Recommend only from stored wine list
- Explain WHY the pairing works in simple language
- Never invent bottles or availability

GUARDRAILS:
${doNot}
- If unsure, say the restaurant will confirm

SERVICE RECOVERY:
If customer is frustrated or mentions bad experience:
- Do not argue or defend
- Apologize lightly and genuinely
- Collect facts and contact info
- Mark as service_recovery urgent

When you have collected name, inquiry type, date, guest count if applicable, and contact info — wrap up warmly then output this JSON on its own line:

INQUIRY_COMPLETE:{"inquiryType":"","customerName":"","phone":"","email":"","eventType":"","date":"","time":"","guestCount":"","privateRoom":"","foodStyle":"","barNeeds":"","dietaryNeeds":"","budgetConcern":"","urgency":"normal","notes":"","emotionalTone":"","guestIntent":"","revenueSignal":"","priceSensitivity":"","confidenceLevel":"","serviceRecoveryRisk":false,"recommendedManagerTone":"","managerNote":"","missingFields":[]}`;
}

function generateManagerBrief(state, transcript, r) {
  const urgencyLabel = state.urgency === 'urgent' ? 'URGENT' : state.urgency === 'high' ? 'HOT' : state.urgency === 'medium' ? 'WARM' : 'NORMAL';
  const subject = `[${urgencyLabel}] ${state.inquiryType || 'Inquiry'} — ${state.customerName || 'Guest'} — ${state.date || 'Date TBD'} — ${state.guestCount ? state.guestCount + ' guests' : ''}`.trim();

  const talkingPoints = [
    state.date ? `Confirm ${state.date} availability` : 'Ask for preferred date',
    state.guestCount ? `Discuss setup for ${state.guestCount} guests` : 'Clarify guest count',
    state.foodStyle ? `Review ${state.foodStyle} package pricing` : 'Walk through food package options',
    state.barNeeds ? `Discuss ${state.barNeeds} options` : null,
    state.dietaryNeeds ? `Address dietary needs: ${state.dietaryNeeds}` : null,
    'Explain deposit and minimum after confirming room fit',
    state.priceSensitivity === 'high' ? 'Lead with value, not highest price option' : null,
    state.serviceRecoveryRisk ? 'Acknowledge the issue FIRST before any event details' : null
  ].filter(Boolean).map(p => `  - ${p}`).join('\n');

  const body = `RESTAURANTFLOW MANAGER BRIEF
${r.name} — ${new Date().toLocaleString()}
${state.serviceRecoveryRisk ? '\nSERVICE RECOVERY RISK — Handle with care\n' : ''}
CUSTOMER
Name:   ${state.customerName || 'Not provided'}
Phone:  ${state.phone || 'Not provided'}
Email:  ${state.email || 'Not provided'}

INQUIRY TYPE: ${state.inquiryType || 'General'}

EVENT DETAILS
Event: ${state.eventType || 'Not specified'} | Date: ${state.date || 'TBD'} | Time: ${state.time || 'TBD'}
Guests: ${state.guestCount || 'TBD'} | Room: ${state.privateRoom || 'Not specified'}
Food: ${state.foodStyle || 'TBD'} | Bar: ${state.barNeeds || 'Not discussed'}
Dietary: ${state.dietaryNeeds || 'None noted'} | Budget: ${state.budgetConcern || 'Not discussed'}
Urgency: ${state.urgency || 'Normal'} | Notes: ${state.notes || 'None'}

AI GUEST ASSESSMENT
Emotional Tone: ${state.emotionalTone || 'Neutral'}
Guest Intent: ${state.guestIntent || 'Exploring'}
Revenue Signal: ${state.revenueSignal || 'Unknown'}
Price Sensitivity: ${state.priceSensitivity || 'Unknown'}
Confidence: ${state.confidenceLevel || 'Unknown'}
Service Recovery Risk: ${state.serviceRecoveryRisk ? 'YES' : 'No'}
Recommended Manager Tone: ${state.recommendedManagerTone || 'Warm and professional'}
Manager Note: ${state.managerNote || 'None'}

MISSING INFO: ${state.missingFields?.length > 0 ? state.missingFields.join(', ') : 'None'}

PHONE TALKING POINTS
${talkingPoints}

SUGGESTED REPLY
"Hi ${state.customerName || 'there'}, thanks for reaching out to ${r.name}. We would love to help. I will follow up shortly with availability and options."

TRANSCRIPT
${transcript || 'Not available'}

Powered by RestaurantFlow — NM Automation`;

  return { subject, body };
}

async function sendManagerBrief(subject, body, r) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured. Subject:', subject);
    return;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: r.notificationEmail,
    subject,
    text: body
  });
}

app.post('/api/chat', async (req, res) => {
  const { messages, sessionId } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: API key not set' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: buildSystemPrompt(RESTAURANT),
        messages
      })
    });

    if (!response.ok) {
      const rawText = await response.text();
      console.error(`Anthropic error — status: ${response.status}, body: ${rawText}`);
      let errMsg = 'API error';
      try { errMsg = JSON.parse(rawText).error?.message || errMsg; } catch(e) {}
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    let reply = data.content?.[0]?.text || '';

    let inquiryState = null;
    let readyToSubmit = false;
    const match = reply.match(/INQUIRY_COMPLETE:(\{[\s\S]*?\})/);
    if (match) {
      try {
        inquiryState = JSON.parse(match[1]);
        readyToSubmit = true;
        reply = reply.replace(/INQUIRY_COMPLETE:[\s\S]*$/, '').trim();
      } catch(e) { console.error('Parse error:', e.message); }
    }

    if (sessionId) {
      const existing = transcripts.get(sessionId) || [];
      const lastUser = messages[messages.length - 1];
      existing.push(`Guest: ${lastUser?.content || ''}`);
      existing.push(`Sofia: ${reply}`);
      transcripts.set(sessionId, existing);
    }

    if (readyToSubmit && inquiryState) {
      const transcript = (transcripts.get(sessionId) || []).join('\n');
      const { subject, body: briefBody } = generateManagerBrief(inquiryState, transcript, RESTAURANT);
      sendManagerBrief(subject, briefBody, RESTAURANT).catch(e => console.error('Email error:', e.message));
    }

    let notificationPriority = 'normal';
    if (inquiryState?.serviceRecoveryRisk) notificationPriority = 'service_recovery';
    else if (inquiryState?.urgency === 'urgent') notificationPriority = 'urgent';
    else if (inquiryState?.urgency === 'high') notificationPriority = 'hot';

    res.json({
      reply,
      readyToSubmit,
      handoffNeeded: !!(inquiryState?.serviceRecoveryRisk || inquiryState?.urgency === 'urgent'),
      notificationPriority,
      inquiryType: inquiryState?.inquiryType || null,
      emotionalTone: inquiryState?.emotionalTone || null,
      urgency: inquiryState?.urgency || null,
      revenueSignal: inquiryState?.revenueSignal || null,
      priceSensitivity: inquiryState?.priceSensitivity || null,
      serviceRecoveryRisk: inquiryState?.serviceRecoveryRisk || false,
      recommendedManagerTone: inquiryState?.recommendedManagerTone || null,
      managerNote: inquiryState?.managerNote || null,
      missingFields: inquiryState?.missingFields || [],
      state: inquiryState || null
    });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '4.0.0', restaurant: RESTAURANT.name, apiKeySet: !!process.env.ANTHROPIC_API_KEY });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RestaurantFlow Voice running on port ${PORT}`));
