import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SoapDivider } from "@/components/layout/SoapDivider";
import { teamMembers, values, faqs, policies } from "@/data/siteData";
import teaganPhoto from "@assets/image_1772080507657.png";
import serenaPhoto from "@assets/image_1772080571987.png";
import lindsayPhoto from "@assets/614480787_1533437184993625_3713082189265715229_n_1772080700926.jpg";

const teamPhotos: Record<string, string> = {
  Teagan: teaganPhoto,
  Serena: serenaPhoto,
  Lindsay: lindsayPhoto,
};
import {
  Heart,
  Shield,
  Sparkles,
  HeartHandshake,
  Thermometer,
  Droplets,
  Dog,
  CheckCircle2,
} from "lucide-react";

const valueIcons: Record<string, any> = {
  Heart,
  Shield,
  Sparkles,
  HandHeart: HeartHandshake,
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function StorySection() {
  return (
    <section className="px-6 pt-32 pb-20" data-testid="section-story">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.6 }}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide">
              Our Story
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold text-foreground mb-8"
          >
            Built with Love for{" "}
            <span className="text-primary">Every Pup</span>
          </motion.h1>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-muted-foreground leading-relaxed space-y-4 max-w-2xl mx-auto text-left sm:text-center"
          >
            <p>
              Belly scRubs has been a staple in Hurricane, West Virginia since 2010, built on a simple idea: every pet deserves to feel clean, comfortable, and cared for — without the stress. Our shop was designed from the ground up to be a calm, welcoming space for pets and their humans.
            </p>
            <p>
              Located in Lakeview Plaza, halfway between Charleston and Huntington just off I-64 Exit 39, we've been proudly serving the Putnam County community for over 15 years. We offer award-winning professional grooming for dogs and cats, plus two state-of-the-art Evolution Dog Wash self-service units available 24/7.
            </p>
            <p>
              Whether your pup is here for a full grooming session, a walk-in nail trim, or you're using our self-service wash stations at 2 AM, the experience is the same: clean, safe, and happy. That's the Belly scRubs promise — and it's why we've been voted "Best in the Valley" for 7 consecutive years.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="relative" data-testid="section-values">
      <SoapDivider fillClass="text-[#BAD9E5]/20 dark:text-[#BAD9E5]/5" />
      <div className="bg-[#BAD9E5]/20 dark:bg-[#BAD9E5]/5 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-14"
          >
            What We Stand For
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {values.map((value) => {
              const Icon = valueIcons[value.icon] || Heart;
              return (
                <motion.div key={value.title} variants={fadeUp} transition={{ duration: 0.4 }}>
                  <Card className="p-6 text-center h-full hover-elevate" data-testid={`card-value-${value.title.toLowerCase().replace(/\s/g, "-")}`}>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
      <SoapDivider flip fillClass="text-[#BAD9E5]/20 dark:text-[#BAD9E5]/5" />
    </section>
  );
}

function TeamSection() {
  return (
    <section className="px-6 py-20" data-testid="section-team">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-4"
        >
          Meet the Team
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-muted-foreground text-center mb-14 max-w-lg mx-auto"
        >
          Experienced and passionate about making every pup feel special
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {teamMembers.map((member) => (
            <motion.div key={member.name} variants={fadeUp} transition={{ duration: 0.4 }}>
              <Card className="overflow-hidden h-full hover-elevate" data-testid={`card-team-${member.initials}`}>
                {teamPhotos[member.name] && (
                  <img
                    src={teamPhotos[member.name]}
                    alt={`${member.name} with her pets`}
                    className="w-full h-72 object-cover object-center"
                  />
                )}
                <div className="p-6">
                  <h3 className="font-semibold text-xl text-foreground mb-1">{member.name}</h3>
                  <p className="text-sm text-primary font-medium mb-4">{member.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FacilitySection() {
  const features = [
    { icon: Thermometer, title: "Warm Water", desc: "Temperature-controlled warm water for a comfortable bath every time." },
    { icon: Droplets, title: "Premium Products", desc: "We use all-natural, hypoallergenic shampoos and conditioners." },
    { icon: Dog, title: "Comfortable Space", desc: "Spacious grooming tables, non-slip surfaces, and a calm environment." },
    { icon: CheckCircle2, title: "Sanitized Daily", desc: "Every station is thoroughly cleaned and sanitized between each session." },
  ];

  return (
    <section className="relative" data-testid="section-facility">
      <SoapDivider fillClass="text-[#BAD9E5]/15 dark:text-[#BAD9E5]/5" />
      <div className="bg-[#BAD9E5]/15 dark:bg-[#BAD9E5]/5 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-14"
          >
            Our Facility
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp} transition={{ duration: 0.4 }}>
                <Card className="p-6 flex items-start gap-4 h-full hover-elevate" data-testid={`card-facility-${feature.title.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
      <SoapDivider flip fillClass="text-[#BAD9E5]/15 dark:text-[#BAD9E5]/5" />
    </section>
  );
}

function PoliciesSection() {
  return (
    <section className="px-6 py-20" data-testid="section-policies">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-4"
        >
          Policies & FAQ
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-muted-foreground text-center mb-10"
        >
          Transparency is important to us. Here's what to know.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="font-semibold text-lg text-foreground mb-4">Policies</h3>
          <Accordion type="single" collapsible className="space-y-2 mb-10">
            {policies.map((policy, i) => (
              <AccordionItem key={i} value={`policy-${i}`} className="border rounded-xl px-5 data-[state=open]:bg-card">
                <AccordionTrigger className="text-sm font-medium text-foreground py-4" data-testid={`button-policy-${i}`}>
                  {policy.title}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4" data-testid={`text-policy-${i}`}>
                  {policy.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <h3 className="font-semibold text-lg text-foreground mb-4">Frequently Asked Questions</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-5 data-[state=open]:bg-card">
                <AccordionTrigger className="text-sm font-medium text-foreground py-4" data-testid={`button-about-faq-${i}`}>
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4" data-testid={`text-about-faq-${i}`}>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

export default function About() {
  return (
    <main>
      <StorySection />
      <ValuesSection />
      <TeamSection />
      <FacilitySection />
      <PoliciesSection />
    </main>
  );
}
