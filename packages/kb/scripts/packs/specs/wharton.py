import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("wharton", "The Wharton School, University of Pennsylvania", "Wharton", "US", "Philadelphia, PA", "https://mba.wharton.upenn.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are Admitstory rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
W = "https://mba.wharton.upenn.edu"
P.source("wharton-guide", "official", "Wharton MBA: 2026-2027 Application Guide (essays, resume, recommendation, tests, fee, Tips from the Admissions Committee)", W + "/application-guide/")
P.source("wharton-deadlines", "official", "Wharton MBA: 2026-27 Application timeline and deadlines", W + "/application-timeline-deadlines/")
P.source("wharton-interview", "official", "Wharton MBA: Interview process (Team Based Discussion)", W + "/interview-process/")
P.source("wharton-open-2029", "official", "Wharton MBA admissions blog: Class of 2029 application now open", W + "/mba-admissions/class-of-2029-application-now-open/")
P.source("wharton-profile", "official", "Wharton MBA: Class profile (Class of 2027)", W + "/class-profile/")
P.source("wharton-career-2025", "official", "Wharton MBA Careers: 2025 Career Report (Class of 2025 full-time, Class of 2026 internships) (PDF)", "https://statistics.mbacareers.wharton.upenn.edu/wp-content/uploads/2025/12/2025-Career-Report.pdf")
P.source("wharton-curriculum", "official", "Wharton MBA: Curriculum (fixed and flexible core, majors, electives, Pre-Term, learning teams)", W + "/mba-curriculum/")
P.source("pq-ai-2026", "press", "Poets&Quants (Fortuna, May 26, 2026): AI policies at top MBA programs, quoting each school's application materials", "https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/")
P.source("al-wharton", "third_party_reference", "ApplicantLab — Wharton school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "Admitstory coaching canon and Manu's storytelling rules", None)

P.url("prompts", W + "/application-guide/"); P.url("deadlines", W + "/application-timeline-deadlines/")
P.url("class_profile", W + "/class-profile/"); P.url("employment_report", "https://statistics.mbacareers.wharton.upenn.edu/wp-content/uploads/2025/12/2025-Career-Report.pdf")

P.round("Round 1", "2026-09-08", "wharton-deadlines", decision="2026-12-17", invites="2026-10-28", notes=[
    ("Due 5:00 pm ET. A late Round 1 or 2 application rolls into the next round; Round 1 deposit deadline 5 Feb 2027.", "wharton-deadlines"),
    ("Wharton encourages Round 1 or 2, especially if you need a US student visa; Lauder and Carey JD/MBA accept Rounds 1 and 2 only.", "wharton-deadlines"),
])
P.round("Round 2", "2027-01-05", "wharton-deadlines", decision="2027-03-31", invites="2027-02-19", notes=[("Due 5:00 pm ET; deposit by 29 Apr 2027.", "wharton-deadlines")])
P.round("Round 3", "2027-03-31", "wharton-deadlines", decision="2027-05-11", invites="2027-04-16", notes=[("Space is more limited, so Round 3 is more competitive; late Round 3 applications aren't accepted.", "wharton-deadlines")])
P.round("Deferred Admissions Round", "2027-04-21", "wharton-deadlines", decision="2027-07-01", invites="2027-05-26", notes=[("Moelis Advance Access Program; due 11:59 pm ET; US$100 fee.", ["wharton-deadlines", "wharton-guide"])])

P.essay("goals_immediate",
    "Essay 1, first short answer: What is your immediate post-MBA professional goal?",
    ("words", 50), "wharton-guide", ["GOALBOX", "GOALS"],
    parts=["the job right after Wharton: title, function, industry"],
    notes=[
        ("Admissions: 'Be specific and direct. What job do you want right after Wharton? Think title, function, industry, etc. Don't worry about explaining why here, this is about clarity.'", "wharton-guide"),
        ("Pitch the level right: not 'a leadership role in industry' and not one exact title at one company; 'finance manager at an electric-vehicle maker' is the target. If the plan carries risk, a credible second role shows realism.", "al-wharton"),
    ])
P.essay("goals_medium_long",
    "Essay 1, second short answer: Describe your medium- and long-term professional goals after your Wharton MBA.",
    ("words", 150), "wharton-guide", ["GOALS"],
    parts=["medium-term goals", "long-term goals"],
    notes=[
        ("Admissions: 'This question isn't about precision, it's about context… Successful responses will show both focus and self-awareness. We simply want to know where you currently see yourself headed.' A clear vision or a general sense of the impact you want are both fine.", "wharton-guide"),
        ("Open with the why (what makes a stranger believe you care), then the long-term goal, then the medium-term role as the step toward it and what it will teach you. Avoid bouncing between time frames.", "al-wharton"),
        ("If space allows, one line of credibility from your current job ('this is what I'll build on') helps; skip Wharton resources unless the plan collapses without one.", "al-wharton"),
    ])
P.essay("meaningful_value",
    "Essay 2: Taking into consideration your background – personal, professional, and/or academic – how do you plan to add meaningful value to the Wharton community?",
    ("words", 350), "wharton-guide", ["CONTRIBUTION", "IDENTITY"],
    parts=["your background: personal, professional and/or academic", "the value you will add to the community"],
    notes=[
        ("Admissions: reflect 'not just how you'll get involved, but the unique value you'll add… focusing on the impact of your presence at Wharton, grounded in the experiences, values, or perspectives that shape who you are. Rather than focusing on what you'll do, focus on how you'll show up and why that matters.'", "wharton-guide"),
        ("Prove every promise with a past example: what you did for a community before and what it achieved, then the parallel contribution at Wharton, then why classmates benefit. Two or three strong pairings beat six shallow ones.", "al-wharton"),
        ("Make it concrete after real research: a role in a named club or conference, a panel topic missing from an agenda, a trek to a city you know, or something you'd start. 'I'll help the club grow' says nothing.", "al-wharton"),
        ("Order by impact on classmates: career help first, academic help next, social or hobby contributions last. Academic help is weak unless you've actually taught or mentored others.", "al-wharton"),
        ("Balance Wharton's 2026 emphasis on who you are with proof: let one value or perspective run through the essay, and show it in action rather than listing clubs.", "admitstory-coach"),
    ])
P.optional("additional_information",
    "Please use this space to share any additional information about yourself that cannot be found elsewhere in your application and that you would like to share with the Admissions Committee. This space can also be used to address any extenuating circumstances (e.g., unexplained gaps in work experience, choice of recommenders, inconsistent or questionable academic performance, areas of weakness, etc.) that you would like the Admissions Committee to consider.",
    ("words", 500), "wharton-guide", ["OPTIONAL"], required=False,
    parts=["additional information or extenuating circumstances"],
    notes=[
        ("Admissions: paragraphs or bullet points are fine; 'be straightforward and brief… just give us the facts. Acknowledging something you view as a weaker part of your application will not disadvantage you.'", "wharton-guide"),
    ])
P.reapplicant(essay={"key": "reapplicant",
    "verbatim": "Please use this space to share with the Admissions Committee how you have reflected and grown since your previous application and discuss any relevant updates to your candidacy (e.g., changes in your professional life, additional coursework, and extracurricular/volunteer engagements).",
    "limit": ("words", 250), "src": "wharton-guide", "archetypes": ["REAPPLICANT"],
    "parts": ["reflection and growth since the last application", "updates to your candidacy"],
    "notes": [
        ("Show mature reflection (perhaps the leadership evidence or career vision wasn't ready) and what you learned from the new experience; never blame the interview or imply Wharton erred. Say how classmates will now benefit.", "al-wharton"),
    ]},
    policy=[("Required for all reapplicants.", "wharton-guide")])
P.recs("wharton-guide", 1, "gmac_common", notes=[
    ("One letter, through the GMAC Common Letter of Recommendation with its assessment, from someone who knows your work well, preferably a current or former supervisor (Carey JD/MBA needs two).", ["wharton-guide", "wharton-open-2029"]),
    ("Admissions: the recommender's title matters less than 'their ability to comment knowledgeably and specifically about you'. Give them your resume, essays and the projects to highlight. Entrepreneurs or family-business applicants can use a mentor, client or partner.", "wharton-guide"),
])
P.resume("wharton-guide", 1, notes=[
    ("'We expect your resume to be one single page.' Bullets shouldn't read like a job description: show growth, progression, accomplishments and proof of analytical, communication, teamwork and leadership skills, with metrics. Add a one- or two-sentence description of any employer that isn't a household name. PDF, under 10 MB.", "wharton-guide"),
])
P.add("application.test_policy", [
    ("GMAT (legacy or Focus) or GRE required, at a centre or online; self-report allowed (list the highest first). No minimum and no preference. Test date windows: Round 1, 8 Sep 2021 – 8 Sep 2026; Round 2, 5 Jan 2022 – 5 Jan 2027; Round 3, 31 Mar 2022 – 31 Mar 2027. AWA not required.", ["wharton-guide", "wharton-profile"]),
    ("TOEFL iBT, PTE, IELTS or Duolingo required unless you studied where English was the language of instruction.", "wharton-guide"),
])
P.add("application.fees_waivers", [("Application fee US$275; waived for US active-duty military and veterans.", "wharton-guide")])

P.add("values.stated", [
    ("Readers ask three questions: 'What will you be able to achieve and contribute to the Wharton classroom, within the Wharton community, and throughout your post-MBA career?' They forecast success in an environment that is 'highly collaborative and analytically focused… where communication and teamwork are key.'", "wharton-guide"),
    ("Every application gets two independent reads, neither reader knowing the other's view.", "wharton-guide"),
    ("Essays: 'be introspective, candid, succinct, and most importantly… be yourself!'", "wharton-guide"),
])
P.value("collaborative; teamwork is key", ["brings_people_along", "community_builder"], ("Students work in as many as 20 teams over the program; show how you make a team better, not just that you led one.", "al-wharton"))
P.value("analytically focused", ["analytical", "commercial_judgment"])
P.value("contribute to classroom and community", ["community_builder", "develops_people"])
P.add("insider_notes", [
    ("Class of 2027: 888 students from 7,613 applications; 44% women; 26% international; 68 countries; 12% LGBTQ+; 11% first-generation; 6% military. Average GMAT Focus 676 (legacy 735); average GRE 163 quant, 162 verbal; average GPA 3.7; average work experience five years (no minimum or maximum).", "wharton-profile"),
    ("Wharton recently shortened its essays (a 50-word role, a 150-word medium/long-term answer, a 350-word essay), so career and fit evidence has to be tight.", ["wharton-guide", "al-wharton"]),
])
P.add("culture_and_location", [
    ("Philadelphia campus; a large, collaborative class that works in cohorts and learning teams.", ["wharton-curriculum", "al-wharton"], 0.75),
])
P.add("academics.structure", [
    ("Three integrated interdisciplinary programs: Lauder MBA/MA in International Studies, Carey JD/MBA, and the MBA in Health Care Management, each with its own interview.", ["wharton-profile", "wharton-interview"]),
])
P.add("academics.structure", [
    ("19 credit units: six fixed core courses (including Foundations of Leadership and Teamwork, which opens with the Teamwork and Leadership Simulation, plus speaking and persuasive-writing courses) and a flexible core where more than half the core can be chosen and timed to fit an internship or venture.", "wharton-curriculum"),
    ("22 majors, usually five credit units each; courses can count toward two majors. Nearly 200 electives across 10 departments, and up to four courses from Penn's 11 other schools.", "wharton-curriculum"),
    ("Pre-Term opens the program; the first year runs through a learning team of five or six classmates.", "wharton-curriculum"),
])
P.add("insider_notes", [
    ("For 'why Wharton' in an interview or the contribution essay: name a major (or two) and one cross-Penn course tied to a specific future situation, not 'world-class finance'.", ["wharton-curriculum", "admitstory-coach"]),
])
P.todo.append("academics: verify majors, flexible core and named experiential programs (e.g. Leadership Ventures, Global Immersion) from the Wharton site")
P.todo.append("community.clubs: verify Wharton clubs, conferences and treks (WGA, Wharton Women in Business, Follies, Cluster Olympics)")

P.employment("wharton-career-2025", 2025, [
    ("Financial Services", 0.382, 175000), ("Consulting", 0.282, 190000), ("Technology", 0.153, 164250), ("Health Care", 0.038, 155000),
    ("Legal & Professional Services", 0.025, 235000), ("Retail", 0.021, 162500), ("Real Estate", 0.019, 150000), ("Manufacturing", 0.019, 155000)],
    ["Accenture", "Amazon", "Bain & Company", "Boston Consulting Group", "McKinsey & Company", "Goldman Sachs", "Blackstone", "BlackRock", "Apollo Global Management", "Capital One"])
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$185,000; of 608 seeking jobs, 90.5% reported offers and 87.0% acceptances; 94% stayed in the US.", "wharton-career-2025"),
    ("Within financial services: private equity 13.4% (median US$200,000), investment banking 14.2% (US$175,000), investment management 5.3%, venture capital 2.8%.", "wharton-career-2025"),
])
P.class_profile("wharton-profile", 2027, size=888, gmat_focus=676, gmat=735, gre=(162, 163), gpa=3.7, wexp=5, intl=0.26)
P.todo.append("class_profile: Wharton publishes averages, not medians")

