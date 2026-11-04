import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("dartmouth-tuck", "Tuck School of Business at Dartmouth", "Tuck", "US", "Hanover, NH",
         "https://tuck.dartmouth.edu")

# Sources ---------------------------------------------------------------------------------------
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
P.source("tuck-apply", "official", "Applying to Tuck (essays, goals, references, tests, fees, deadlines)", "https://tuck.dartmouth.edu/admissions/applying-to-tuck")
P.source("tuck-launch-2026", "official", "Tuck Looks Ahead to the Class of 2029, Launches 2026–2027 MBA Application (Jul 1, 2026)", "https://tuck.dartmouth.edu/news/articles/tuck-looks-ahead-to-the-class-of-2029-launches-2026-2027-mba-application")
P.source("tuck-interview", "official", "Tuck admissions: Interview", "https://tuck.dartmouth.edu/admissions/interview")
P.source("tuck-criteria", "official", "Tuck admissions: Evaluation criteria", "https://tuck.dartmouth.edu/admissions/evaluation-criteria")
P.source("tuck-faq", "official", "Tuck admissions FAQs", "https://tuck.dartmouth.edu/admissions/admissions-faqs")
P.source("tuck-profile", "official", "Tuck Class of 2028 profile (results as of Aug 10, 2026)", "https://tuck.dartmouth.edu/admissions/class-profile")
P.source("tuck-employment-2025", "official", "2025 Employment Outcomes Reflect Strength, Talent, and Versatility of Tuck MBAs (Dec 9, 2025)", "https://tuck.dartmouth.edu/news/articles/2025-employment-outcomes-reflect-strength-talent-and-versatility-of-tuck-mbas")
P.source("tuck-academics", "official", "Tuck academic experience pages (core, electives, FYP, TuckGO, GIX, Term Exchange, STEM option, academic FAQs)", "https://www.tuck.dartmouth.edu/mba/academic-experience/required-curriculum")
P.source("tuck-centers", "official", "Tuck research centers", "https://tuck.dartmouth.edu/faculty/research-centers")
P.source("tuck-mission", "official", "Tuck mission, values and vision; facts and figures", "https://tuck.dartmouth.edu/about/mission-values-vision")
P.source("tuck-blog-essays", "adcom", "Tuck Admissions Insights: 2026-2027 Application Essays — Patricia Harrison, Director of Admissions, Evaluation and Yield (Jul 1, 2026)", "https://tuck.dartmouth.edu/mba/blog/tuck-admissions-insights-application-essays")
P.source("tuck-blog-goals", "adcom", "Tuck Admissions Insights: Your Short-Term and Long-Term Goals — Patricia Harrison (Jun 30, 2026)", "https://tuck.dartmouth.edu/mba/blog/tuck-admissions-insights-your-short-term-and-long-term-goals")
P.source("tuck-blog-optional", "adcom", "Tuck Admissions Insights: Optional Information Section — Patricia Harrison (Jun 30, 2026)", "https://tuck.dartmouth.edu/mba/blog/tuck-admissions-insights-optional-information-section")
P.source("tuck-blog-reapply", "adcom", "Reapplying to Tuck — Amy Mitson, Director of Admissions, Recruitment and Marketing (Jun 30, 2026)", "https://tuck.dartmouth.edu/mba/blog/reapplying-to-tuck")
P.source("pq-tuck-2026", "press", "Poets&Quants: Dartmouth Tuck's MBA apps plunge 31.5%, acceptance rate soars to 42.5% (Oct 28, 2026), with Lawrence Mur'ray quotes", "https://poetsandquants.com/2026/10/28/dartmouth-tucks-mba-apps-plunge-31-5-acceptance-rate-soars-to-42-5/")
P.source("pq-pena-2018", "adcom", "Poets&Quants: A candid interview with Tuck's head of MBA admissions, Luke Anthony Peña (Aug 5, 2018)", "https://poetsandquants.com/2018/08/05/a-candid-interview-with-tucks-head-of-mba-admissions/", read=False)
P.source("al-tuck", "third_party_reference", "ApplicantLab — Tuck school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules (knowledge/canon, mba-essays skill)", None)

