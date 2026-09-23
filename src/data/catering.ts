export const MEAL_DATA: Record<string, { id: string, label: string, cost: number, sat: number }[]> = {
  Basic: [
    { id: "b1", label: "Butter Cookie (Single)", cost: 0.30, sat: 5 },
    { id: "b2", label: "Pretzel Sticks (Mini Bag)", cost: 0.35, sat: 5 },
    { id: "b3", label: "Fruit Gummies (Mini Bag)", cost: 0.35, sat: 5 },
    { id: "b4", label: "Cracker Mix", cost: 0.41, sat: 5 },
    { id: "b5", label: "Roasted Peanuts", cost: 0.44, sat: 5 },
    { id: "b6", label: "Fresh Apple", cost: 0.47, sat: 5 },
    { id: "b7", label: "Potato Chips", cost: 0.53, sat: 6 },
    { id: "b8", label: "Oat Granola Bar", cost: 0.56, sat: 6 },
    { id: "b9", label: "Chocolate Bar", cost: 0.65, sat: 6 },
    { id: "b10", label: "Baked Croissant", cost: 0.71, sat: 6 },
    { id: "b11", label: "Chocolate Muffin", cost: 0.77, sat: 6 },
    { id: "b12", label: "Mini Salami", cost: 0.83, sat: 6 },
    { id: "b13", label: "Instant Tomato Soup", cost: 0.89, sat: 6 },
    { id: "b14", label: "Simple Cheese Sandwich", cost: 1.65, sat: 7 },
    { id: "b15", label: "Ham Sandwich", cost: 1.89, sat: 8 }
  ],
  Standard: [
    { id: "s1", label: "Chocolate Brownie", cost: 1.48, sat: 7 },
    { id: "s2", label: "Rice Pudding with Cinnamon", cost: 2.07, sat: 9 },
    { id: "s3", label: "Small Fruit Salad", cost: 2.24, sat: 9 },
    { id: "s4", label: "Couscous Salad", cost: 2.36, sat: 9 },
    { id: "s5", label: "Cold Pasta Salad", cost: 2.48, sat: 9 },
    { id: "s6", label: "Falafel Wrap", cost: 2.66, sat: 9 },
    { id: "s7", label: "Scrambled Eggs with Spinach", cost: 2.83, sat: 9 },
    { id: "s8", label: "Pretzel Baguette Sandwich", cost: 2.95, sat: 9 },
    { id: "s9", label: "Chicken Strips Wrap", cost: 3.07, sat: 9 },
    { id: "s10", label: "Pasta with Tomato Sauce", cost: 3.25, sat: 10 },
    { id: "s11", label: "Cheese Spaetzle", cost: 3.54, sat: 11 },
    { id: "s12", label: "Vegetarian Vegetable Curry", cost: 3.84, sat: 11 },
    { id: "s13", label: "Sliced Chicken with Rice", cost: 4.25, sat: 12 },
    { id: "s14", label: "Turkey Breast with Broccoli", cost: 4.60, sat: 13 },
    { id: "s15", label: "Beef Goulash with Potatoes", cost: 5.02, sat: 13 }
  ],
  Premium: [
    { id: "p1", label: "Panna Cotta with Berry Ragout", cost: 3.84, sat: 12 },
    { id: "p2", label: "Fine Chocolate Tart", cost: 4.13, sat: 12 },
    { id: "p3", label: "Quinoa Salad with Avocado", cost: 5.02, sat: 14 },
    { id: "p4", label: "Fried Wok Vegetables with Tofu", cost: 5.31, sat: 14 },
    { id: "p5", label: "Cheese Platter (Standard)", cost: 5.61, sat: 14 },
    { id: "p6", label: "Authentic Chicken Tikka Masala", cost: 6.20, sat: 14 },
    { id: "p7", label: "Truffle Pasta (Vegetarian)", cost: 7.08, sat: 16 },
    { id: "p8", label: "Cold Platter (Fine Cold Cuts)", cost: 7.97, sat: 17 },
    { id: "p9", label: "Sushi Selection", cost: 9.44, sat: 18 },
    { id: "p10", label: "Duck Breast with Red Cabbage", cost: 10.33, sat: 20 },
    { id: "p11", label: "Veal Ragout with Polenta", cost: 10.62, sat: 21 },
    { id: "p12", label: "Shrimp Curry", cost: 10.92, sat: 22 },
    { id: "p13", label: "Salmon Fillet on Leaf Spinach", cost: 11.80, sat: 24 },
    { id: "p14", label: "Lamb Chop with Rosemary Potatoes", cost: 12.98, sat: 26 },
    { id: "p15", label: "Beef Fillet with French Beans", cost: 14.16, sat: 27 }
  ],
  Luxury: [
    { id: "l1", label: "Freshly Baked Soufflé", cost: 10.62, sat: 21 },
    { id: "l2", label: "Matcha Gourmet Dessert", cost: 12.98, sat: 27 },
    { id: "l3", label: "Fresh Oysters", cost: 20.65, sat: 29 },
    { id: "l4", label: "Cheese Trolley (Premium)", cost: 26.55, sat: 32 },
    { id: "l5", label: "Fresh Truffle Risotto", cost: 29.50, sat: 35 },
    { id: "l6", label: "Foie Gras", cost: 38.35, sat: 38 },
    { id: "l7", label: "Balik Salmon", cost: 41.30, sat: 41 },
    { id: "l8", label: "Fried Sole", cost: 44.25, sat: 43 },
    { id: "l9", label: "Venison Saddle with Celery Puree", cost: 47.20, sat: 46 },
    { id: "l10", label: "Peking Duck (Portion)", cost: 50.15, sat: 49 },
    { id: "l11", label: "Kobe Beef Burger", cost: 53.10, sat: 52 },
    { id: "l12", label: "Chateaubriand", cost: 56.05, sat: 54 },
    { id: "l13", label: "Caviar Service (incl. Blinis)", cost: 59.00, sat: 57 },
    { id: "l14", label: "Lobster Thermidor", cost: 64.90, sat: 59 },
    { id: "l15", label: "Wagyu Beef with Asparagus", cost: 82.60, sat: 60 }
  ]
};

