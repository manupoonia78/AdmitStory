import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("duke-fuqua", "Duke University's Fuqua School of Business", "Fuqua", "US", "Durham, NC", "https://www.fuqua.duke.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are Admitstory rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
AI_URL = "https://www.fuqua.duke.edu/programs/daytime-mba/application-instructions"
P.source("fuqua-instructions", "official", "Fuqua Daytime MBA: Application instructions (essays, interviews, recommendations, endorsements, resume, tests, fee, honor code and AI)", AI_URL)
P.source("fuqua-dates", "official", "Fuqua Daytime MBA: Admissions facts and dates", "https://www.fuqua.duke.edu/programs/daytime-mba/admissions-facts-dates")
P.source("fuqua-faq", "official", "Fuqua Daytime MBA FAQ", "https://www.fuqua.duke.edu/node/7161")
P.source("fuqua-profile", "official", "Fuqua Daytime MBA: Class profile (Class of 2028)", "https://www.fuqua.duke.edu/programs/daytime-mba/class-profile")
P.source("fuqua-employment-2025", "official", "Fuqua Daytime MBA Employment Report 2025 (PDF)", "https://www.fuqua.duke.edu/sites/default/files/media/programs/daytime/duke-mba-employment-2025.pdf")
P.source("fuqua-academics", "official", "Fuqua Daytime MBA: curriculum, program format, concentrations and certificates, experiential learning, global opportunities", "https://www.fuqua.duke.edu/programs/daytime-mba/concentrations-certificates")
P.source("fuqua-centers", "official", "Fuqua centers", "https://www.fuqua.duke.edu/faculty-research/centers")
P.source("fuqua-about", "official", "About Fuqua (Team Fuqua) and student network pages", "https://www.fuqua.duke.edu/about")
P.source("ca-hubert-2025", "adcom", "Clear Admit Admissions Director Q&A: Shari Hubert, Associate Dean of Admissions, Duke Fuqua (Jul 2, 2025)", "https://www.clearadmit.com/2025/07/admissions-director-qa-shari-hubert-of-duke-fuqua-3/")
P.source("ca-hubert-2024", "adcom", "Clear Admit Admissions Director Q&A: Shari Hubert, Duke Fuqua (Jul 15, 2024)", "https://www.clearadmit.com/2024/07/admissions-director-qa-shari-hubert-of-duke-fuqua-2/")
P.source("al-fuqua", "third_party_reference", "ApplicantLab — Duke Fuqua school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "Admitstory coaching canon and Manu's storytelling rules", None)

P.url("prompts", AI_URL); P.url("deadlines", "https://www.fuqua.duke.edu/programs/daytime-mba/admissions-facts-dates")
P.url("class_profile", "https://www.fuqua.duke.edu/programs/daytime-mba/class-profile")
P.url("employment_report", "https://www.fuqua.duke.edu/sites/default/files/media/programs/daytime/duke-mba-employment-2025.pdf")
P.url("ai_policy", AI_URL)

P.round("Early Action", "2026-09-02", "fuqua-dates", decision="2026-10-15", invites="Interview decisions by 23 September 2026", notes=[
    ("Early Action is binding: an admit commits to attend and must withdraw other applications. Deposit due 30 November 2026. Applying EA also waives the fee.", "fuqua-dates"),
    ("Fuqua encourages reapplicants to apply in Early Action or Round 1.", "fuqua-dates")])
P.round("Round 1", "2026-09-30", "fuqua-dates", decision="2026-12-10", invites="Interview decisions by 11 November 2026", notes=[("Deposit due 16 February 2027. Consortium deadlines are 15 October and 5 January.", "fuqua-dates")])
P.round("Round 2", "2027-01-05", "fuqua-dates", decision="2027-03-11", invites="Interview decisions by 11 February 2027", notes=[("Deposit due 23 April 2027.", "fuqua-dates")])
P.round("Round 3", "2027-03-25", "fuqua-dates", decision="2027-05-06", invites="Interview decisions by 14 April 2027", notes=[
    ("Round 3 interviews are virtual. Fuqua's pages disagree on whether international applicants should apply by Round 2 or Round 3 for visa timing; apply by Round 2 to be safe.", "fuqua-dates", 0.7)])

P.short("career_goals",
    "What are your post-MBA career goals? Share with us your first-choice career plan and your alternate plan.",
    ("words", 100), "fuqua-instructions", ["GOALBOX", "GOALS"],
    parts=["first-choice career plan", "alternate plan"],
    notes=[
        ("Hubert: Fuqua looks for 'clarity of thought and a connection between past experiences and future ambitions', and for how grounded the applicant's expectations are, since plans evolve.", "ca-hubert-2025"),
        ("Hubert (2024): the answer gauges self-awareness and the ability to connect past experience with transferable skills and new passions.", "ca-hubert-2024"),
        ("Open with a few words on the long-term impact so the short-term plan makes sense, without labelling it 'my long-term goal'; then plan A and plan B, and why each leads there.", "al-fuqua"),
        ("Add one piece of background that makes you credible for the plan without making the MBA look unnecessary. Switchers can cite the homework that confirmed the switch is feasible.", "al-fuqua"),
        ("Pick target roles and employers in industries where Fuqua actually places graduates (check the employment report).", "al-fuqua"),
        ("At 100 words, every sentence carries a fact; the hook story can live in the 25 Random Things instead.", "admitstory-coach"),
    ])
P.short("background_context",
    "Do you have other lived experiences that you would like to share with the Admissions Committee that may give us insight into your opportunities, challenges, and/or achievements? If so, please share 200 words or less explaining how those experiences might affect your contributions to your program.",
    ("words", 200), ["al-fuqua", "ca-hubert-2025"], ["CONTEXT"], required=False, verified=False,
    parts=["the lived experience and its effect on opportunities, challenges or achievements", "how it affects your contribution to the program"],
    notes=[
        ("Hubert describes an optional second short answer for context on background: family, upbringing or unusual life circumstances.", "ca-hubert-2025"),
        ("Matter-of-fact, never a bid for sympathy: what the circumstance was, how it limited you, and ideally how it now shapes the way you help others. If nothing real applies, leave it blank.", "al-fuqua"),
        ("For the contribution part, a brief pointer to the contribution essay is enough; if there's no campus link, supporting others from a similar background or sharing the perspective with classmates is fine.", "al-fuqua"),
    ])
P.todo.append("application.short_answers[key=background_context]: confirm the verbatim wording and limit in the 2026-27 portal (not on the instructions page)")

P.essay("25_random_things",
    "The 'Team Fuqua' spirit and community is one of the things that sets the MBA experience apart, and it is a concept that extends beyond the student body to include faculty, staff, and administration. Please share with us “25 Random Things” about you. The Admissions Committee wants to get to know YOU - beyond the professional and academic achievements listed in your resume and transcript. Share with us important life experiences, your hobbies, achievements, fun facts, or anything that helps us understand what makes you who you are. Your list will be limited to 2 pages (750 words maximum). Please present your response in list form, numbered 1 to 25. Some points may be brief, while others may be longer.",
    ("words", 750), "fuqua-instructions", ["LIST", "IDENTITY"], list_count=25,
    parts=["25 numbered items", "beyond the resume and transcript"],
    notes=[
        ("Hubert calls it a favourite of candidates and the admissions team: use it for 'values, relationships, formative experiences, or quirks' rather than rehashing work achievements, which the resume already shows.", "ca-hubert-2025"),
        ("Hubert (2024): spend the space on personal accomplishments, family, hopes, fears and desires more than professional ones.", "ca-hubert-2024"),
        ("Don't copy the question into the upload (it gets flagged for plagiarism); 1.5 spacing, at least 10-point; the numbers 1–25 don't count toward the 750 words.", "fuqua-instructions"),
        ("Every item should carry a little story or a turn, not just a fact: 'I coach my brother's team' becomes what coaching him taught you.", "al-fuqua"),
        ("Rough mix: about a third fun or personal, a third the story behind work (never a resume bullet), a third community and hobbies. Sprinkle rather than group; open and close on something personal.", "al-fuqua"),
        ("Never brag. If an award must appear, frame it by what it meant to you. Use the list to break a stereotype of your industry and, where it fits, to plant the origin of your career interest.", "al-fuqua"),
        ("Think past, present and future across personal, community and professional — everything except future professional plans, which the goals answer covers.", "al-fuqua"),
        ("Each item in its own register: a funny one can be funny, a grief one unhurried. Specific nouns, names and numbers make items memorable; no item should repeat a story told elsewhere in the file.", "admitstory-coach"),
    ])
P.essay("three_contributions",
    "Fuqua prides itself on cultivating a culture of engagement. Our students enjoy a wide range of student-led organizations that provide opportunities for leadership development and personal fulfillment, as well as an outlet for contributing to society. Our student-led government, clubs, centers, and events are an integral part of the student culture and to the development of leaders. Based on your understanding of the Fuqua culture, what are 3 ways you expect to contribute at Fuqua?",
    ("words", 500), "fuqua-instructions", ["CONTRIBUTION", "WHY-SCHOOL"], list_count=3,
    parts=["contribution 1", "contribution 2", "contribution 3", "grounded in your understanding of Fuqua culture"],
    notes=[
        ("Hubert: Fuqua deliberately limits the answer to the three most meaningful areas to force prioritisation, an early skill students need with so many ways to engage.", "ca-hubert-2025"),
        ("Exactly three. Squeezing in extras reads as not following instructions.", "al-fuqua"),
        ("For each: something concrete you've already done outside work or class, then the specific Fuqua equivalent and what you'd do there. Promises with no history (volunteering when you never have) backfire.", "al-fuqua"),
        ("A strong mix is one professional club plus at least one non-professional club, event or community role. A concrete suggestion for a club (a panel, a trek, a prep resource), found by researching its events, earns credit.", "al-fuqua"),
        ("Contributions outside the classroom read as more meaningful than 'I'll bring my industry perspective to discussions'.", "al-fuqua"),
        ("Verify every club, conference and event named against Fuqua's current pages; an unverifiable specific is the most detectable weak point in a why-us essay.", "admitstory-coach"),
    ])
P.optional("tell_us_more",
    "If you feel there are circumstances of which the admissions committee should be aware, please explain them here (e.g. unexplained gaps in work, choice of recommenders, inconsistent or questionable academic performance). Note that you should NOT upload additional essays nor additional recommendations in this area. The Optional Information section is intended to provide the admissions committee with insight into your circumstances only.",
    ("words", 500), "fuqua-instructions", ["OPTIONAL"], required=False,
    parts=["circumstances the committee should know"],
    notes=[
        ("Hubert's most common pitfall: leaving questions unanswered. Explain a weaker part of the file and what you've done to shore it up; it shows self-awareness and humility.", "ca-hubert-2025"),
        ("Brief, factual, not apologetic: what happened, the context, the evidence that it's no longer a concern.", "al-fuqua"),
    ])
P.reapplicant(essay=dict(key="reapplicant",
    verbatim="It is not uncommon for it to take more than one try to achieve a goal. Please share with us the self-reflection process that you underwent after last year's application and how you have grown as a result. How did it shape your commitment to Fuqua and inspire your decision to reapply?",
    limit=("words", 500), src="fuqua-instructions", archetypes=["REAPPLICANT"],
    parts=["the self-reflection process after last year", "how you have grown", "how it shaped your commitment to Fuqua and decision to reapply"],
    notes=[
        ("One page, 500 words. Readers will likely compare it with last year's file.", "fuqua-instructions"),
        ("Lead with leadership growth, not scores: what new responsibility taught you and how it makes you a better classmate. A sixth project like the first five doesn't count.", "al-fuqua"),
        ("Refine the career vision rather than reversing it; if it changed, show the thread connecting old and new and the research that drove the change.", "al-fuqua"),
        ("Show deeper engagement with Fuqua since last year (conversations, events, visits) and any academic upgrade, without self-flagellation.", "al-fuqua"),
    ]),
    policy=[
        ("Reapplicants can clone a 2024-25 or 2025-26 application, may reuse last year's recommendation and may add one new letter; they must interview again.", "fuqua-instructions"),
        ("Reapplicants from the last two years get a fee waiver.", "fuqua-instructions"),
    ])

P.form("work_experience", "Application form: work experience and reasons for changes", "ca-hubert-2024", guidance=[
    ("Hubert asks applicants to treat each form section, even if it seems redundant, as a chance to show more of themselves, including why they changed positions or companies.", "ca-hubert-2024")])
P.recs("fuqua-instructions", 1, "school_specific", questions=[
    "Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's role in your organization.",
    "How does the performance of the applicant compare to that of other well-qualified individuals in similar roles?",
    "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
    "Is there anything else we should know? (Optional)",
], notes=[
    ("One required letter on Fuqua's online form; relatives and friends strongly discouraged, academic letters less helpful. Recommenders use work email addresses.", "fuqua-instructions"),
    ("Current Fuqua students and alumni can also submit an endorsement (rating teamwork, motivation, leadership potential, professional preparedness and communication style). It must come from someone who knows you well; don't ask a student you met once.", "fuqua-instructions"),
    ("Brief the recommender with facts for the feedback question: the feedback, what you changed, and later proof.", "admitstory-coach"),
])
P.todo.append("application.recommendations.questions: limits per question (not stated)")
P.resume("fuqua-instructions", 1, notes=[("Required one-page resume, most recent first, with location, title, dates and responsibilities for every role.", "fuqua-instructions")])
P.add("application.test_policy", [
    ("GMAT, GMAT Focus, GRE or Executive Assessment, no preference and no minimum; self-reported at application. Include all individual GMAT scores alongside any superscore.", "fuqua-instructions"),
    ("Fuqua offers no test waivers for the Daytime MBA and pays particular attention to the quant part of the score.", "ca-hubert-2024"),
    ("Fuqua does not accept English-language test scores for the Daytime MBA.", "fuqua-instructions"),
])
P.add("application.fees_waivers", [
    ("US$225 non-refundable. A US$75 discount for attending an info session or event, or for a student/alumni endorsement.", "fuqua-instructions"),
    ("Full waivers include: applying in Early Action, a campus visit before applying, military of any nation, Peace Corps/AmeriCorps/Teach For All, Forté MBALaunch, MLT, Fulbright, ROMBA and similar programs, UN least-developed-country citizens, and reapplicants from the last two years.", "fuqua-instructions"),
])

P.add("values.stated", [
    ("Team Fuqua is 'a culture in which people challenge and support one another, hold one another to high standards, and share responsibility for making the whole better.'", "fuqua-about"),
    ("Fuqua selects people who 'demonstrate competence, character, and purpose' and have the strongest potential to be leaders who are a positive force for change.", "fuqua-dates"),
    ("Hubert wants to see how an applicant would make the community stronger and how the community could support their growth.", "ca-hubert-2025"),
])
P.value("Team Fuqua: challenge and support each other", ["brings_people_along", "develops_people", "community_builder"], ("Supportive ambition (your success is my success) is the heart of fit: mentoring and helping colleagues succeed is the strongest evidence.", "al-fuqua"))
P.value("character and integrity", ["principled_stands"], ("Show integrity through a challenge that happened to involve an ethical choice, never by claiming it.", "al-fuqua"))
P.value("competence and purpose", ["measurable_impact", "self_aware"])
P.value("entrepreneurial mindset (curiosity, resilience, stakeholder empathy)", ["curious_learner", "resilient", "empathetic"], ("Hubert lists curiosity, resilience, stakeholder empathy, action-oriented problem-solving and intentional impact as essential.", "ca-hubert-2025"))
P.add("insider_notes", [
    ("Fuqua's earlier materials framed fit through six paired principles (authentic engagement, supportive ambition, collective diversity, impactful stewardship, loyal community, uncompromising integrity). They're not on the current site but remain a useful brainstorm for the 25 Random Things.", "al-fuqua", 0.6),
    ("Hubert: 'we check every application that we receive' for completeness, and applicants can send material updates after submitting.", "ca-hubert-2025"),
    ("Fuqua is building AI into every core course from 2025-26, with new electives AI for Managers and Transforming Tech Analytics with Machine Intelligence.", "ca-hubert-2025"),
    ("Class of 2028: 359 students, 44% women, 38% international, 24% US military, 19% first-generation, six years' average work experience; middle-80% GMAT Focus 605–715, GRE V+Q 307–330, EA 150–162, GPA 3.15–3.90.", "fuqua-profile"),
])
P.add("culture_and_location", [
    ("The class schedule encourages students to stay in Durham over the weekend; Research Triangle Park hosts more than 250 companies and the area has more than 3,000 Fuqua alumni.", "fuqua-academics"),
    ("All first-year students are placed on teams of four to five, and the 60+ clubs are student-run through the MBA Association.", "fuqua-academics"),
])
P.add("academics.structure", [
    ("22 months starting in August: a month-long summer start with three core courses, then four six-week terms a year; about 13–14 core courses and over 100 electives. Year two opens with Consequential Leadership II.", "fuqua-academics"),
    ("Students may take one or two concentrations (six electives each), or one concentration plus a certificate.", "fuqua-academics"),
])
P.thing("academics.courses", "Health Sector Management (HSM) certificate", "Layers interdisciplinary study of the health sector onto the MBA, with a required summer boot camp; prepares for health systems, pharma, med devices, health consulting, policy and biotech.", "fuqua-academics",
        why=["health care, health tech and life sciences goals"], url="https://www.fuqua.duke.edu/programs/daytime-mba/concentrations-certificates")
P.thing("academics.courses", "Concentrations (selection)", "Includes Business Analytics/Decision Sciences, Energy & Environment, Entrepreneurship & Innovation, Finance, FinTech, Leadership & Ethics, Management, Marketing, Operations Management, Social Entrepreneurship and Strategy.", "fuqua-academics",
        why=["matching the goals answer to a named academic path"], url="https://www.fuqua.duke.edu/programs/daytime-mba/concentrations-certificates")
P.thing("academics.experiential", "Fuqua Client Consulting Practicum (FCCP)", "Team consulting projects for real clients across business functions and industries.", "fuqua-academics", why=["career switchers", "consulting goals"], url="https://www.fuqua.duke.edu/programs/daytime-mba/experiential-learning")
P.thing("academics.experiential", "Global Academic Travel Experience (GATE)", "Six weeks of coursework on a country or region followed by a two-week study tour there.", "fuqua-academics", why=["international goals"], url="https://www.fuqua.duke.edu/programs/daytime-mba/global-opportunities")
P.thing("academics.experiential", "DUHELP and Mentored Study", "Health-system projects with Duke University Hospital (DUHELP) and 12-week mentored study engagements.", "fuqua-academics", why=["health care goals"], url="https://www.fuqua.duke.edu/programs/daytime-mba/experiential-learning")
for name, what, why in [
    ("Center for Health Sector Management (HSM)", "Described by Fuqua as the oldest and largest health management program among top US business schools.", ["health care goals"]),
    ("Duke Innovation & Entrepreneurship (Duke I&E)", "Fuqua and Duke partnership building students' entrepreneurial mindset and skills; Hubert highlights its New Ventures series.", ["founders", "innovation goals"]),
    ("CASE (Center for the Advancement of Social Entrepreneurship)", "Prepares people and organisations to achieve lasting social change; runs the CASE i3 Consulting Program.", ["social impact goals"]),
    ("COLE (Fuqua/Coach K Center on Leadership & Ethics)", "Leadership research and education, with a leadership and ethics concentration and fellowships.", ["leadership development"]),
    ("EDGE (Center for Energy, Development, and the Global Environment)", "Hub on energy, natural resources, development and the environment.", ["energy and climate goals"]),
]:
    P.thing("academics.centers", name, what, "fuqua-centers", why=why, url="https://www.fuqua.duke.edu/faculty-research/centers")
P.thing("community.treks_events", "Duke Disrupts Tech Symposium, Energy Conference, Women's Leadership Conference", "Student-run conferences named on Fuqua's clubs page.", "fuqua-about", why=["contribution essay ideas tied to past event organising"], url="https://www.fuqua.duke.edu/student-network/clubs-activities")
P.todo.append("community.clubs: verify specific professional and affinity clubs on the official clubs page")

P.employment("fuqua-employment-2025", 2025, [
    ("Consulting", 0.359, 190000), ("Finance/Accounting", 0.274, 150000), ("General Management", 0.165, 142800),
    ("Marketing/Sales", 0.131, 130000), ("Operations/Logistics", 0.042, 149500)],
    ["McKinsey", "BCG", "Bain & Company", "Deloitte Consulting", "EY-Parthenon", "Kearney", "Oliver Wyman", "Accenture Strategy", "Amazon", "Microsoft Corporation", "Apple", "Meta (Facebook)", "Goldman Sachs", "JPMorgan Chase", "Morgan Stanley", "Bank of America", "Eli Lilly and Company", "Johnson & Johnson", "Pfizer", "UnitedHealth Group", "DaVita", "P&G (Procter & Gamble)", "PepsiCo", "Nike"])
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$160,000, median signing bonus US$30,000; 82.2% had offers and 79% accepted within three months.", "fuqua-employment-2025"),
    ("By industry: consulting 34.0% (US$190,000), financial services 20.9% (US$175,000), technology 15.6% (US$144,000), healthcare 7.4% (US$140,000), CPG 4.9% (US$125,000).", "fuqua-employment-2025"),
    ("Hubert: career search is integrated into the Daytime MBA from the start, 'not an afterthought'.", "ca-hubert-2024"),
])
P.todo.append("careers.employment_report.intl_offer_rates: from Fuqua's work-authorization breakdown spreadsheet")
P.class_profile("fuqua-profile", 2028, size=359, intl=0.38)