P.url("prompts", "https://tuck.dartmouth.edu/admissions/applying-to-tuck")
P.url("deadlines", "https://tuck.dartmouth.edu/admissions/applying-to-tuck")
P.url("class_profile", "https://tuck.dartmouth.edu/admissions/class-profile")
P.url("employment_report", "https://tuck.dartmouth.edu/mba/career-services/employment-statistics")
P.url("ai_policy", "https://tuck.dartmouth.edu/admissions/applying-to-tuck")
P.url("other", "https://tuck.dartmouth.edu/admissions/interview")

# Rounds -----------------------------------------------------------------------------------------
P.round("Round 1", "2026-09-24", "tuck-apply", decision="2026-12-10", invites="Late August 2026 to early December 2026", notes=[
    ("A complete application (test scores and both references included) submitted by 5:00pm ET on 1 September 2026 is guaranteed an interview.", "tuck-apply"),
    ("Enrollment deposit due 1 February 2027.", "tuck-apply")])
P.round("Round 2", "2027-01-05", "tuck-apply", decision="2027-03-18", invites="Early December 2026 to mid-March 2027", notes=[
    ("A complete application submitted by 5:00pm ET on 1 December 2026 is guaranteed an interview.", "tuck-apply"),
    ("Enrollment deposit due 19 April 2027.", "tuck-apply")])
P.round("Round 3", "2027-03-24", "tuck-apply", decision="2027-04-29", invites="Mid-March 2027 to late April 2027", notes=[
    ("No guaranteed-interview date in Round 3; interviews are by invitation.", "tuck-apply"),
    ("Enrollment deposit due 14 May 2027.", "tuck-apply")])
P.todo.append("rounds: Consortium 1 and 2 application deadlines (the interview page gives invite windows, mid-October and early January, but no verbatim deadline)")

# Essays -----------------------------------------------------------------------------------------
LIM = ("chars_incl_spaces", 2000)
P.essay("goals_growth",
    "Your professional goals are described elsewhere in your application. What led you to those goals and to your understanding of where you need to grow? Why is Tuck the right environment to support that growth and help you achieve your ambitions?",
    LIM, "tuck-apply", ["GOALS", "WHY-SCHOOL"],
    parts=["what led you to your goals (origin, not a restatement)", "how you came to understand where you need to grow", "why Tuck is the right environment for that growth"],
    notes=[
        ("Maps to Tuck's 'aware' criterion. The goal boxes say what; this essay says why. Do not restate the goals.", "tuck-blog-essays"),
        ("Tuck replaced the old why-MBA question with 'where you need to grow': start from an honest self-assessment of gaps in experience, perspective or capability, not a catalogue of what an MBA offers.", "tuck-blog-essays"),
        ("Readers want a visible line from past experiences and present motivations to the goal; a goal with no link to the past reads as picked out of thin air. Career pivoters must fill in that bridge here.", "tuck-blog-essays"),
        ("Not every strong goal is a pivot. If staying in the field, say what about the work interests you and why you want to go further in it.", "tuck-blog-essays"),
        ("The why-Tuck part fails if the word 'Tuck' could be swapped for another school. Long lists of Tuckies spoken to are a named negative; say what you learned from those conversations instead.", "tuck-blog-essays"),
        ("Joint-degree applicants say how the second degree complements the MBA; holders of a similar graduate degree say why they still need a Tuck MBA.", "tuck-blog-essays"),
        ("Tell the journey on two lines: how the goal itself formed and evolved, and how the applicant decided an MBA was the way to pursue it (a mentor's nudge, watching someone with the degree, studying the backgrounds of people already on the path).", "al-tuck"),
        ("Make the awareness visible: show how each gap was discovered (feedback, a moment of falling short, advice from someone senior), then close that exact gap with a named Tuck resource and a concrete future use for it.", "al-tuck"),
        ("Tuck's admissions team checks goal realism with the career office. Explain why each step makes sense and, for a stretch goal, have a credible second path; a switch is most credible into a field Tuck is strong in.", "al-tuck"),
        ("Tuck has invested in global learning. If it truly serves the goal, name a TuckGO/GIX region or industry and the real reason it matters to the career, never 'I've never been there'.", "al-tuck"),
        ("Don't build the why-Tuck case on a short-lived course offering; anchor it on the core, the First-Year Project, centers, electives and coaching that will still exist.", "al-tuck"),
        ("2,000 characters is about 300–330 words. Keep context to two or three sentences, open on the moment the goal took hold, and give the gap-to-resource logic the middle; land on a forward beat, not a summary.", "admitstory-coach"),
    ])