P.interview("wharton-interview", "invite_only", ["adcom"], None, 30, ["virtual"],
    questions=[
        ("Team Based Discussion: a prompt with a purpose, solved with 5–6 other applicants for a tangible outcome.", "wharton-interview", 5),
        ("One-on-one: how did you think the discussion went, and how did you contribute?", "wharton-interview", 5),
    ],
    notes=[
        ("By invitation: a 20-minute virtual Team Based Discussion with 5–6 randomly assigned applicants, then a 10-minute one-on-one with an admissions team member to reflect on your TBD performance. Details arrive well before your slot.", "wharton-interview"),
        ("It looks at 'communication style, level of engagement, leadership skills, decision-making process'. Admissions' advice: use methods that have moved your teams forward, adapt to the group, be yourself ('There is no specific role that is expected of you'), and relax.", "wharton-interview"),
        ("Build on others' ideas by name, help the group reach the deliverable on time, and bring one prepared idea without hijacking the discussion; in the debrief, assess yourself honestly, including what you'd change.", "admitstory-coach", 0.75),
    ])
P.ai("pq-ai-2026", "limited", ["essays"],
    notes=[
        ("Wharton's application: 'Your work contained within this application must be your own… it is unacceptable to have AI substantially complete the task' (treat AI like another person's writing). 'Wharton may use its own proprietary and/or licensed AI solutions in order to identify AI-authored elements', and flagging triggers 'a more holistic investigation'.", "pq-ai-2026"),
    ])
P.todo.append("ai_policy: confirm the statement in the live portal")
P.add("avoid", [
    ("A contribution essay of club names without proof from your past.", "al-wharton"),
    ("A two-page resume, or bullets that read like a job description.", "wharton-guide"),
    ("Explaining 'why' in the 50-word goal answer.", "wharton-guide"),
    ("Dominating the Team Based Discussion.", ["wharton-interview", "admitstory-coach"]),
])
P.add("angles_that_work", [
    ("Essay 2 built on one value shown in two past contributions, each mapped to a specific way classmates benefit.", ["wharton-guide", "al-wharton"]),
    ("A medium/long-term answer that shows self-awareness about what the applicant still needs to learn.", "wharton-guide"),
])
P.term("TBD", "Team Based Discussion: Wharton's group interview, followed by a short one-on-one.", "wharton-interview")
P.term("Learning Team", "The small first-year team Wharton students work in throughout the core.", "al-wharton")
P.term("Moelis Advance Access", "Wharton's deferred-admission program for college seniors.", "wharton-guide")
P.write()
