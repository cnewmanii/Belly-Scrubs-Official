export const services = [
  {
    id: "full-grooming",
    name: "Full Grooming",
    description: "Complete professional grooming for dogs and cats including bath, haircut, nail trim, ear cleaning, and finishing touches. Award-winning service!",
    price: 75,
    duration: 90,
    icon: "Scissors" as const,
    popular: true,
  },
  {
    id: "bath-and-tidy",
    name: "Bath & Tidy",
    description: "Thorough professional bath, blow dry, brush out, nail trim, and ear cleaning. Perfect for pups between full grooms.",
    price: 45,
    duration: 60,
    icon: "Droplets" as const,
    popular: false,
  },
  {
    id: "deshedding",
    name: "Deshedding Treatment",
    description: "Specialized deshedding bath and treatment to reduce loose fur and keep your pup comfortable all season long.",
    price: 55,
    duration: 75,
    icon: "Wind" as const,
    popular: false,
  },
  {
    id: "nail-trim",
    name: "Walk-In Nail Trim",
    description: "Quick and gentle nail trimming for dogs and cats. Walk-ins welcome Monday and Wednesday through Saturday!",
    price: 15,
    duration: 15,
    icon: "Sparkles" as const,
    popular: false,
  },
  {
    id: "self-wash",
    name: "Self-Service Dog Wash",
    description: "Available 24/7, 365 days a year! Two state-of-the-art Evolution Dog Wash units with built-in herbal shampoos, conditioner, towels, and blow dryers.",
    price: 20,
    duration: 45,
    icon: "Waves" as const,
    popular: true,
  },
];

export const addOns = [
  { id: "teeth-brushing", name: "Teeth Brushing", price: 10, description: "Fresh breath and cleaner teeth" },
  { id: "flea-treatment", name: "Flea & Tick Treatment", price: 15, description: "Preventative flea and tick bath" },
  { id: "blueberry-facial", name: "Blueberry Facial", price: 12, description: "Gentle tear stain removal" },
  { id: "paw-balm", name: "Paw Pad Balm", price: 8, description: "Moisturize and protect paw pads" },
  { id: "cologne", name: "Finishing Cologne", price: 5, description: "Fresh scent to finish the look" },
  { id: "nail-grinding", name: "Nail Grinding", price: 10, description: "Smooth edges after trim" },
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
    answer: "A full grooming session typically takes 1.5 to 2 hours depending on your dog's size, coat type, and condition. We never rush your pup!",
  },
  {
    question: "Is the self-service wash really open 24/7?",
    answer: "Yes! Our two Evolution Dog Wash units are available 24 hours a day, 7 days a week, 365 days a year. Everything you need is provided: herbal shampoos, conditioner, towels, and blow dryers.",
  },
  {
    question: "Do I need an appointment for a nail trim?",
    answer: "Nope! Walk-in nail trims for both dogs and cats are available Monday and Wednesday through Saturday, 9 AM to 5 PM. No appointment needed.",
  },
  {
    question: "Do you groom cats too?",
    answer: "Yes! We offer professional grooming services for both dogs and cats by appointment.",
  },
  {
    question: "What if my dog has matting?",
    answer: "We assess matting on arrival. Minor matting is included in grooming. Severe matting may require a shave-down for your dog's comfort and safety, which we'll discuss with you before proceeding.",
  },
  {
    question: "Do you accept walk-ins for grooming?",
    answer: "Walk-ins are welcome for nail trims and self-service wash stations. Full grooming and specialty services require an appointment.",
  },
];

export const teamMembers = [
  {
    name: "Phil Schenk",
    role: "Owner & Founder",
    bio: "Phil founded Belly scRubs in 2010 to create a clean, welcoming space where every pet gets treated like family. Over 15 years of dedication to pets in the Putnam County area.",
    initials: "PS",
  },
  {
    name: "Nicole",
    role: "Chief Operations Officer",
    bio: "Nicole has been keeping Belly scRubs running smoothly since 2014. She ensures every visit is a great experience from start to finish.",
    initials: "N",
  },
  {
    name: "Alyssa",
    role: "Professional Groomer",
    bio: "Alyssa joined the team in 2017 and brings a gentle, skilled touch to every grooming session. She has a gift for calming even the most nervous pups.",
    initials: "A",
  },
];

export const businessInfo = {
  name: "Belly scRubs",
  tagline: "Where Every Pup Leaves Happy",
  phone: "(304) 760-8989",
  email: "bellyscrubs@gmail.com",
  address: "119 State Route 34, Suite 1",
  city: "Hurricane",
  state: "WV",
  zip: "25526",
  hours: [
    { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Tuesday", open: "Closed", close: "" },
    { day: "Wednesday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Thursday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Friday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Saturday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Sunday", open: "9:00 AM", close: "5:00 PM" },
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
    title: "Vaccination Policy",
    content: "All dogs must have current Rabies, DHPP, and Bordetella vaccinations. Proof is required on your first visit and when boosters are due.",
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
    content: "Severely matted coats may require a shave-down for the comfort and safety of your pet. We will always consult with you before proceeding. An additional de-matting fee may apply.",
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