P.essay("aspect_of_self",
    "People are often shaped by experiences that are not fully reflected in their resume. Tell us about an important aspect of who you are that has shaped you as a person. How will your perspective enrich the Tuck community?",
    LIM, "tuck-apply", ["IDENTITY", "CONTRIBUTION"],
    parts=["one important aspect of who you are, not on the resume", "how it shaped you", "how your perspective will enrich the Tuck community"],
    notes=[
        ("Also maps to 'aware', through self-understanding. Tuck asks applicants to focus on one significant aspect of identity rather than the whole life story.", "tuck-blog-essays"),
        ("Tuck's own brainstorm list: upbringing, a community that matters to you, culture, relationships, challenges overcome, personal values, a defining moment; professional experience can count but is not the point.", "tuck-blog-essays"),
        ("Enrichment means the person who shows up and what classmates will learn from them, not the activities they will join. Naming a Tuck offering is fine; a list of classes and clubs is not.", "tuck-blog-essays"),
        ("Pick one root and let several qualities grow from it, never three topics stapled together. Small supporting details are fine if they trace back to the same root: if cutting a detail would not force the paragraph to be restructured, it is texture, not a second topic.", "al-tuck"),
        ("A practical route in: list two or three things the applicant would really do at Tuck, then find the lived experience that explains why. One specific, evidence-backed contribution beats a list of clubs or a vague promise of 'warmth in discussions'.", "al-tuck"),
        ("Achievements and awards don't answer this prompt; if a sport or award matters, write about what it does inside the person or for others, and leave the accolade for the resume.", "al-tuck"),
        ("Distinctive is good; uncomfortable, braggy or integrity-raising material is not. Specific memories, not the theme, are what make a common theme belong to one applicant.", "al-tuck"),
    ])
P.essay("supporting_another",
    "Describe a time when supporting another person was not easy or straightforward. What made it difficult, how did you respond, and what did you learn?",
    LIM, "tuck-apply", ["SUPPORT"],
    parts=["the situation: supporting one person (or a very small group)", "what made it difficult or not straightforward", "how you responded", "what you learned"],
    notes=[
        ("Maps to 'encouraging'. Tuck calls this a relationship essay, not a leadership essay: one discrete story about one person or a very small group.", "tuck-blog-essays"),
        ("Avoid normal supervision duties, routine teamwork and anything anyone in the role would be expected to do; Tuck wants investment beyond what was required.", "tuck-blog-essays"),
        ("Avoid hero or save-the-day stories and large-group examples. Big outcomes are not required; empathy and genuine investment in the other person are what count.", "tuck-blog-essays"),
        ("The learning is as important as the story: did it change how the applicant handles conflict, feedback, mentorship, advocacy or empathy?", "tuck-blog-essays"),
        ("Spell out the difficulty if the context doesn't already make it plain: a cost in time, political or reputational risk, a person who didn't want help, or no playbook for how to help.", "al-tuck"),
        ("Show the insight about the other person that made the help work, not only the steps taken. Explain any resistance through their position or background, never as a character flaw.", "al-tuck"),
        ("When two stories are equally strong, prefer the professional one, since helping each other professionally is what Tuck alumni do; a personal story can carry a brief later work example as proof the lesson stuck.", "al-tuck"),
        ("Close with a specific lesson and one later moment where it changed behaviour, not a platitude about patience or teamwork.", "admitstory-coach"),
    ])
