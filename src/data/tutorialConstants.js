// ===== Reference data (churches, age ranges, etc.) =====

export const CHURCH_LIST = [
  { name: 'Austin Ethiopian Gospel Believers Church', city: 'Austin, TX' },
  { name: 'El-Shaddai International Ethiopian Church', city: 'Dallas, TX' },
  { name: 'Ethiopian Christian Fellowship Church Missouri (ECFCMO)', city: 'St. Louis, MO' },
  { name: 'Ethiopian Christians Fellowship Church in Houston', city: 'Houston, TX' },
  { name: 'Ethiopian Christians Fellowship Church in Kansas', city: 'Kansas City, KS' },
  { name: 'Ethiopian Evangelical Christian Church in Austin', city: 'Austin, TX' },
  { name: 'Ethiopian Evangelical Church Allen', city: 'Allen, TX' },
  { name: 'Ethiopian Evangelical Church in Dallas', city: 'Dallas, TX' },
  { name: 'Ethiopian Evangelical Church Irving', city: 'Irving, TX' },
  { name: 'Gospel Believers Prayer house Kansas', city: 'Kansas City, KS' },
  { name: 'Rehoboth Ethiopian Evangelical Church, Tulsa', city: 'Broken Arrow, OK' },
  { name: 'The Redeemer of the World Evangelical Church', city: 'Dallas, TX' },
  { name: 'Other (specify below)', city: '' },
]

export const AGE_RANGES = [
  { id: 'infant', label: 'Infant', age: '0–1 yrs' },
  { id: 'child', label: 'Child', age: '2–11 yrs' },
  { id: 'youth', label: 'Youth', age: '12–17 yrs' },
  { id: 'adult', label: 'Adult', age: '18+ yrs' },
]

export const GRADE_LEVELS_YOUTH = ['7th – 8th Grade', '9th – 10th Grade', '11th Grade', '12th Grade']
export const GRADE_LEVELS_ADULT = [...GRADE_LEVELS_YOUTH, 'College / Career']

export const CHILD_GROUPS = [
  { id: 'preschool', label: 'Preschool', age: '2–4 yrs' },
  { id: 'children', label: 'Children', age: '5–10 yrs' },
]

