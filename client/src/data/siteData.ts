export const services = [
  {
    id: "full-grooming",
    name: "Full Grooming",
    description: "Complete grooming experience including bath, haircut, nail trim, ear cleaning, and finishing touches.",
    price: 75,
    duration: 90,
    icon: "Scissors" as const,
    popular: true,
  },
  {
    id: "bath-and-tidy",
    name: "Bath & Tidy",
    description: "Thorough bath, blow dry, brush out, nail trim, and ear cleaning. Perfect for pups between full grooms.",
    price: 45,
    duration: 60,
    icon: "Droplets" as const,
    popular: false,
  },
  {
    id: "deshedding",
    name: "Deshedding Treatment",
    description: "Specialized deshedding bath and treatment to reduce loose fur and keep your pup comfortable all season.",
    price: 55,
    duration: 75,
    icon: "Wind" as const,
    popular: false,
  },
  {
    id: "nail-trim",
    name: "Nail Trim",
    description: "Quick and gentle nail trimming by experienced groomers. Walk-ins welcome!",
    price: 15,
    duration: 15,
    icon: "Sparkles" as const,
    popular: false,
  },
  {
    id: "self-wash",
    name: "Self-Service Wash",
    description: "Use our professional stations with warm water, premium shampoos, towels, and dryers. We handle the cleanup!",
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
    text: "Belly Scrubs is the only place I trust with my golden retriever. The team is so gentle and patient, and Max always comes out looking like a show dog!",
    petName: "Max",
  },
  {
    id: "2",
    name: "James T.",
    rating: 5,
    text: "The self-service wash stations are amazing. Everything is so clean and well-maintained. My pup actually enjoys bath time here!",
    petName: "Luna",
  },
  {
    id: "3",
    name: "Emily R.",
    rating: 5,
    text: "I love the deshedding treatment. My husky used to leave fur everywhere, but after each session at Belly Scrubs, it's like magic. Highly recommend!",
    petName: "Ghost",
  },
  {
    id: "4",
    name: "Michael K.",
    rating: 5,
    text: "Professional, clean, and the staff clearly loves animals. Booking online is super easy too. We've been coming here for over a year!",
    petName: "Cooper",
  },
  {
    id: "5",
    name: "Diana L.",
    rating: 5,
    text: "My anxious poodle actually gets excited to visit Belly Scrubs now. The groomers are so kind and patient. Worth every penny.",
    petName: "Coco",
  },
];

export const faqs = [
  {
    question: "How long does a full grooming session take?",
    answer: "A full grooming session typically takes 1.5 to 2 hours depending on your dog's size, coat type, and condition. We never rush your pup!",
  },
  {
    question: "Do I need to bring anything for the self-service wash?",
    answer: "Nope! We provide everything you need: premium shampoo, conditioner, towels, aprons, ear cleaner, and high-velocity dryers. Just bring your pup and a leash.",
  },
  {
    question: "What vaccinations are required?",
    answer: "All dogs must be current on Rabies, DHPP, and Bordetella vaccinations. Please bring proof of vaccination for your first visit.",
  },
  {
    question: "Can I stay and watch during grooming?",
    answer: "We find that dogs tend to be calmer without their owners present. However, you're welcome to check in anytime and we'll send photo updates!",
  },
  {
    question: "What if my dog has matting?",
    answer: "We assess matting on arrival. Minor matting is included in grooming. Severe matting may require a shave-down for your dog's comfort and safety, which we'll discuss with you before proceeding.",
  },
  {
    question: "Do you accept walk-ins?",
    answer: "Walk-ins are welcome for nail trims and self-service wash stations (subject to availability). Full grooming and specialty services require an appointment.",
  },
];

export const teamMembers = [
  {
    name: "Jordan Ellis",
    role: "Head Groomer & Founder",
    bio: "With over 12 years of professional grooming experience, Jordan founded Belly Scrubs to create a calm, safe space for every pup.",
    initials: "JE",
  },
  {
    name: "Alex Rivera",
    role: "Senior Groomer",
    bio: "Alex specializes in breed-specific cuts and has a knack for calming even the most anxious pups. Certified in canine first aid.",
    initials: "AR",
  },
  {
    name: "Sam Patel",
    role: "Groomer & Bath Specialist",
    bio: "Sam's gentle touch and attention to detail make every dog feel pampered. Specializes in deshedding and coat treatments.",
    initials: "SP",
  },
  {
    name: "Casey Nguyen",
    role: "Customer Experience Manager",
    bio: "Casey ensures every visit runs smoothly from booking to pickup. Always has a treat ready for your furry friend!",
    initials: "CN",
  },
];

export const businessInfo = {
  name: "Belly Scrubs",
  tagline: "Where Every Pup Leaves Happy",
  phone: "(555) 123-4567",
  email: "hello@bellyscrubs.com",
  address: "742 Pawsome Avenue, Suite 100",
  city: "Portland",
  state: "OR",
  zip: "97201",
  hours: [
    { day: "Monday", open: "8:00 AM", close: "6:00 PM" },
    { day: "Tuesday", open: "8:00 AM", close: "6:00 PM" },
    { day: "Wednesday", open: "8:00 AM", close: "6:00 PM" },
    { day: "Thursday", open: "8:00 AM", close: "7:00 PM" },
    { day: "Friday", open: "8:00 AM", close: "7:00 PM" },
    { day: "Saturday", open: "9:00 AM", close: "5:00 PM" },
    { day: "Sunday", open: "Closed", close: "" },
  ],
  socialLinks: {
    instagram: "https://instagram.com/bellyscrubs",
    facebook: "https://facebook.com/bellyscrubs",
    tiktok: "https://tiktok.com/@bellyscrubs",
  },
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
    description: "Every dog is treated with the same love and attention we'd give our own pets.",
    icon: "Heart" as const,
  },
  {
    title: "Safety Always",
    description: "Certified staff, proper equipment, and strict protocols keep your pup safe.",
    icon: "Shield" as const,
  },
  {
    title: "Spotless Clean",
    description: "Our facility is sanitized between every session. We take hygiene seriously.",
    icon: "Sparkles" as const,
  },
  {
    title: "Kindness Matters",
    description: "Patient, gentle handling for every dog, especially the nervous ones.",
    icon: "HandHeart" as const,
  },
];

export type Service = typeof services[number];
export type AddOn = typeof addOns[number];
export type Testimonial = typeof testimonials[number];
export type FAQ = typeof faqs[number];
export type TeamMember = typeof teamMembers[number];