P.optional("optional",
    "Please provide any additional insight or information that you have not addressed elsewhere (e.g., atypical choice of references, factors affecting academic performance, unexplained job gaps or changes). Complete this question only if you feel your candidacy is not fully represented by this application.",
    LIM, "tuck-apply", ["OPTIONAL"], required=False,
    parts=["context the rest of the application doesn't give"],
    notes=[
        ("Most applicants don't need this section and leaving it blank carries no penalty. Bullet points are acceptable; stay objective and avoid excuses.", "tuck-blog-optional"),
        ("Good uses: reference situations the dropdown doesn't cover, weak academics paired with better evidence, test plans, career progression the resume doesn't make obvious.", "tuck-blog-optional"),
        ("Bad uses: extra accomplishments or leadership stories, more why-Tuck, or an essay recycled from another school, which Tuck says reflects poorly on awareness.", "tuck-blog-optional"),
    ])
P.goal("short_term",
    "share your short-term and long-term post-MBA professional goals in 300 characters or less.",
    ("chars_incl_spaces", 300), "tuck-apply", ["GOALBOX"],
    parts=["the role immediately after graduating", "the impact you hope to make in it"],
    notes=[
        ("Short-term means immediately after graduating, not goals while at Tuck. Be factual and direct; strong answers name both the role and the intended impact.", "tuck-blog-goals"),
        ("Short-term goals should tilt toward realism. Tuck says it makes no value judgment about industry or function.", "tuck-blog-goals"),
        ("Draft the full career statement first, then decide what each box carries. Naming two viable short-term paths reads as adaptable, and the box should say why this step leads to the long-term goal.", "al-tuck"),
        ("Career switchers can use the box for proof the switch is realistic (transferable skills, a conversation with someone in the role). Everyone else can keep it lean and let Essay 1 carry the story.", "al-tuck"),
    ])
P.goal("long_term",
    "share your short-term and long-term post-MBA professional goals in 300 characters or less.",
    ("chars_incl_spaces", 300), "tuck-apply", ["GOALBOX"],
    parts=["the role or impact you want years later"],
    notes=[
        ("Tuck frames it as: what is your dream job, what legacy do you hope to leave? Long-term goals should tilt toward ambition: audacious in scope, grounded in reality.", "tuck-blog-goals"),
        ("Don't write what you think Tuck wants to hear; they want a logical line from today to right after Tuck to long-term impact.", "tuck-blog-goals"),
        ("Lead with the mission or problem, not a title. A short reference to the reason behind it can sit here if Essay 1 needs the space.", "al-tuck"),
    ])
P.todo.append("application.goal_fields: confirm in the portal whether short-term and long-term are two 300-character boxes (prior cycles and coaching sources say yes) or one shared 300-character field")

P.reapplicant(essay=dict(key="reapplicant",
    verbatim="How have you strengthened your candidacy since you last applied? Reflect on how you have grown personally and professionally and how your understanding of Tuck has developed.",
    limit=LIM, src="tuck-apply", archetypes=["REAPPLICANT"],
    parts=["how you strengthened your candidacy", "personal and professional growth", "how your understanding of Tuck has developed"],
    notes=[
        ("Tuck views reapplicants positively, but expects every essay rewritten, not resubmitted.", "tuck-blog-reapply"),
        ("Name what changed and what it taught you: new scope, a new team or market, coursework, sharper goals. A list of more work is not enough.", "al-tuck"),
        ("Say how the new experience makes you a better classmate, and show deeper engagement with Tuck: what you learned from conversations, not a list of names.", "al-tuck"),
    ]),
    policy=[
        ("Reapplicants from the most recent cycle submit one new letter of reference, from someone who has not recommended them to Tuck before.", "tuck-apply"),
        ("A test waiver can't be reused: reapplicants who had a waiver last year must apply with a score.", "tuck-blog-reapply"),
        ("Below-average scores should be retaken; supplemental quant classes are not a substitute for a better score.", "tuck-blog-reapply"),
        ("Reapplicants who miss the guaranteed-interview deadlines may have their previous interview referred to.", "tuck-faq", 0.6),
    ])

# Form, references, resume, tests, fees ---------------------------------------------------------
P.form("reference_choice", "Letters of reference — explanation if not from a current direct supervisor", "tuck-apply", guidance=[
    ("If one reference is not the current direct supervisor, the application asks for a short explanation; give the reason and why this person can speak to the applicant's work.", "tuck-apply"),
    ("If the reason doesn't fit the dropdown, use the optional section.", "tuck-blog-optional")])