P.interview("fuqua-instructions", "invite_only", ["adcom", "student", "alum"], True, 60, ["campus", "virtual"], notes=[
    ("Every admit interviews; invitations are rolling. Interviewers are admissions staff, alumni or trained second-year Admissions Fellows, all valued equally. They see only the resume.", "fuqua-instructions"),
    ("Interviews run 45–60 minutes, business casual; on-campus slots in EA, R1 and R2, virtual in every round.", "fuqua-instructions"),
    ("Not being invited at first isn't final: applicants can be invited later in the process. Invitation timing isn't significant.", "ca-hubert-2025"),
    ("Since 2024-25 every interview is by invitation; the old self-initiated open interview period has ended.", "ca-hubert-2024"),
])
P.todo.append("interview.common_questions: gather recent interview reports")
P.ai("fuqua-instructions", "limited", ["essays"], notes=[
    ("Tools such as Grammarly or ChatGPT 'may be used to support editing and clarity, but your ideas, experiences, and responses should be your own'. 'AI should help refine your content, not generate it.'", "fuqua-instructions"),
    ("All essays are scanned by plagiarism software and may be reviewed with AI-detection tools; AI-generated content used without attribution counts as plagiarism under the Fuqua Honor Code.", "fuqua-instructions"),
    ("Applicants working with a consultant should confirm the consultant knows the Honor Code policy and won't share their essays.", "fuqua-instructions"),
])
P.todo.append("scholarships: Fuqua merit scholarship process and named fellowships")
P.add("avoid", [
    ("Rehashing work achievements in the 25 Random Things; bragging is the strongest negative signal there.", "ca-hubert-2025"),
    ("More or fewer than three contributions, or contributions with no history behind them.", "al-fuqua"),
    ("Leaving a weakness unexplained in the hope readers won't notice.", "ca-hubert-2025"),
    ("Copying the essay question into the uploaded document; it triggers the plagiarism flag.", "fuqua-instructions"),
    ("Goals in industries where Fuqua doesn't place graduates.", "al-fuqua"),
])
P.add("angles_that_work", [
    ("A 25 Random Things list that opens on its most charming personal item, tells the backstory behind one work moment the resume can't, and plants the origin of the career interest in a single line.", "al-fuqua"),
    ("Contributions built as past proof plus Fuqua mechanism: 'I ran X before; at Fuqua I'd do Y for this club', with one concrete suggestion for the club.", "al-fuqua"),
    ("Across the file: the goals answer carries the logic, the 25 things carry the person, the contributions carry the community. No story appears twice.", "admitstory-coach"),
])
P.term("Team Fuqua", "Fuqua's name for its culture of challenging and supporting one another.", "fuqua-about")
P.term("Admissions Fellows", "Trained second-year students who conduct many admissions interviews.", "fuqua-instructions")
P.term("Endorsement", "An optional form a current Fuqua student or alum can submit about an applicant.", "fuqua-instructions")
P.write()
