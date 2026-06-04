module.exports = {
  id: "bella-tavola",
  name: "Bella Tavola",
  cuisine: "Upscale Italian",
  city: "Elk Grove Village, IL",
  phone: "847-555-0192",
  notificationEmail: process.env.NOTIFICATION_EMAIL || "events@bellatavola.com",
  spaces: [
    { name: "The Rosario Room", capacity: 80, type: "private" },
    { name: "The Garden Alcove", capacity: 25, type: "semi-private" },
    { name: "Full Buyout", capacity: 150, type: "buyout" }
  ],
  menuItems: [
    { name: "Osso Buco", description: "Braised veal shank with gremolata and saffron risotto", dietaryTags: [] },
    { name: "Branzino al Forno", description: "Whole roasted sea bass with lemon and herbs", dietaryTags: ["gluten-free"] },
    { name: "House-made Tagliatelle", description: "Fresh pasta with slow-cooked Bolognese ragu", dietaryTags: [] },
    { name: "Eggplant Parmigiana", description: "Classic baked eggplant with house marinara", dietaryTags: ["vegetarian"] },
    { name: "Chicken Marsala", description: "Pan-seared chicken with Marsala wine and mushrooms", dietaryTags: [] },
    { name: "Tiramisu", description: "Classic house-made tiramisu", dietaryTags: ["vegetarian"] }
  ],
  wineList: [
    { name: "Chianti Classico", type: "red", style: "medium-bodied dry", pairsWith: ["pasta", "chicken", "red sauce"], priceGlass: 14 },
    { name: "Montepulciano", type: "red", style: "medium-bodied earthy", pairsWith: ["braised meats", "osso buco"], priceGlass: 13 },
    { name: "Barolo", type: "red", style: "full-bodied", pairsWith: ["osso buco", "veal"], priceGlass: 22 },
    { name: "Pinot Grigio", type: "white", style: "light crisp", pairsWith: ["seafood", "branzino"], priceGlass: 13 },
    { name: "Prosecco", type: "sparkling", style: "light bubbly", pairsWith: ["appetizers", "celebrations"], priceGlass: 12 },
    { name: "Moscato", type: "dessert", style: "sweet light", pairsWith: ["tiramisu", "desserts"], priceGlass: 11 }
  ],
  todaysSpecials: [
    { name: "Rigatoni al Tartufo", description: "Rigatoni with black truffle cream sauce", price: 28, active: true, soldOut: false },
    { name: "Branzino with Caponata", description: "Pan-seared branzino with Sicilian vegetable relish", price: 34, active: true, soldOut: false }
  ],
  cateringPackages: [
    { style: "Family-style", priceFrom: 38 },
    { style: "Buffet", priceFrom: 44 },
    { style: "Plated dinner", priceFrom: 52 }
  ],
  eventMinimum: 500,
  depositPolicy: "25 percent deposit to hold your date",
  barOptions: ["Full open bar", "Cash bar", "Tab / hosted bar", "Beer and wine only", "Soft drinks only", "No alcohol"],
  dietaryAccommodations: "Gluten-free, vegetarian, vegan accommodated with advance notice",
  followUpSequence: [
    { dayOffset: 1, message: "Hi {name}, thanks for reaching out to {restaurant}. We would love to help make your event special. Did you have any other questions we can answer?" },
    { dayOffset: 3, message: "Hi {name}, just checking in from {restaurant}. We still have availability for {date}. Would you like us to hold that date for you?" },
    { dayOffset: 7, message: "Hi {name}, we have a few dates open this month at {restaurant} and would love to host your event. Give us a call at {phone} when you are ready." }
  ]
};