P.recs("tuck-apply", 2, "gmac_common", questions=[
    ("Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's role in your organization.", "words", 50),
    ("How does the applicant's performance compare to that of other well-qualified individuals in similar roles? Provide specific examples.", "words", 500),
    ("Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.", "words", 500),
    "Optional: Is there anything else we should know?",
], notes=[
    ("Tuck uses the GMAC Common Letter of Recommendation questions. One letter should come from the current direct supervisor if possible.", "tuck-apply"),
    ("The reference must be the sole author. Drafting, writing, translating or submitting your own letter, even if the reference asks, violates Tuck's admissions policies and Honor Principle.", "tuck-apply"),
    ("Letters from professors who didn't supervise professional work, friends, family or athletic coaches don't help and are discouraged.", "tuck-apply"),
    ("Letters are meant to evidence all four criteria. Brief recommenders with factual examples of encouraging others and of acting on feedback, never with draft text.", "admitstory-coach"),
])
P.resume("tuck-apply", 1, notes=[
    ("Tuck encourages a one-page resume limited to experiences during and after undergraduate studies; it is encouraged, not stated as a hard limit.", "tuck-apply"),
    ("Tuck reads the resume as the evidence for 'accomplished', and TAA interviewers see only the resume, so every line must survive a behavioural follow-up.", "tuck-interview"),
])
P.add("application.test_policy", [
    ("GMAT (all versions) and GRE accepted with no preference; no minimum score; GMAT superscores not accepted; highest total and highest sub-scores considered.", "tuck-apply"),
    ("Test waivers on request for applicants with at least two years of post-graduate work experience who meet English-language conditions; request by 12 Aug 2026 (R1), 9 Nov 2026 (R2), 5 Mar 2027 (R3). Tuck applies a very critical screen and says no score may be a disadvantage for admission and merit scholarships.", "tuck-apply"),
    ("Executive Assessment is not listed among accepted tests on the 2026-27 pages.", "tuck-apply", 0.7),
    ("Non-native English speakers submit DET, IELTS Academic, PTE Academic or TOEFL iBT unless their bachelor's was taught solely in English.", "tuck-apply"),
])
P.add("application.fees_waivers", [
    ("Application fee: US$250, non-refundable.", "tuck-apply"),
    ("Automatic waivers include active US military and veterans, citizens of UN Least Developed Countries, first-generation college graduates, Tuck undergraduate program alumni and Discover Tuck visit attendees; documented waivers include Forté MBALaunch, MLT MBA Prep, Fulbright, Peace Corps and similar programs.", "tuck-apply"),
])

# Video: none ------------------------------------------------------------------------------------

# Values -----------------------------------------------------------------------------------------
P.add("values.stated", [
    ("Tuck evaluates every applicant on four criteria: smart, accomplished, aware and encouraging. Essays evidence aware and encouraging; the resume, accomplished; transcripts and tests, smart; references, all four.", "tuck-apply"),
    ("Smart: curious and engaged, aware you don't know it all, motivated to learn from others' knowledge and experience.", "tuck-criteria"),
    ("Accomplished: impactful and principled — results, progression and endorsements, while acting with conviction and seeking to win the right way.", "tuck-criteria"),
    ("Aware: ambitious and purposeful — knowing how your values and experiences shaped you, with coherent goals 'audacious in scope yet grounded in reality'.", "tuck-criteria"),
    ("Encouraging: collaborative and empathetic — actively celebrating and supporting others, believing your success and others' are interdependent, and acting with integrity when it isn't convenient.", "tuck-criteria"),
    ("Mission: Tuck develops wise, decisive leaders who better the world through business; it describes itself as personal, connected and transformative.", "tuck-mission"),
])
P.value("smart, curious, engaged", ["curious_learner"], ("Don't spend essay space proving intelligence; scores and transcripts do that. Curiosity can show through learning from or teaching others.", "al-tuck"))
P.value("accomplished, impactful, principled", ["measurable_impact", "principled_stands"], ("Accomplishment belongs on the resume and in the letters; in essays it reads as bragging. 'Principled' rules out win-at-all-costs stories.", "al-tuck"))
P.value("aware, ambitious, purposeful", ["self_aware", "acts_on_feedback", "honest_about_limits"], ("Awareness covers both self-knowledge and realistic goals; Tuck also wants evidence of taking direct feedback well.", "al-tuck"))
P.value("encouraging, collaborative, empathetic", ["empathetic", "develops_people", "brings_people_along", "community_builder"], ("Tuck has described this as investing in the success of others; show it through actions in stories and in what recommenders say.", "al-tuck"))
P.value("global perspective (institutional priority, not a formal criterion)", ["global_outlook"], ("Tuck has worked to strengthen its global reach, so international experience or perspective is worth surfacing where it is real.", "al-tuck", 0.6))

