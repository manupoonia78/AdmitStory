// The free preview's worked example, one per school (Manu, 4 Nov 2026): an illustrative applicant,
// the story they came in with, the one we built for this school, what we changed, and the opening
// of one essay. Each is a composite written to show the method against the school's own prompts
// and the pack's angles; none is a real client, and the page says so. Keyed by school slug.
// The prose follows knowledge/canon/anti-ai-tells.md, as a draft from the kit would.

export interface ShowcaseStory {
  /** Who the example applicant is, in one line. */
  who: string;
  /** The narrative they arrived with. */
  before: string;
  /** The narrative we built for this school. */
  after: string;
  /** What we changed, in the order it mattered. */
  moves: readonly string[];
  /** The opening of one essay from the example file. */
  excerpt: { essay: string; text: string };
}

export const SHOWCASE_STORIES: Readonly<Record<string, ShowcaseStory>> = {
  "hec-paris": {
    who: "A process engineer, 29, six years at a tyre maker in Chennai, aiming at operations strategy in Europe.",
    before: "An engineer who wants an MBA to move into management, maybe consulting.",
    after:
      "Someone who has spent six years making one factory understand another across borders, and comes to HEC to do it for a European supply network.",
    moves: [
      "Found the international thread the résumé buried: the line transfer to a plant in Hungary, run from Chennai.",
      "Gave each of the five essays a different side of the applicant, so the transfer leads Essay 1 and never repeats.",
      "Moved the life achievement outside work: the Saturday maths class started for the building's children.",
    ],
    excerpt: {
      essay: "Essay 1 · Why HEC, why now",
      text: "The first crates of tyre moulds left Chennai for Nyíregyháza in March 2023 with my handwriting on every label. For eight months I had turned a factory into instructions another factory could follow, in a language neither side spoke well. Most of what went wrong had nothing to do with machines. I want to work on that problem at the scale of a European supply network, starting in operations strategy at a manufacturer moving production closer to its customers.",
    },
  },
  "harvard-business-school": {
    who: "A product manager, 28, at a lending start-up in Bengaluru, who turned down a bank's offer.",
    before: "A high-achieving PM with a strong record who wants to lead a fintech company one day.",
    after:
      "Someone who keeps choosing the smaller, harder room, and can say exactly why each time.",
    moves: [
      "Rebuilt the Business-Minded essay around one choice made against advice, and the reasoning behind it.",
      "Cut the goals to a single sentence: 300 words leaves no room for a plan, only for a person.",
      "Turned the leadership essay toward one analyst the applicant trained into a team lead.",
    ],
    excerpt: {
      essay: "Business-Minded Essay",
      text: "My father kept the bank's offer letter in his desk drawer for a year after I turned it down. I had chosen a lending start-up with forty people and no profit, because at the bank I would approve loans and at the start-up I would decide who could get one. That difference mattered to me before I could explain it. I can explain it now: I want to build credit for people a branch manager never meets.",
    },
  },
  "stanford-gsb": {
    who: "A civil servant, 30, who ran a provincial vaccination data programme in Indonesia.",
    before: "What matters most to me is making a positive difference through public service.",
    after:
      "What matters most is that the person at the end of a system gets counted, shown through three decisions where counting them cost something.",
    moves: [
      "Replaced the value statement with three hard decisions, each with a cost the applicant paid.",
      "Traced the value to where it started: a grandmother missing from a village register.",
      "Kept Essay B to one aspiration and the two parts of Stanford that serve it.",
    ],
    excerpt: {
      essay: "Essay A · What matters most to you, and why?",
      text: "My grandmother was not on the village register in 1998, so for three years she did not exist to the clinic that could have treated her eyes. I learned this at her funeral. Twenty years later I ran the database that decided which villages in East Java received vaccines first, and I found eleven thousand people missing from it the same way. Fixing that delayed our rollout by nine days, and my director took a long time to forgive me.",
    },
  },
  wharton: {
    who: "A credit analyst, 27, in São Paulo, who started a study group for women in finance.",
    before: "A finance professional who wants Wharton's network to move into private equity.",
    after:
      "A teacher at heart who has already built two rooms where people learn finance from each other, and will build the third at Wharton.",
    moves: [
      "Built Essay 2 on one value shown in two past contributions: the study group and a model teardown series.",
      "Tied each contribution to one thing classmates would get from it, in a named part of the community.",
      "Wrote the long-term goal around what the applicant still has to learn, not what they already know.",
    ],
    excerpt: {
      essay: "Essay 2 · How you'll add value",
      text: "On Thursday nights in 2023, eleven women from four banks sat around my kitchen table and took an LBO model apart line by line. None of us had been taught it at work; we were expected to know it already. By December, three of them had moved onto deal teams. I want to set that table again in Philadelphia, for the first-years who arrive knowing accounting but not yet how a deal is built.",
    },
  },
  "mit-sloan": {
    who: "A mechanical engineer, 29, at a battery maker in Shenzhen.",
    before: "A technical engineer applying to learn the business side and move into management.",
    after:
      "A doer who got a sceptical plant director to test an unproven fix, with the persuasion shown step by step.",
    moves: [
      "Built the cover letter on one unconventional idea pushed past a senior sceptic.",
      "Showed the persuasion itself: a one-week trial on a single line instead of a slide deck.",
      "Anchored the video in a scene from home: rebuilding scooter batteries in a parent's repair shop.",
    ],
    excerpt: {
      essay: "Cover letter",
      text: "In the summer of 2024 our cell line in Shenzhen was scrapping one battery module in twelve, and the plant director had already decided the supplier was to blame. I thought it was our own drying ovens. I had no authority to change them and a hunch nobody shared, so I stopped arguing and asked for one line for one week. On the fifth day the scrap rate fell to one in forty.",
    },
  },
  "northwestern-kellogg": {
    who: "A brand manager, 30, at a consumer-goods company in Lagos.",
    before: "Applying to Kellogg for its marketing reputation and collaborative culture.",
    after:
      "Someone who questioned a launch the whole team loved and brought them along, which is exactly why the MBA is now.",
    moves: [
      "Built Part I on one pivotal decision: stopping a launch two weeks out and taking it back to research.",
      "Linked that decision to why now: the gap it exposed in leading people senior to the applicant.",
      "Gave Part II one concrete thing to start at Kellogg, drawn from the market visits already run at work.",
    ],
    excerpt: {
      essay: "Part I · Why an MBA, why now",
      text: "Two weeks before the launch, with the trucks already booked, I asked my team to stop. Our new detergent sachet had tested well with office workers in Lagos and badly in the three markets where our customers actually bought it. I had the data and no authority; my manager had the authority and liked the launch. What I did next taught me more about leading than the six years before it.",
    },
  },
  "dartmouth-tuck": {
    who: "A consultant, 28, in Toronto, aiming at operations in a health system.",
    before:
      "Moving from consulting into healthcare leadership; Tuck's small community is a good fit.",
    after:
      "Someone who found on a hospital project what they couldn't yet do, and knows which part of Tuck closes the gap.",
    moves: [
      "Rebuilt Essay 1 around the discovered gap: a nurse manager who thanked the team and changed nothing.",
      "Reverse-engineered Essay 2 from something already done: running mock interviews for new analysts.",
      "Chose for Essay 3 a colleague's hard return from leave, where helping cost the applicant a promotion cycle.",
    ],
    excerpt: {
      essay: "Essay 1 · What led you to your goals",
      text: "The recommendation was right and nobody used it. We had shown a Toronto hospital how to cut emergency waits by forty minutes, and the nurse manager who had to run it thanked us and changed nothing. It took me a month to understand why: we had redesigned her shifts without asking her. That project showed me what I want to do, run operations in a health system, and what I cannot do yet.",
    },
  },
  "duke-fuqua": {
    who: "A software engineer, 27, at a logistics start-up in Ho Chi Minh City.",
    before: "A strong engineer who wants to move into product management at a large tech company.",
    after:
      "Team Fuqua already: the engineer who started the office's Friday code reviews and coached two interns through their first launch.",
    moves: [
      "Opened the 25 Random Things list on its most personal item and placed the career's origin at number nine.",
      "Built the contributions answer as proof plus mechanism: the reviews already run, and the club they'd feed.",
      "Kept each story in one place: the goals carry the logic, the list the person, the club answer the community.",
    ],
    excerpt: {
      essay: "25 Random Things",
      text: "1. I can tell you the price of rice in four Saigon markets, because my mother sold it in one of them for twenty years.\n2. I failed my driving test twice and passed on a motorbike the first time.\n3. Every Friday at four, I bring mango sticky rice to code review. Attendance has never been better.\n9. The first program I wrote counted my mother's sacks so she could stop counting them at night.",
    },
  },
  "uva-darden": {
    who: "An army logistics officer, 31, leaving service in Ohio, aiming at supply-chain consulting.",
    before: "A veteran with leadership experience who wants to move into consulting.",
    after:
      "Someone whose relationships outlast the job, told through the people of one platoon, with a goal defined by the problem it solves.",
    moves: [
      "Told the 'not on your résumé' answer through people: the platoon the applicant still writes to.",
      "Defined the target company by its problem: getting supplies where the roads stop.",
      "Named two employers, one with Darden ties, and what each job would teach.",
    ],
    excerpt: {
      essay: "What classmates should know",
      text: "Every December I post forty-one cards to the soldiers of my old transport platoon. Most of them have left the army, two have left the country, and one writes back only to correct my spelling. I started after our tour, when I realised I had spent a year responsible for these people and knew almost nothing about their lives. If you are my classmate, expect a card.",
    },
  },
  "cornell-johnson": {
    who: "A data analyst, 28, at a Chicago transit agency, moving into product in tech.",
    before: "Transitioning into product management in tech; Johnson can help me get there.",
    after:
      "A life story whose chapters keep returning to one question, why the bus is late, now aimed at a named product role.",
    moves: [
      "Built the Table of Contents with personal chapters mixed in, so the career turns read as a person.",
      "Wrote the goals essay from informational interviews, with one immersion matched to the gap they revealed.",
      "Filled the 30-word goals statement to the letter: role, company, industry.",
    ],
    excerpt: {
      essay: "Essay 2 · Table of Contents",
      text: "Chapter 1: The 6:40 Bus (how I learned to read timetables before books)\nChapter 2: Grandma's Ledger (the only accountant on our block)\nChapter 3: Why Is the Bus Late? (a question that became a job)\nChapter 4: Forty Thousand Riders (the app nobody asked for, and everybody used)\nChapter 5: Ithaca, Without a Car",
    },
  },
  "ucla-anderson": {
    who: "A secondary-school teacher, 29, in Los Angeles, switching into ed-tech product strategy.",
    before: "A teacher who wants to switch into business through an MBA.",
    after:
      "A switcher with a clear bridge: five years designing what thirty people do each hour, and the homework already done on the new field.",
    moves: [
      "Built the bridge from teaching to product: the skill that carries over and the conversations already had.",
      "Turned the 'share success' answer toward the mentoring circle the applicant runs for first-year teachers.",
      "Wrote three registers: goals in plain logic, the classmates essay warm, the 50 words light.",
    ],
    excerpt: {
      essay: "Goals essay",
      text: "For five years I have designed fifty-minute products for thirty demanding users, and watched most of the ed-tech tools sold to my school fail them within a month. After graduating I want to work in product strategy at a company building learning software for public schools, and within ten years lead one. I have spoken to eleven product managers in the field; each told me the same thing about what I lack, and Anderson is where I learn it.",
    },
  },
  "cmu-tepper": {
    who: "A chemical engineer, 30, at a refinery in Gujarat, aiming at energy analytics.",
    before: "An engineer who wants to add business skills to a technical background.",
    after:
      "A decision-maker under real uncertainty who also had to win over sceptical operators, with the reasoning behind each call laid out.",
    moves: [
      "Chose for Essay 1 a shutdown call made on incomplete data, and set out the reasoning at each step.",
      "Added the people side a technical file lacks: translating the decision for the shift operators.",
      "Kept the 50-word fun fact truly light, so the file ends on a person.",
    ],
    excerpt: {
      essay: "Essay 1 · A decision under uncertainty",
      text: "At 2 a.m. the pressure reading on Unit 4 said everything was fine, and the operator who had run it for nineteen years said it wasn't. I had six minutes, one sensor I trusted less than him, and the cost of a shutdown, about ₹3 crore a day, in my head. I chose the shutdown. What I want to describe is how I made that choice, and how I explained it to the twelve people who thought I was wrong.",
    },
  },
  "ut-austin-mccombs": {
    who: "A sales manager, 29, at a solar installer in Phoenix.",
    before: "An MBA from McCombs to grow into leadership in energy.",
    after:
      "Opens on the eve of the first post-MBA job, looking back on one concentration, one programme and one contribution that made it.",
    moves: [
      "Wrote Essay 1 as a scene from the future, the Sunday before starting work, looking back.",
      "Built Essay 2 on a value tested at a cost: refusing to oversell a customer during a record quarter.",
      "Placed a resilience story in the video, since resilience is one of McCombs' named traits.",
    ],
    excerpt: {
      essay: "Essay 1 · Why McCombs was the right decision",
      text: "It is the Sunday before I start in business development at a utility-scale solar developer, and I am packing the notebook I kept from my first energy finance class in Austin. Two years ago I could sell a rooftop system to a family in an afternoon and could not read the term sheet for a field of them. The notebook is mostly questions. By May, most of them had answers.",
    },
  },
  "usc-marshall": {
    who: "A hotel operations manager, 28, in Dubai, aiming at live-entertainment operations in Los Angeles.",
    before: "A hospitality professional who wants an MBA to move into the entertainment industry.",
    after:
      "Someone who already runs nights for two thousand guests, with each Marshall resource tied to a specific task in the next job.",
    moves: [
      "Tied each Marshall resource in the goals essay to one future task, not a list of names.",
      "Added a collaboration story in the optional space, since nothing else in the file shows teamwork.",
      "Named one club contribution from the past: the staff talent night the applicant built.",
    ],
    excerpt: {
      essay: "Goals essay",
      text: "On New Year's Eve 2024, I ran the ballroom for 2,100 guests, forty performers and one fire marshal who arrived at 11:40. Nothing in my hotel career has been better training for live events, and nothing in it has taught me how the events are financed. After my MBA I want to run operations for a live-entertainment company in Los Angeles, and in ten years run the venues themselves.",
    },
  },
  "uw-foster": {
    who: "A supply-chain planner, 29, at an aerospace supplier near Seattle.",
    before: "Looking to grow into leadership in supply chain with a Foster MBA.",
    after:
      "A planner who changed how a team works by reading what a colleague needed, with Seattle-anchored targets and a named second path.",
    moves: [
      "Told the leadership story with an innovation inside it, under 'we foster progress'.",
      "Anchored the plan in Seattle's aerospace and cloud employers, with a second path named.",
      "Gave each essay its own story: the plan the origin, the mission a leadership moment, inclusion a relationship.",
    ],
    excerpt: {
      essay: "Essay 1 · What lies ahead",
      text: "In 2022 a single missing bracket, worth eleven dollars, held a wing assembly for nine days. I was the planner who had marked it as safe stock. Since then I have rebuilt how our team forecasts parts with long lead times, and I have learned that the hardest part of supply chain is the conversation with the person who has to trust your number. That is the gap I want Foster to close.",
    },
  },
  "vanderbilt-owen": {
    who: "An emergency nurse, 30, in Atlanta, aiming at hospital operations.",
    before: "A nurse who wants to move into healthcare management.",
    after:
      "Two paths to one destination, each tied to a skill a hospital COO needs, with Owen's healthcare concentration showing how both get tried.",
    moves: [
      "Framed two career paths that both lead to running a hospital, each tied to a capability it needs.",
      "Anchored the goal in Nashville's health-care cluster and Owen's healthcare immersion.",
      "Picked for the challenge essay one night shift, the applicant's own response, and what changed after.",
    ],
    excerpt: {
      essay: "Career journey and two paths",
      text: "At 3 a.m. on a Saturday in 2023, our emergency department had twenty-six patients and four beds, and the problem was not medicine. Discharges upstairs were waiting on paperwork that nobody owned. I spent that shift walking forms between floors, and the next year building the handoff process the hospital still uses. I want to run a hospital, and I see two ways to get there.",
    },
  },
};
