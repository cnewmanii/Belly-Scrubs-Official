export interface SizeOption {
  size: string;
  weight: string;
  shortHairPrice: number;
  longHairPrice: number;
}

export const services = [
  {
    id: "basic-grooming",
    name: "Basic Grooming Package",
    description: "Includes shampoo, condition, blueberry facial, ear clean, brush, blow dry, doggy cologne, and a bow or bandana.",
    price: 25,
    duration: 60,
    icon: "Droplets" as const,
    popular: true,
    sizeOptions: [
      { size: "Small", weight: "Up to 25 lbs", shortHairPrice: 25, longHairPrice: 35 },
      { size: "Medium", weight: "26-55 lbs", shortHairPrice: 40, longHairPrice: 50 },
      { size: "Large", weight: "56-95 lbs", shortHairPrice: 55, longHairPrice: 65 },
      { size: "XL", weight: "Over 95 lbs", shortHairPrice: 70, longHairPrice: 80 },
    ] as SizeOption[],
  },
  {
    id: "deluxe-grooming",
    name: "Deluxe Grooming Package",
    description: "The full treatment: shampoo, condition, blueberry facial, brush, blow dry, ear clean, cut, style, sanitary trim, teeth brushing, nail trim with buff, doggy cologne, and a bow or bandana.",
    price: 50,
    duration: 90,
    icon: "Scissors" as const,
    popular: true,
    sizeOptions: [
      { size: "Small", weight: "Up to 25 lbs", shortHairPrice: 50, longHairPrice: 60 },
      { size: "Medium", weight: "26-55 lbs", shortHairPrice: 65, longHairPrice: 75 },
      { size: "Large", weight: "56-95 lbs", shortHairPrice: 80, longHairPrice: 90 },
      { size: "XL", weight: "Over 95 lbs", shortHairPrice: 95, longHairPrice: 105 },
    ] as SizeOption[],
  },
  {
    id: "cat-bath",
    name: "Cat Bath",
    description: "Professional bathing service for cats. Price varies based on coat condition and temperament.",
    price: 30,
    priceRange: "$30 - $60",
    duration: 45,
    icon: "Droplets" as const,
    popular: false,
  },
  {
    id: "cat-groom",
    name: "Cat Groom",
    description: "Full professional grooming for cats including bath, trim, and styling.",
    price: 70,
    priceRange: "$70 - $100",
    duration: 75,
    icon: "Scissors" as const,
    popular: false,
  },
  {
    id: "cat-nail-trim",
    name: "Cat Nail Trim",
    description: "Quick and gentle nail trimming for cats.",
    price: 12,
    duration: 15,
    icon: "Sparkles" as const,
    popular: false,
  },
  {
    id: "self-wash",
    name: "Self-Service Dog Wash",
    description: "Available 24/7, 365 days a year! Two state-of-the-art Evolution Dog Wash units with built-in herbal shampoos, conditioner, towels, and blow dryers.",
    price: 12,
    duration: 45,
    icon: "Waves" as const,
    popular: true,
  },
];

export const addOns = [
  { id: "nail-trim-buff", name: "Nail Trim & Buff", price: 15, description: "Professional nail trim and smooth buff" },
  { id: "anal-gland", name: "Anal Gland Expression", price: 12, description: "Safe and gentle expression" },
  { id: "sanitary-trim", name: "Sanitary Trim", price: 12, description: "Trimming of private areas, facial hair, or paw pads — owner's preference" },
  { id: "teeth-brushing", name: "Teeth Brushing", price: 5, description: "Fresh breath and cleaner teeth" },
  { id: "deshed", name: "De-shed Treatment", price: 20, description: "Add to any Basic or Deluxe Groom" },
  { id: "dematt", name: "De-matt Treatment", price: 20, description: "Add to any Basic or Deluxe Groom ($20-$50 based on severity)" },
  { id: "deskunk", name: "De-Skunk Treatment", price: 25, description: "Add to any Basic or Deluxe Groom" },
  { id: "flea-tick", name: "Flea & Tick Treatment", price: 20, description: "Add to any Basic or Deluxe Groom" },
];

export const testimonials = [
  {
    id: "1",
    name: "Sarah M.",
    rating: 5,
    text: "Belly scRubs is the only place I trust with my golden retriever. The team is so gentle and patient, and Max always comes out looking like a show dog!",
    petName: "Max",
  },
  {
    id: "2",
    name: "James T.",
    rating: 5,
    text: "The self-service wash stations are amazing — sooo much better than the bathtub! Everything is so clean and well-maintained. Available 24/7 is a game-changer.",
    petName: "Luna",
  },
  {
    id: "3",
    name: "Emily R.",
    rating: 5,
    text: "I love the deshedding treatment. My husky used to leave fur everywhere, but after each session at Belly scRubs, it's like magic. Highly recommend!",
    petName: "Ghost",
  },
  {
    id: "4",
    name: "Michael K.",
    rating: 5,
    text: "Best in the Valley for a reason! Professional, clean, and the staff clearly loves animals. We've been coming here for years.",
    petName: "Cooper",
  },
  {
    id: "5",
    name: "Diana L.",
    rating: 5,
    text: "My anxious poodle actually gets excited to visit Belly scRubs now. The groomers are so kind and patient. Worth every penny.",
    petName: "Coco",
  },
];