P.add("culture_and_location", [
    ("Tuck offers only a full-time, residential MBA in Hanover, New Hampshire, and calls itself a close-knit community built on trust, respect and learning from one another.", "tuck-academics"),
    ("Tuck claims the world's best and most responsive alumni network and says its alumni give back at the highest rate among peer schools.", "tuck-mission"),
    ("In a small, remote town almost nobody arrives with an existing circle, so the school needs people who join things, try new things and get past disagreements quickly. Show sociability through things you have actually done.", "al-tuck"),
    ("Tuck admissions staff have described joining Tuck as a lifetime commitment, so they look for people who will stay involved as alumni.", "al-tuck", 0.65),
])

# Academics --------------------------------------------------------------------------------------
P.add("academics.structure", [
    ("Year one is an integrated core (analytics, finance, economics, marketing, organisational behaviour, strategy, communication, operations), starting with the required two-week Tuck Launch; year two is electives, with more than 100 to choose from.", "tuck-academics"),
    ("Tuck has no majors; students may specialise informally (for example in finance or strategy). Graduation also requires the ethics and social responsibility requirement and the global requirement.", "tuck-academics"),
    ("Students with extensive background in a subject can exempt a core course and take an elective instead.", "tuck-academics"),
])
P.thing("academics.experiential", "First-Year Project (FYP)", "A required spring-term course in which teams of Tuck students apply the first-year core to a strategic problem for a real client, from startups and nonprofits to global companies; an entrepreneurial version (eFYP) develops a student's own idea.", "tuck-academics",
        why=["career switchers needing hands-on proof", "entrepreneurs (eFYP)", "the why-Tuck part of Essay 1"], url="https://www.tuck.dartmouth.edu/mba/academic-experience/required-curriculum/first-year-project")
P.thing("academics.experiential", "Bakala TuckGO global requirement", "Every student must take at least one TuckGO course in a country new to them during the program.", "tuck-academics",
        why=["global careers", "applicants with an international goal"], url="https://www.tuck.dartmouth.edu/mba/academic-experience/required-curriculum/global-opportunities-requirement")
P.thing("academics.experiential", "Global Insight Expeditions (GIX)", "Immersive, faculty-led courses that begin at Tuck and then travel abroad; destinations change every year (2026-27 includes Armenia, Colombia, Japan, Singapore, South Africa, Argentina and Vietnam).", "tuck-academics",
        why=["global careers", "industry or region exposure tied to the goal"], url="https://tuck.dartmouth.edu/mba/academic-experience/elective-curriculum/global-insight-expeditions")
P.thing("academics.experiential", "Term Exchange", "Second-year students can spend a term at a partner school abroad (for example LBS, HEC Paris, IESE, ISB, NUS, HKUST, Bocconi).", "tuck-academics",
        why=["applicants targeting a specific region"], url="https://tuck.dartmouth.edu/mba/academic-experience/term-exchange")
P.thing("academics.courses", "Management Science and Quantitative Methods Option (STEM)", "Pass or exempt core Analytics 1 and 2 and take at least 15 qualifying elective credits; the STEM-designated MBA may give F-1 students an extra 24 months of OPT.", "tuck-academics",
        why=["international applicants who want to work in the US after graduating", "analytics, tech and product goals"], url="https://www.tuck.dartmouth.edu/mba/academic-experience/management-science-and-quantitative-analysis")
P.thing("academics.experiential", "Leadership development plan and coaching", "First-years compare how they see themselves with how others see them; that feeds a required leadership development plan with individual coaching, and second-year Leadership Fellows coach first-years.", "tuck-academics",
        why=["Essay 1 'where you need to grow'", "applicants naming a specific leadership gap"], url="https://tuck.dartmouth.edu/mba/academic-experience/leadership-development")