export const EXTRAS_OPTIONS: Record<string, { label: string, sat: number, cost: number, wifiRequired?: boolean, galleyRequired?: boolean, group?: string }> = {
  none: { label: 'None', sat: 0, cost: 0 },
  wifi_limited: { label: 'Limited Free Wi-Fi', sat: 8, cost: 5, wifiRequired: true, group: 'wifi' },
  wifi_unlimited: { label: 'Unlimited Free Wi-Fi', sat: 20, cost: 15, wifiRequired: true, group: 'wifi' },
  amenities: { label: 'Basic Amenity Kit', sat: 12, cost: 10, group: 'amenities' },
  amenities_premium: { label: 'Premium Amenity Kit', sat: 25, cost: 20, group: 'amenities' },
  amenities_luxury: { label: 'Luxury Amenity Kit', sat: 50, cost: 65, group: 'amenities' },
  pillows: { label: 'Pillows & Blankets', sat: 10, cost: 5 },
  headphones: { label: 'Noise-Canceling Headphones', sat: 20, cost: 15 },
  magazine: { label: 'Premium Magazines', sat: 5, cost: 3 },
  pajamas: { label: 'Luxury Pajamas', sat: 35, cost: 35 },
  slippers: { label: 'Cozy Slippers', sat: 8, cost: 12 },
  water: { label: 'Free Water', sat: 5, cost: 1 },
  softdrinks: { label: 'Free Softdrinks', sat: 12, cost: 3 },
  alcohol: { label: 'Free Alcoholic Beverages', sat: 25, cost: 12, group: 'alcohol' },
  premium_alcohol: { label: 'Free Premium Alcohol', sat: 45, cost: 40, galleyRequired: true, group: 'alcohol' }
};

export const SERVICE_OPTIONS: Record<string, { label: string, sat: number, cost: number }> = {
  none: { label: 'Standard Crew', sat: 0, cost: 0 },
  drinks: { label: 'Individual Beverage Service', sat: 8, cost: 5 },
  seat_coord: { label: 'Seat Selection', sat: 5, cost: 3 },
  wheelchair: { label: 'Onboard Wheelchair Assistance', sat: 12, cost: 12 },
  medical: { label: 'Medical Intervention', sat: 15, cost: 20 },
  dine_demand: { label: 'Dine-on-Demand', sat: 28, cost: 40 },
  turndown: { label: 'Turndown Service', sat: 35, cost: 60 },
  sommelier: { label: 'Inflight Sommelier Service', sat: 20, cost: 25 }
};