export const faqs = [
  {
    question: "How long does a full grooming session take?",
    answer: "A full grooming session typically takes 1 to 1.5 hours depending on your dog's size, coat type, and condition. We never rush your pup!",
  },
  {
    question: "What's the difference between Basic and Deluxe grooming?",
    answer: "The Basic package includes shampoo, condition, blueberry facial, ear clean, brush, blow dry, cologne, and a bow or bandana. The Deluxe adds a full haircut and style, sanitary trim, teeth brushing, and nail trim with buff — the complete pampering experience!",
  },
  {
    question: "Is the self-service wash really open 24/7?",
    answer: "Yes! Our two Evolution Dog Wash units are available 24 hours a day, 7 days a week, 365 days a year. Everything you need is provided: herbal shampoos, conditioner, towels, and blow dryers.",
  },
  {
    question: "Do I need an appointment for a nail trim?",
    answer: "Standalone nail trims and buffs are available as walk-ins during business hours, or you can add them on to any grooming appointment.",
  },
  {
    question: "Do you groom cats too?",
    answer: "Yes! We offer professional bathing ($30-$60), full grooming ($70-$100), and nail trims ($12) for cats.",
  },
  {
    question: "Are prices final or can they change?",
    answer: "Prices are subject to change on all grooming services after consultation. Factors like coat condition, matting, and temperament may affect the final price. We'll always discuss pricing with you upfront.",
  },
];

export const teamMembers = [
  {
    name: "Teagan",
    role: "Dog Groomer",
    bio: "With 4 years of hands-on experience at animal shelters, a veterinary hospital, and as a professional bather and groomer, Teagan brings a compassionate touch to every session. A proud pet parent to three dogs — Seymour the dachshund, Scout the pit beagle mix, and Roxy the boxer — plus five cats and three guinea pigs, her love for animals shines through in her work. Her rescue and foster background means every pup gets extra care and patience.",
    initials: "T",
    photo: true,
  },
  {
    name: "Serena",
    role: "Dog Groomer",
    bio: "Serena discovered her love for grooming while studying at Carver Career Center and went on to volunteer at local animal shelters before spending 4 years pampering pups at PetSmart. At home, she's surrounded by her own little zoo — 2 dogs, 4 cats, 3 snakes, 2 geckos, and a bearded dragon. Serena treats every pup like her own, guaranteeing the best spa day experience every time.",
    initials: "S",
    photo: true,
  },
  {
    name: "Lindsay",
    role: "Salon Assistant",
    bio: "Lindsay brings over three years of customer service experience and two years working hands-on with animals as a kennel attendant and veterinary technician. She's skilled in baths, nail trims, and safe handling of dogs of all sizes, and she's certified in Pet CPR and First Aid — so your pups are in knowledgeable, caring hands. At home, Lindsay is a proud mom to three dogs: Enki the German Shepherd, Athena the Shepherd-Malinois mix, and Sierra the Pit mix.",
    initials: "L",
    photo: true,
  },
];

export const businessInfo = {
  name: "Belly scRubs",
  tagline: "Where Every Pup Leaves Happy",
  phone: "(304) 760-8989",
  email: "info@bellyscrubs.com",
  address: "119 State Route 34, Suite 1",
  city: "Hurricane",
  state: "WV",
  zip: "25526",
  hours: [
    { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Tuesday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Wednesday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Thursday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Friday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Saturday", open: "10:00 AM", close: "6:00 PM" },
    { day: "Sunday", open: "Closed", close: "" },
  ],
  selfWashHours: "24/7, 365 days a year",
  socialLinks: {
    instagram: "https://instagram.com/bellyscrubs",
    facebook: "https://www.facebook.com/BellyscRubs/",
  },
  directions: "Located halfway between Charleston and Huntington, just off I-64 Exit 39 (Teays Valley). Turn onto Route 34 S toward Hurricane — we're half a mile down on the right in Lakeview Plaza.",
  awards: [
    "Voted \"Best in the Valley\" for 7 consecutive years",
    "\"Best in the Tri-State\" pet groomer — Putnam County",
  ],
};

export const policies = [
  {
    title: "Pricing Policy",
    content: "Prices are subject to change on all grooming services after consultation. Factors such as coat condition, matting severity, and temperament may affect the final price.",
  },
  {
    title: "Cancellation Policy",
    content: "We require 24-hour notice for cancellations or rescheduling. Late cancellations or no-shows may be subject to a fee.",
  },
  {
    title: "Late Pickup Policy",
    content: "Please pick up your pet within 30 minutes of your notification. A daycare fee of $10/hour applies after 30 minutes past the scheduled pickup time.",
  },
  {
    title: "Matting Policy",
    content: "Severely matted coats may require a de-matt treatment ($20-$50 added to your groom, based on severity). We will always consult with you before proceeding.",
  },
  {
    title: "Aggressive Behavior",
    content: "The safety of our staff and all pets is our top priority. We reserve the right to refuse service if a dog shows aggressive behavior. A muzzle may be used if necessary.",
  },
];

export const values = [
  {
    title: "Care First",
    description: "Every pet is treated with the same love and attention we'd give our own.",
    icon: "Heart" as const,
  },
  {
    title: "Safety Always",
    description: "Experienced staff, proper equipment, and strict protocols keep your pet safe.",
    icon: "Shield" as const,
  },
  {
    title: "Spotless Clean",
    description: "Our facility is sanitized between every session. We take hygiene seriously.",
    icon: "Sparkles" as const,
  },
  {
    title: "Kindness Matters",
    description: "Patient, gentle handling for every pet, especially the nervous ones.",
    icon: "HandHeart" as const,
  },
];

export type Service = typeof services[number];
export type AddOn = typeof addOns[number];
export type Testimonial = typeof testimonials[number];
export type FAQ = typeof faqs[number];
export type TeamMember = typeof teamMembers[number];