for name, what, why in [
    ("Center for Health Care", "Fosters learning, leadership and career aspirations in health care.", ["health care and life sciences goals"]),
    ("Glassmeyer/McNamee Center for Digital Strategies", "Focuses on how digital strategies create competitive advantage in companies and value chains.", ["tech, product and digital strategy goals"]),
    ("Center for Entrepreneurship", "Supports entrepreneurial aspirations of all sizes and stages.", ["founders and early-stage goals"]),
    ("Center for Private Equity and Venture Capital", "Experiential and academic preparation for PE and VC investors.", ["PE and VC goals"]),
    ("Revers Center for Energy, Sustainability and Innovation", "Shapes leaders in energy and engages the energy community.", ["energy, climate and sustainability goals"]),
    ("Center for Business, Government & Society", "Prepares leaders for the complexity of the global economy at the business–government boundary.", ["policy, social impact and public-sector goals"]),
]:
    P.thing("academics.centers", name, what, "tuck-centers", why=why, url="https://tuck.dartmouth.edu/faculty/research-centers")

P.thing("community.treks_events", "Industry treks", "Tuck's industry specialists take groups of students to major cities to tour firms, meet industry leaders and Tuck alumni (examples: a Silicon Valley tech trek, an NYC ESG investing deep dive).", "tuck-academics",
        why=["career switchers", "contribution: helping organise a trek in your current industry or city"], url="https://tuck.dartmouth.edu/mba/career-services/industry-treks")
P.todo.append("community.clubs: verify specific clubs on the official clubs page before any is offered as a citable specific")

# Careers ----------------------------------------------------------------------------------------
P.employment("tuck-employment-2025", 2025,
    [("Consulting (industry)", 0.41, 190000), ("Financial services (industry)", 0.27, 175000), ("Technology (industry)", 0.13, None)],
    [], intl=("International students, three months after graduation: 92% received an offer and 88% accepted.", "tuck-employment-2025"))
P.add("careers.recruiting_notes", [
    ("Class of 2025: 90% had an offer and 87% accepted within three months; median base US$175,000, median signing bonus US$30,000; 70% found roles through school-facilitated activities.", "tuck-employment-2025"),
    ("Top locations for the Class of 2025: New York and Boston (27% each), then the San Francisco Bay Area (9%).", "tuck-employment-2025"),
    ("Pick at least one target employer that actually recruits at Tuck (from the employment report), since the career office reviews goal realism.", "al-tuck"),
])
P.todo.append("careers.employment_report: by-function shares, technology median base and top employers from the full employment statistics page")

P.class_profile("tuck-profile", 2028, size=282, gmat_focus=None, gpa=None, intl=0.39)
P.add("insider_notes", [
    ("Class of 2028 profile reports averages, not medians: GMAT Focus 682 (middle 80% 635–735), GRE 161 verbal and 161 quant, undergraduate GPA 3.5, six years of work experience (middle 80% 4–9). 59% submitted the GRE.", "tuck-profile"),
    ("Class of 2028: 46% women, 39% international including dual citizens and permanent residents (29% foreign nationals), 13% first-generation, 16% with a previous advanced degree; 18% came from nonprofit or government.", "tuck-profile"),
    ("For the Class of 2028, applications fell 31.5% to 2,237 and the acceptance rate rose to 42.5%; enrolment was 282.", "pq-tuck-2026"),
    ("Executive director Lawrence Mur'ray said what stood out was not one metric but 'the combination of accomplishment, curiosity, leadership potential, and a genuine desire to learn from one another', and that Tuck remains committed to international students while being candid about visa uncertainty.", "pq-tuck-2026"),
    ("Mur'ray on the 2026-27 essays: they let Tuck learn things that don't surface from a resume or test scores, and the refined questions are meant to let candidates 'earnestly show us who they are'.", "tuck-launch-2026"),
    ("Former executive director Luke Anthony Peña framed the 'nice' criterion (now 'encouraging') as being invested in others' success as well as your own, without being a pushover.", "pq-pena-2018", 0.6),
    ("Tuck admissions has said it looks for applicants who have gone out of their way to get to know Tuck students; ask the admissions office to connect you with a student, since they match thoughtfully.", "al-tuck", 0.65),
])

