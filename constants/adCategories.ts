/**
 * Ad category taxonomy.
 * Users pick at least 3 categories to see relevant ads.
 * Categories with subcategories allow fine-grained control.
 */

export interface AdSubcategory {
  id: string;
  label: string;
}

export interface AdCategory {
  id: string;
  label: string;
  icon: string;
  subcategories?: AdSubcategory[];
}

export const AD_CATEGORIES: AdCategory[] = [
  {
    id: 'clothing',
    label: 'Clothing & Fashion',
    icon: '👕',
    subcategories: [
      { id: 'clothing_mens', label: 'Men\'s' },
      { id: 'clothing_womens', label: 'Women\'s' },
      { id: 'clothing_kids', label: 'Kids' },
      { id: 'clothing_athletic', label: 'Athletic Wear' },
      { id: 'clothing_outdoor', label: 'Outdoor & Work' },
      { id: 'clothing_shoes', label: 'Shoes & Sneakers' },
      { id: 'clothing_accessories', label: 'Accessories' },
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    icon: '⚽',
    subcategories: [
      { id: 'sports_football', label: 'Football' },
      { id: 'sports_basketball', label: 'Basketball' },
      { id: 'sports_baseball', label: 'Baseball' },
      { id: 'sports_soccer', label: 'Soccer' },
      { id: 'sports_hockey', label: 'Hockey' },
      { id: 'sports_golf', label: 'Golf' },
      { id: 'sports_tennis', label: 'Tennis' },
      { id: 'sports_running', label: 'Running' },
      { id: 'sports_cycling', label: 'Cycling' },
      { id: 'sports_swimming', label: 'Swimming' },
      { id: 'sports_mma', label: 'MMA & Boxing' },
      { id: 'sports_skiing', label: 'Skiing & Snowboarding' },
      { id: 'sports_surfing', label: 'Surfing' },
      { id: 'sports_climbing', label: 'Climbing' },
      { id: 'sports_yoga', label: 'Yoga & Pilates' },
      { id: 'sports_crossfit', label: 'CrossFit & Weightlifting' },
      { id: 'sports_fishing', label: 'Fishing' },
      { id: 'sports_hunting', label: 'Hunting' },
      { id: 'sports_esports', label: 'Esports & Gaming' },
      { id: 'sports_other', label: 'Other Sports' },
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Gadgets',
    icon: '💻',
    subcategories: [
      { id: 'tech_phones', label: 'Phones & Tablets' },
      { id: 'tech_computers', label: 'Computers' },
      { id: 'tech_audio', label: 'Audio & Headphones' },
      { id: 'tech_cameras', label: 'Cameras' },
      { id: 'tech_gaming', label: 'Gaming' },
      { id: 'tech_smarthome', label: 'Smart Home' },
      { id: 'tech_software', label: 'Apps & Software' },
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: '🍽️',
    subcategories: [
      { id: 'food_restaurants', label: 'Restaurants' },
      { id: 'food_cooking', label: 'Cooking & Recipes' },
      { id: 'food_coffee', label: 'Coffee & Tea' },
      { id: 'food_alcohol', label: 'Beer, Wine & Spirits' },
      { id: 'food_healthy', label: 'Health Food & Supplements' },
      { id: 'food_snacks', label: 'Snacks & Treats' },
      { id: 'food_delivery', label: 'Meal Delivery' },
    ],
  },
  {
    id: 'home',
    label: 'Home & Garden',
    icon: '🏠',
    subcategories: [
      { id: 'home_furniture', label: 'Furniture' },
      { id: 'home_decor', label: 'Decor' },
      { id: 'home_kitchen', label: 'Kitchen' },
      { id: 'home_garden', label: 'Garden & Outdoor' },
      { id: 'home_tools', label: 'Tools & Hardware' },
      { id: 'home_cleaning', label: 'Cleaning' },
    ],
  },
  {
    id: 'auto',
    label: 'Cars & Vehicles',
    icon: '🚗',
    subcategories: [
      { id: 'auto_cars', label: 'Cars' },
      { id: 'auto_trucks', label: 'Trucks & SUVs' },
      { id: 'auto_ev', label: 'Electric Vehicles' },
      { id: 'auto_motorcycles', label: 'Motorcycles' },
      { id: 'auto_parts', label: 'Parts & Accessories' },
    ],
  },
  {
    id: 'health',
    label: 'Health & Wellness',
    icon: '💪',
    subcategories: [
      { id: 'health_fitness', label: 'Fitness Equipment' },
      { id: 'health_supplements', label: 'Supplements' },
      { id: 'health_skincare', label: 'Skincare' },
      { id: 'health_mental', label: 'Mental Health' },
      { id: 'health_medical', label: 'Medical & Pharmacy' },
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & Personal Care',
    icon: '✨',
    subcategories: [
      { id: 'beauty_makeup', label: 'Makeup' },
      { id: 'beauty_hair', label: 'Hair Care' },
      { id: 'beauty_fragrance', label: 'Fragrance' },
      { id: 'beauty_grooming', label: 'Grooming' },
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: '✈️',
    subcategories: [
      { id: 'travel_flights', label: 'Flights' },
      { id: 'travel_hotels', label: 'Hotels & Stays' },
      { id: 'travel_outdoors', label: 'Camping & Outdoors' },
      { id: 'travel_cruises', label: 'Cruises' },
      { id: 'travel_gear', label: 'Travel Gear' },
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    icon: '🎬',
    subcategories: [
      { id: 'ent_streaming', label: 'Streaming & TV' },
      { id: 'ent_music', label: 'Music' },
      { id: 'ent_movies', label: 'Movies & Theater' },
      { id: 'ent_books', label: 'Books' },
      { id: 'ent_podcasts', label: 'Podcasts' },
      { id: 'ent_events', label: 'Live Events & Concerts' },
    ],
  },
  {
    id: 'hobbies',
    label: 'Hobbies & Crafts',
    icon: '🎨',
    subcategories: [
      { id: 'hobby_art', label: 'Art Supplies' },
      { id: 'hobby_photography', label: 'Photography' },
      { id: 'hobby_music_inst', label: 'Musical Instruments' },
      { id: 'hobby_crafts', label: 'Crafts & DIY' },
      { id: 'hobby_woodworking', label: 'Woodworking' },
      { id: 'hobby_sewing', label: 'Sewing & Knitting' },
      { id: 'hobby_collecting', label: 'Collecting' },
      { id: 'hobby_gardening', label: 'Gardening' },
    ],
  },
  {
    id: 'pets',
    label: 'Pets',
    icon: '🐕',
    subcategories: [
      { id: 'pets_dogs', label: 'Dogs' },
      { id: 'pets_cats', label: 'Cats' },
      { id: 'pets_other', label: 'Other Pets' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Business',
    icon: '💰',
    subcategories: [
      { id: 'finance_banking', label: 'Banking' },
      { id: 'finance_investing', label: 'Investing' },
      { id: 'finance_insurance', label: 'Insurance' },
      { id: 'finance_realestate', label: 'Real Estate' },
      { id: 'finance_smallbiz', label: 'Small Business' },
    ],
  },
  {
    id: 'education',
    label: 'Education & Learning',
    icon: '📚',
    subcategories: [
      { id: 'edu_courses', label: 'Online Courses' },
      { id: 'edu_languages', label: 'Languages' },
      { id: 'edu_college', label: 'College & University' },
      { id: 'edu_professional', label: 'Professional Development' },
      { id: 'edu_kids', label: 'Kids Education' },
    ],
  },
  {
    id: 'family',
    label: 'Family & Kids',
    icon: '👨‍👩‍👧‍👦',
    subcategories: [
      { id: 'family_baby', label: 'Baby & Toddler' },
      { id: 'family_toys', label: 'Toys & Games' },
      { id: 'family_parenting', label: 'Parenting' },
      { id: 'family_family_activities', label: 'Family Activities' },
    ],
  },
  {
    id: 'local',
    label: 'Local Businesses',
    icon: '📍',
    subcategories: [
      { id: 'local_restaurants', label: 'Local Restaurants' },
      { id: 'local_services', label: 'Local Services' },
      { id: 'local_shops', label: 'Local Shops' },
      { id: 'local_events', label: 'Local Events' },
    ],
  },
  {
    id: 'sustainability',
    label: 'Sustainability & Green',
    icon: '🌱',
    subcategories: [
      { id: 'green_products', label: 'Eco Products' },
      { id: 'green_energy', label: 'Clean Energy' },
      { id: 'green_fashion', label: 'Sustainable Fashion' },
    ],
  },
  {
    id: 'charity',
    label: 'Nonprofits & Causes',
    icon: '❤️',
  },
];

export const MIN_AD_CATEGORIES = 3;

export const AD_FREE_BACKGROUNDS = [
  { id: 'bg_warm_gradient', label: 'Warm Gradient', colors: ['#F5F0E8', '#E8DFD0'] },
  { id: 'bg_ocean', label: 'Ocean', colors: ['#E0F2FE', '#BAE6FD'] },
  { id: 'bg_forest', label: 'Forest', colors: ['#ECFDF5', '#D1FAE5'] },
  { id: 'bg_sunset', label: 'Sunset', colors: ['#FEF3C7', '#FDE68A'] },
  { id: 'bg_slate', label: 'Slate', colors: ['#F1F5F9', '#E2E8F0'] },
  { id: 'bg_lavender', label: 'Lavender', colors: ['#F5F3FF', '#EDE9FE'] },
  { id: 'bg_midnight', label: 'Midnight', colors: ['#1E1E2E', '#2D2D3F'] },
  { id: 'bg_plain', label: 'Clean White', colors: ['#FFFFFF', '#FFFFFF'] },
] as const;