export const SHIRT_SIZES = ['No preference', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

export const ATTENDANCE_TYPES = [
  { id: 'full', label: 'Full Conference', detail: 'All 4 days — includes lodging, meals & all sessions' },
  { id: 'partial', label: 'Partial Attendance', detail: '$40/night — lodging included, select meals per day' },
  { id: 'kote', label: 'Kote (Daily commuters)', detail: '$10/day — day attendance only, no lodging, select meals' },
]

export const CONFERENCE_DAYS = [
  { id: 'thu', dow: 'THU', day: '30', month: 'Jul', label: 'THU, JUL 30' },
  { id: 'fri', dow: 'FRI', day: '31', month: 'Jul', label: 'FRI, JUL 31' },
  { id: 'sat', dow: 'SAT', day: '1', month: 'Aug', label: 'SAT, AUG 1' },
  { id: 'sun', dow: 'SUN', day: '2', month: 'Aug', label: 'SUN, AUG 2' },
]

// Meal slots per day (Sunday ends with lunch — no dinner)
const BLD = [
  { id: 'breakfast', label: 'Breakfast', time: '08:00' },
  { id: 'lunch', label: 'Lunch', time: '12:00' },
  { id: 'dinner', label: 'Dinner', time: '17:30' },
]
export const MEAL_SLOTS = {
  thu: BLD,
  fri: BLD,
  sat: BLD,
  sun: [BLD[0], BLD[1]],
}

// Pricing constants — mirrored from the live FellowFlow `pricing_config` row
// for Midwest Conference 2026 (event_id 20bad896-…). Verified against actual
// registration `computed_amount` + payment totals in Supabase.
export const MEAL_PRICE_ADULT = 12
export const MEAL_PRICE_YOUTH = 12
export const MEAL_PRICE_CHILD = 8
export const MEAL_PRICE_KOTE = 10
// Back-compat default (used where the age category is adult, as in the tutorial demo)
export const MEAL_PRICE = MEAL_PRICE_ADULT

export const ADULT_DAILY_PRICE = 40 // $40 / chargeable night
export const KOTE_PRICE_PER_DAY = 10
export const INFANT_DAILY_FEE = 10

// Full Conference uses `daily_rate` mode: 3 chargeable nights for a Thu–Sun
// event (Sunday excluded). 3 × $40 = $120 for adults/children.
export const FULL_CONFERENCE_CHARGEABLE_NIGHTS = 3
export const FULL_CONFERENCE_PRICE_ADULT = ADULT_DAILY_PRICE * FULL_CONFERENCE_CHARGEABLE_NIGHTS

// Child full conference: flat $120 from pricing_config.child_full_price
export const FULL_CONFERENCE_PRICE_CHILD = 120

// $10/day campus insurance — applies to EVERY individual regardless of age
// or whether a child shares a bed with a parent. 4 conference days × $10.
export const CAMPUS_INSURANCE_PER_DAY = 10
export const FULL_CONFERENCE_DAYS = 4
export const FULL_CONFERENCE_INSURANCE_TOTAL = CAMPUS_INSURANCE_PER_DAY * FULL_CONFERENCE_DAYS

// Full Conference automatically includes all meals for the stay.
// Real DB registrations (e.g. Henok adult full_conference) record exactly 9
// meal selections: 3 full days × B/L/D = 9 meals. Sunday morning B/L may also
// be covered but the canonical count in production is 9.
export const FULL_CONFERENCE_MEAL_COUNT = 9

// Stripe standard card processing: 2.9% + $0.30 fixed.
export const PROCESSING_FEE_RATE = 0.029
export const PROCESSING_FEE_FIXED = 0.3

// Legacy alias (kept for existing references)
export const PARTIAL_PRICE_PER_NIGHT = ADULT_DAILY_PRICE

// ===== Phase definitions =====
// Each phase has its own audio clip, fallback duration, and local timeline (pct 0..1).
// Steps are GLOBAL monotonic integers so formState still keys off a single step index.

export const PHASES = [
  {
    id: 'intro',
    title: 'Intro',
    audioFile: '/voiceover-intro.wav',
    fallbackMs: 35_000,
    script:
      "Say warmly and professionally: Welcome to FellowFlow... where we believe conference registration should be the easiest part of your event planning. Today... we're excited to show you how we've transformed the complex sign-up process into a seamless experience. Our promise is simple... conference registration made effortless. To see FellowFlow in action... let's look at our upcoming flagship event: the Midwest Conference 2026. We've distilled the registration process into three intuitive steps.",
    events: [
      { pct: 0.0, step: 1, text: 'Welcome to FellowFlow...' },
      {
        pct: 0.12,
        step: 2,
        text: '...where we believe conference registration should be the easiest part of your event planning.',
      },
      {
        pct: 0.3,
        step: 3,
        text: "Today... we're excited to show you how we've transformed the complex sign-up process into a seamless experience.",
      },
      { pct: 0.5, step: 4, text: 'Our promise is simple... conference registration made effortless.' },
      {
        pct: 0.62,
        step: 5,
        // Trigger the slide transition ~600ms before voice reaches this cue.
        // Tuned so the animation *starts* as the voice finishes saying
        // "…effortless" and completes just as "To see FellowFlow" begins.
        leadMs: 600,
        text: "To see FellowFlow in action... let's look at our upcoming flagship event: the Midwest Conference 2026.",
      },
      { pct: 0.85, step: 6, text: "We've distilled the registration process into three intuitive steps." },
    ],
  },
  {
    id: 'form',
    title: 'Dynamic Form',
    audioFile: '/voiceover-form.wav',
    fallbackMs: 85_000,
    script:
      "Say warmly and professionally: Let's jump into the first step. Before entering our details... notice how the form dynamically adapts to your service preference. If you select the Amharic service... the age ranges are simplified into broad categories like Infant, Child, Youth, and Adult. However... if you switch to the English service, the system reveals more granular service groups to ensure attendees are placed in the right sessions. Under Child... you'll see Preschool and Children options with their age ranges. Youth... opens a Grade slash Level dropdown from seventh through twelfth grade. And Adult... adds College slash Career to that dropdown. Now that we see how it works... let's register our primary attendee. We'll type Test, for the first name... and User, for the last name. We'll select the Amharic service... and the Adult age range. Next, we select our Gender... which is vital because the system uses it to ensure proper dormitory and lodging assignments. We'll choose Male. For our Church... we'll pick Ethiopian Evangelical Christian Church in Austin from the list. Notice... the City field auto-fills to Austin, Texas, saving a step. And we'll pick an optional T-shirt size, Large, for a personal touch at check-in.",
    events: [
      {
        pct: 0.0,
        step: 7,
        text: "Let's jump into the first step. Before entering our details... notice how the form dynamically adapts to your service preference.",
      },
      {
        pct: 0.12,
        step: 8,
        text: 'If you select the Amharic service... the age ranges are simplified into broad categories like Infant, Child, Youth, and Adult.',
      },
      {
        pct: 0.25,
        step: 9,
        text: 'However... if you switch to the English service, the system reveals more granular service groups to ensure attendees are placed in the right sessions.',
      },
      {
        pct: 0.37,
        step: 10,
        text: "Under Child... you'll see Preschool and Children options with their age ranges.",
      },
      {
        pct: 0.44,
        step: 11,
        text: 'Youth... opens a Grade slash Level dropdown from seventh through twelfth grade.',
      },
      { pct: 0.5, step: 12, text: 'And Adult... adds College slash Career to that dropdown.' },
      {
        pct: 0.56,
        step: 13,
        text: "Now that we see how it works... let's register our primary attendee. We'll type Test, for the first name... and User, for the last name.",
      },
      { pct: 0.68, step: 14, text: "We'll select the Amharic service... and the Adult age range." },
      {
        pct: 0.74,
        step: 15,
        text: 'Next, we select our Gender... which is vital for proper dormitory and lodging assignments.',
      },
      { pct: 0.82, step: 16, text: "We'll choose Male." },
      {
        pct: 0.86,
        step: 17,
        text: "For our Church... we'll pick Ethiopian Evangelical Christian Church in Austin from the list.",
      },
      { pct: 0.92, step: 18, text: 'Notice... the City field auto-fills to Austin, Texas.' },
      {
        pct: 0.96,
        step: 19,
        text: "And we'll pick an optional T-shirt size, Large, for a personal touch at check-in.",
      },
    ],
  },
  {
    id: 'attendance',
    title: 'Full & Partial',
    audioFile: '/voiceover-attendance.wav',
    fallbackMs: 40_000,
    script:
      "Say warmly and professionally: Now for the most important part... the Attendance Type. First, Full Conference gives you the complete four-day experience — lodging, every meal, and all sessions. Watch the Price Summary instantly calculate your total. But life happens... and sometimes you need flexibility. Let's pick Partial Attendance instead. Say you're joining us Friday through Sunday... we'll tap those three days. Notice... every meal for those days is intelligently pre-selected for you. Running late on Friday? Simply uncheck Friday Breakfast... and Friday Lunch. Only pay for what you truly need — the price updates in real time.",
    events: [
      { pct: 0.0, step: 20, text: 'Now for the most important part... the Attendance Type.' },
      {
        pct: 0.08,
        step: 21,
        text: 'First, Full Conference gives you the complete four-day experience — lodging, every meal, and all sessions.',
      },
      { pct: 0.22, step: 22, text: 'Watch the Price Summary instantly calculate your total.' },
      {
        pct: 0.32,
        step: 23,
        text: "But life happens... and sometimes you need flexibility. Let's pick Partial Attendance instead.",
      },
      {
        pct: 0.45,
        step: 24,
        text: "Say you're joining us Friday through Sunday... we'll tap those three days.",
      },
      { pct: 0.62, step: 25, text: 'Notice... every meal for those days is intelligently pre-selected.' },
      { pct: 0.75, step: 26, text: 'Running late on Friday? Simply uncheck Friday Breakfast...' },
      {
        pct: 0.85,
        step: 27,
        text: 'and Friday Lunch. Only pay for what you truly need — the price updates in real time.',
      },
    ],
  },
  {
    id: 'kote',
    title: 'Kote',
    audioFile: '/voiceover-kote.wav',
    fallbackMs: 32_000,
    script:
      "Say warmly and professionally: Finally... for our daily commuters, we have Kote. A simple ten-dollars-per-day rate, with no lodging fees attached. We'll tap Saturday... and Sunday. Unlike Partial, meals aren't pre-selected — giving you full control. We'll add Breakfast, Lunch, and Dinner for Saturday... and Breakfast and Lunch for Sunday. And just like that... the Price Summary gives us our exact, custom total. Conference registration, reimagined.",
    events: [
      {
        pct: 0.0,
        step: 28,
        text: 'Finally... for our daily commuters, we have Kote. A simple ten-dollars-per-day rate, with no lodging fees.',
      },
      { pct: 0.28, step: 29, text: "We'll tap Saturday... and Sunday." },
      { pct: 0.42, step: 30, text: "Unlike Partial, meals aren't pre-selected — giving you full control." },
      { pct: 0.58, step: 31, text: "We'll add Breakfast, Lunch, and Dinner for Saturday..." },
      {
        pct: 0.75,
        step: 32,
        text: 'and Breakfast and Lunch for Sunday. The Price Summary gives us our exact, custom total.',
      },
      { pct: 0.95, step: 33, text: 'Conference registration, reimagined.' },
    ],
  },
  {
    id: 'child',
    title: 'Child Registration',
    audioFile: '/voiceover-child.wav',
    fallbackMs: 38_000,
    script:
      "Say warmly and professionally: FellowFlow makes it easy to add your whole family under one account. Let's click Add Another Person, to register a child. We'll enter the first name, Child... and the last name, Child. We'll select the English service... choose the Child age range... and pick the Children service group. We'll select their gender, and a T-shirt size. Now... for children, parents have a special choice. Scroll down, and toggle, Child will share bed with parent. Watch the price summary on the right... the lodging fee is completely removed instantly.",
    events: [
      {
        pct: 0.0,
        step: 34,
        text: "FellowFlow makes it easy to add your whole family under one account. Let's click Add Another Person.",
      },
      {
        pct: 0.2,
        step: 35,
        text: "We'll enter the first name, Child... and the last name, Child. We'll select the English service.",
      },
      {
        pct: 0.42,
        step: 36,
        text: '...choose the Child age range... and pick the Children service group.',
      },
      {
        pct: 0.58,
        step: 37,
        text: "We'll select their gender, and a T-shirt size.",
      },
      {
        pct: 0.72,
        step: 38,
        text: "Now... for children, parents have a special choice. Scroll down, and toggle, Child will share bed with parent.",
      },
      {
        pct: 0.88,
        step: 39,
        text: 'Watch the price summary on the right... the lodging fee is completely removed instantly.',
      },
    ],
  },
  {
    id: 'infant',
    title: 'Infant & Insurance',
    audioFile: '/voiceover-infant.wav',
    fallbackMs: 36_000,
    script:
      "Say warmly and professionally: Next... let's add a third family member. We click Add Another Person... enter the first name, Infant... and last name, Infant... and select the Infant age range. For infants, the dormitory and meals are completely complimentary. A small ten-dollar per-day campus insurance fee applies... bringing the infant's total to just forty dollars for the four-day conference. And with that, our entire family of three is registered and ready.",
    events: [
      {
        pct: 0.0,
        step: 40,
        text: "Next... let's add a third family member. We click Add Another Person.",
      },
      {
        pct: 0.18,
        step: 41,
        text: "We enter the first name, Infant... and last name, Infant... and select the Infant age range.",
      },
      {
        pct: 0.45,
        step: 42,
        text: 'For infants, the dormitory and meals are completely complimentary.',
      },
      {
        pct: 0.65,
        step: 43,
        text: "A small ten-dollar per-day campus insurance fee applies...",
      },
      {
        pct: 0.85,
        step: 44,
        text: "...bringing the infant's total to just forty dollars for the four-day conference.",
      },
    ],
  },
  {
    id: 'checkout',
    title: 'Contact & Checkout',
    audioFile: '/voiceover-checkout.wav',
    fallbackMs: 36_000,
    script:
      "Say warmly and professionally: Once our group is fully set... we click Next to fill out the contact info. Providing your email and phone number here is crucial... because this single email address is where your combined receipt, and all registration badges for your entire group, will be sent. After verifying all details on the Review page... we click Proceed to Payment. Here on our secure Stripe checkout... depending on your current device... you can choose to pay via credit card, bank transfer, Apple Pay, or use Link for a one-click checkout. We click Pay... and our registration is secured instantly.",
    events: [
      {
        pct: 0.0,
        step: 45,
        text: "Once our group is fully set... we click Next to fill out the contact info.",
      },
      {
        pct: 0.18,
        step: 46,
        text: "Providing your email and phone number here is crucial... this single email receives the combined receipt and all registration badges for your entire group.",
      },
      {
        pct: 0.48,
        step: 47,
        text: "After verifying all details on the Review page... we click Proceed to Payment.",
      },
      {
        pct: 0.66,
        step: 48,
        text: "Here on our secure Stripe checkout... you can pay with credit card, bank transfer, Apple Pay, or one-click Link checkout.",
      },
      {
        pct: 0.9,
        step: 49,
        text: "We click Pay... and our registration is secured instantly.",
      },
    ],
  },
  {
    id: 'badges',
    title: 'Digital Badges & Mobile Wallet',
    audioFile: '/voiceover-badges.wav',
    fallbackMs: 58_000,
    script:
      "Say warmly and professionally: Success! Your confirmation page provides a full breakdown of the registration. From here... you can click the Apple Wallet button to add the wallet pass directly to your Apple devices. If you are eligible to buy meals... your digital badge will have a unique URL link in the details section on the back. Simply click that URL anytime to add preferred meal options for specific dates, and pay as usual. Your badge will automatically update to grant access to that paid meal service. You will also receive a registration confirmation email... containing your confirmation ID, payment details, and a PDF Registration Badge for each registrant in a single email. Print this badge out, or keep it on your phone... and have it ready at the campus upon check-in to easily access all your services.",
    events: [
      {
        pct: 0.0,
        step: 50,
        text: "Success! Your confirmation page provides a full breakdown of the registration.",
      },
      {
        pct: 0.12,
        step: 51,
        text: "From here... you can click the Apple Wallet button to add the wallet pass directly to your Apple devices.",
      },
      {
        pct: 0.3,
        step: 52,
        text: "If you are eligible to buy meals... your digital badge will have a unique URL link in the details section on the back.",
      },
      {
        pct: 0.48,
        step: 53,
        text: "Simply click that URL anytime to add preferred meal options for specific dates... and pay as usual. Your badge will automatically update to grant access to that paid meal service.",
      },
      {
        pct: 0.72,
        step: 54,
        text: "You will also receive a registration confirmation email... containing your confirmation ID, payment details, and a PDF Registration Badge for each registrant.",
      },
      {
        pct: 0.88,
        step: 55,
        text: "Print this badge out, or keep it on your phone... and have it ready at the campus upon check-in.",
      },
    ],
  },
  {
    id: 'meals',
    title: 'Add Meals Anytime',
    audioFile: '/voiceover-meals.wav',
    fallbackMs: 42_000,
    script:
      "Say warmly and professionally: Remember the Buy Meals QR on your printed badge... or the link on the back of your Apple Wallet pass. Scanning either one brings you straight to your personal Meal Tickets page. You can also reach it anytime from the Purchase Meal Tickets button on your receipt. On this page, you'll see exactly which meals you've already purchased... which are still available... and your per-meal price. Simply pick the meals you want — breakfast, lunch, or dinner — on any eligible date... and your total updates instantly. Click Pay... and complete checkout with Stripe. Your badge is automatically updated. Your new meals are now live — just show your QR at the meal station to claim them. Adding meals has never been easier.",
    events: [
      {
        pct: 0.0,
        step: 56,
        text: "The Buy Meals QR on your printed badge — or the link on the back of your Apple Wallet pass — brings you straight to your personal Meal Tickets page. You can also reach it from the Purchase Meal Tickets button on your receipt.",
      },
      {
        pct: 0.35,
        step: 57,
        text: "Here you'll see exactly which meals you've already purchased, which are still available, and your per-meal price.",
      },
      {
        pct: 0.55,
        step: 58,
        text: "Simply pick the meals you want — breakfast, lunch, or dinner — on any eligible date, and your total updates instantly.",
      },
      {
        pct: 0.72,
        step: 59,
        text: "Click Pay... and complete checkout with Stripe.",
      },
      {
        pct: 0.84,
        step: 60,
        text: "Your badge is automatically updated. Your new meals are now live — just show your QR at the meal station to claim them.",
      },
    ],
  },
]

// Last step (used for the "finished / replay" state)
export const FINAL_STEP = 60

// Flat timeline for progress-bar rendering in the footer (one slot per non-idle step)
export const ALL_STEPS = PHASES.flatMap((p) => p.events.map((e) => e.step))