# Interview --------------------------------------------------------------------------------------
P.interview("tuck-interview", "guaranteed_if_by_date", ["student", "adcom"], True, 45, ["virtual", "campus"],
    notes=[
        ("Every admitted applicant interviews. Most interviews are run by trained second-year Tuck Admissions Associates (TAAs); they last 30–45 minutes.", "tuck-interview"),
        ("The interviewer uses only the resume and asks behavioural questions aimed at evidence of the four criteria, so prepare one story per criterion.", "tuck-interview"),
        ("Guaranteed and invited, in-person and virtual interviews are valued equally; invitation timing doesn't signal interest.", "tuck-interview"),
        ("Prepare questions for the end that show you've done the student-conversation homework.", "tuck-interview"),
    ])
P.todo.append("interview.common_questions: gather recent interview reports before adding weighted questions")

# AI policy ---------------------------------------------------------------------------------------
P.ai("tuck-apply", "limited", ["essays", "recommendations"], disclosure=None, notes=[
    ("Tuck expects essays to be 'entirely accurate and exclusively yours'; using tools or professional services to create content that is not your own violates its admissions policies and Honor Principle. The page doesn't mention AI by name.", "tuck-apply"),
    ("Recommenders must be the sole authors of their letters.", "tuck-apply"),
])

# Scholarships -------------------------------------------------------------------------------------
P.add("scholarships", [
    ("Applicants without a test score may be at a disadvantage for competitive merit scholarships.", "tuck-faq"),
])
P.todo.append("scholarships: named fellowships and how merit aid is decided (no separate essay found)")

# Avoid / angles ----------------------------------------------------------------------------------
P.add("avoid", [
    ("Restating the goal boxes in Essay 1.", "tuck-blog-essays"),
    ("Long lists of Tuck students and alumni the applicant has spoken to.", "tuck-blog-essays"),
    ("Character-limit hacks such as running words together; Tuck says it views this negatively.", "tuck-blog-essays"),
    ("A list of clubs and classes as the answer to 'how will you enrich Tuck'.", "tuck-blog-essays"),
    ("Hero stories or large-group leadership stories in Essay 3.", "tuck-blog-essays"),
    ("Recycling another school's essay in the optional section.", "tuck-blog-optional"),
    ("Using essays to prove intelligence or list achievements; they read as bragging against the 'encouraging' bar.", "al-tuck"),
    ("Claiming you'll join or lead a hobby or affinity club with no history of doing anything like it, such as promising to learn ice hockey with no evidence.", "al-tuck"),
])
P.add("angles_that_work", [
    ("Essay 1 built on a discovered gap: the moment the applicant realised what they couldn't yet do, who or what showed them, and the specific Tuck resource that closes it.", "al-tuck"),
    ("Essay 2 reverse-engineered from a concrete contribution the applicant has already made elsewhere and would make again at Tuck (for example running mock interviews for the club they'd join), traced back to one formative root.", "al-tuck"),
    ("Essay 3 about helping one colleague through something hard where the applicant took a real cost, understood the person's position, and later changed how they support people.", "al-tuck"),
    ("Across the three essays, Tuck sees one person: the goal's origin, the identity root and the support story should each show a different side and never reuse a scene.", "admitstory-coach"),
    ("Open each essay inside a scene with a real person in it; at 2,000 characters there's room for one scene, the turn, and a closing forward beat.", "admitstory-coach"),
])

# Glossary ----------------------------------------------------------------------------------------
P.term("TAA", "Tuck Admissions Associate: a trained second-year student who runs most admissions interviews.", "tuck-interview")
P.term("TuckGO", "Tuck's global requirement: at least one course in a country new to the student.", "tuck-academics")
P.term("GIX", "Global Insight Expedition: a faculty-led course that starts at Tuck and travels abroad.", "tuck-academics")
P.term("FYP", "First-Year Project: the required spring consulting-style project for a real client.", "tuck-academics")
P.term("T'25", "How Tuck writes class years: T'25 is the Class of 2025.", "tuck-employment-2025")

P.write()
