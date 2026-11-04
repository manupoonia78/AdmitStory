import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("ucla-anderson", "UCLA Anderson School of Management", "Anderson", "US", "Los Angeles, CA", "https://www.anderson.ucla.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
REQ = "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions/requirements"
P.source("anderson-req", "official", "UCLA Anderson Full-Time MBA: Application requirements (essays, interview, recommendations, resume, tests, reapplicants)", REQ)
P.source("anderson-admissions", "official", "UCLA Anderson Full-Time MBA: Admissions (deadlines, what we look for)", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions")
P.source("anderson-faq", "official", "UCLA Anderson Full-Time MBA: Admissions FAQ (AI policy, rounds, tests)", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions/faq")
P.source("anderson-profile", "official", "UCLA Anderson Full-Time MBA: Class of 2028 profile", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions/class-profile")
P.source("anderson-careers", "official", "UCLA Anderson Full-Time MBA: Career impact (Class of 2025 outcomes)", "https://www.anderson.ucla.edu/degrees/full-time-mba/career-impact")
P.source("anderson-academics", "official", "UCLA Anderson Full-Time MBA: academics, capstones, specializations, centers, Parker CMC, living in LA", "https://www.anderson.ucla.edu/degrees/full-time-mba/academics")
P.source("anderson-team", "official", "UCLA Anderson Full-Time MBA: Meet our team", "https://www.anderson.ucla.edu/degrees/full-time-mba/meet-our-team")
P.source("ca-lawrence-2024", "adcom", "Clear Admit Live Admissions Q&A: Alex Lawrence, UCLA Anderson (Aug 2024)", "https://www.clearadmit.com/2024/08/live-admissions-qa-alex-lawrence-of-ucla-anderson/", read=False)
P.source("al-anderson", "third_party_reference", "ApplicantLab — UCLA Anderson school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", REQ); P.url("deadlines", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions")
P.url("class_profile", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions/class-profile")
P.url("employment_report", "https://www.anderson.ucla.edu/degrees/full-time-mba/career-impact")
P.url("ai_policy", "https://www.anderson.ucla.edu/degrees/full-time-mba/admissions/faq")

P.round("Round 1", "2026-10-01", "anderson-admissions", decision="2026-12-11", notes=[("Applications due 11:59pm Pacific on the deadline date.", "anderson-faq")])
P.round("Round 2", "2027-01-06", "anderson-admissions", decision="2027-03-26")
P.round("Round 3", "2027-04-07", "anderson-admissions", decision="2027-05-14", notes=[("Historically fewer applicants are admitted in the last round, which tends to be especially competitive. Anderson grants no deferrals.", "anderson-faq")])

P.essay("goals",
    "Describe your short- and long-term post-MBA goals, including your desired role, industry, and examples of target companies. How will an MBA support your path to achieving your goals, and which UCLA Anderson resources do you expect to rely on most to reach them?",
    ("words", 250), "anderson-req", ["GOALS", "WHY-SCHOOL"],
    parts=["short-term goal: role, industry, example target companies", "long-term goal", "how an MBA supports the path", "the Anderson resources you'll rely on most"],
    notes=[
        ("Anderson: 'Strong essays are introspective, genuine, and succinct'; it wants to learn who you are and why an Anderson MBA is the right next step.", "anderson-req"),
        ("90% of the Class of 2028 are career switchers, and Anderson says most of its students are, so a well-researched switch is normal here.", "anderson-profile"),
        ("Draft one complete statement of purpose first, then split it: goals and resources go here, community contribution goes to the classmates essay.", "al-anderson"),
        ("Anderson publishes recommended electives by career interest, a fast starting point; add at least one resource beyond that list, since many applicants will cite the same courses.", "al-anderson"),
        ("At 250 words: one sentence of origin, then the target role with two named employers, the gap, and two or three resources, each with a concrete use. Name employers that actually hire from Anderson.", "admitstory-coach"),
    ])
P.essay("classmates_describe_you",
    "How do you hope your UCLA Anderson classmates will describe you by the time you graduate? What qualities and / or values do you want to be known for, and how will you demonstrate them as a student leader and community member?",
    ("words", 250), "anderson-req", ["CONTRIBUTION", "IDENTITY"],
    parts=["how classmates will describe you at graduation", "the qualities or values you want to be known for", "how you'll demonstrate them as a student leader and community member"],
    notes=[
        ("This is the contribution essay in different wording, rooted in Anderson's 'share success' value: helping classmates, even with an interview for a job you also want.", "al-anderson"),
        ("Work backwards: decide the tangible contribution first, ideally a repeat of something you've already done (for example mentoring junior analysts becoming a mentoring program in a club), then name the two to four qualities it shows.", "al-anderson"),
        ("Don't freeze on 'legacy': the qualities you want to be remembered for are simply the ones your real contribution shows.", "al-anderson"),
        ("Show the quality through one short past moment, then the specific Anderson mechanism; stated adjectives with no evidence read as generic.", "admitstory-coach"),
    ])
P.short("first_thing",
    "What is the first thing you would tell your classmates about yourself upon arriving at Anderson?",
    ("words", 50), "anderson-req", ["MICRO", "IDENTITY"],
    parts=["one thing about yourself"],
    notes=[
        ("Use something personal, usually a top hobby or a piece of background, since the other essays cover work and community. What makes it distinctive is how it entered your life and what it means to you now, plus one specific detail.", "al-anderson"),
        ("Nothing braggy (scores, awards). A hobby that might read as immature needs a positive frame, such as how it keeps you connected to people.", "al-anderson"),
        ("Fifty words is one scene and one line of meaning; specific nouns beat adjectives.", "admitstory-coach"),
    ])
P.optional("optional",
    "Are there any extenuating circumstances or additional context you would like to share with the Admissions committee?",
    ("words", 250), "anderson-req", ["OPTIONAL"], required=False,
    parts=["extenuating circumstances or additional context"],
    notes=[
        ("Anderson gives no preference to applicants who answer it. Use it for real context, not a bonus essay.", "anderson-req"),
        ("A failing course grade is explained in the application form, not here. If a direct supervisor can't recommend you, explain why here.", "al-anderson"),
        ("Brief, factual, mature: what happened, the context, the better evidence.", "al-anderson"),
    ])
P.short("test_waiver_essay",
    "You must submit an essay that provides evidence of your MBA readiness to support your case of applying without a test score.",
    ("words", 250), "anderson-req", ["OPTIONAL"], required=False,
    parts=["evidence of quantitative and academic readiness"],
    notes=[
        ("Required only for applicants without a score. Anderson weighs quantitative coursework, analytical work experience, certifications such as CPA or CFA, and expired test scores.", "anderson-req"),
    ])
P.todo.append("application.short_answers[key=test_waiver_essay].limit: no limit is published; 250 words is a placeholder")
P.reapplicant(essay=None, policy=[
    ("Reapplicants answer the short essays (the optional essay is suggested) and list updates on scores, career, academics and activities in the reapplicant section; they submit one new recommendation.", "anderson-req"),
    ("Anderson: 'Highlighting progress made since the prior application is the best way to get a different result this time', and 'there is no disadvantage to reapplying'.", "anderson-req"),
    ("Readers have last year's file, so the career vision should refine rather than reverse; Anderson has offered rejection-feedback requests in early June.", "al-anderson", 0.6),
])
P.recs("anderson-req", 2, "school_specific", questions=[
    "Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's role in your organization.",
    "How does the performance of the applicant compare to that of other well-qualified individuals in similar roles? (E.g. what are the applicant's principal strengths?)",
    "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
], notes=[
    ("Two letters for new applicants, one new letter for reapplicants; direct supervisors preferred; peers, family and professors are generally poor choices. The form also asks for ratings across several metrics.", "anderson-req")])
P.resume("anderson-req", 2, notes=[
    ("'Ideally on one page but not more than two'; it doesn't replace the employment section of the application.", "anderson-req"),
    ("Anderson: 'Quality of experience is more important than quantity' and 'those who advance faster than their peers are the people we admit first', so make progression visible.", "anderson-req"),
])
P.add("application.test_policy", [
    ("Test optional: GMAT, GMAT Focus, GRE or EA accepted but not required; highest total used, no superscoring or mixing; no minimum.", "anderson-req"),
    ("English proficiency (TOEFL/IELTS) is still required where applicable; almost all admits score over 100 on TOEFL iBT or 7.0 on IELTS.", "anderson-faq"),
])
P.add("application.fees_waivers", [("Fee US$200; waivers for US military applicants, current UCLA graduate students and SIEML participants.", "anderson-req")])

P.add("values.stated", [
    ("Anderson defines its community by three qualities: 'We share success, think fearlessly and drive change.'", "anderson-admissions"),
    ("Share success: collaborative and supportive of one another, fully engaged academically, thoughtful when they achieve success.", "anderson-admissions"),
    ("Think fearlessly: passionate, inquisitive and analytical while striving for innovation.", "anderson-admissions"),
    ("Drive change: original and productive in pursuit of meaningful impact, optimistic in hard times, strategic and, above all, resilient.", "anderson-admissions"),
])
P.value("share success", ["develops_people", "brings_people_along", "community_builder"], ("The values may come up in the interview as 'which principle resonates with you'; have a story ready for each.", "al-anderson"))
P.value("think fearlessly", ["originates_ideas", "curious_learner", "analytical"])
P.value("drive change", ["acts_unasked", "resilient", "measurable_impact"])
P.add("culture_and_location", [
    ("Anderson sells Los Angeles as a centre of business and creativity: in-year internship opportunities, access to industry leaders, startups and Fortune 500 companies, and the entertainment industry.", "anderson-academics"),
    ("Every student writes a leadership practice plan in the first week, followed by monthly one-on-one coaching (Leadership@Anderson).", "anderson-academics"),
])
P.add("insider_notes", [
    ("Class of 2028: 2,422 applications, 287 enrolled; mean GMAT Focus 660 (middle 80% 635–695), GMAT 10th edition 718, GRE 162 verbal and 164 quant, mean GPA 3.5, 5.4 years' average experience, 39% women, 36% international.", "anderson-profile"),
    ("Anderson leadership: Gary Fraser, Associate Dean of the Full-Time MBA; Alex Lawrence, Assistant Dean of MBA Admissions and Financial Aid since 2012.", "anderson-team"),
    ("Lawrence has said strong essays are reflective and authentic, answer the prompt concisely, show clear goals with specific Anderson detail, and carry real enthusiasm.", "ca-lawrence-2024", 0.55),
    ("The application form asks applicants to list their interactions with the Anderson community, so attend events or webinars and contact a student before applying.", "al-anderson"),
])
P.add("academics.structure", [
    ("22 months, 115+ electives starting in the winter of first year, 15 optional specialisations of four courses each, and a global requirement.", "anderson-academics"),
    ("Second year ends with a capstone: the consulting project (Applied Integrated Research, formerly Applied Management Research), the Business Creation capstone, or Advanced Topics capstones.", "anderson-academics"),
])
P.thing("academics.experiential", "Applied Integrated Research (formerly AMR)", "20-week team consulting capstone for a client; about one in four of the Class of 2026 chose it.", "anderson-academics", why=["consulting and strategy goals", "career switchers"], url="https://www.anderson.ucla.edu/degrees/full-time-mba/academics/capstone-projects")
P.thing("academics.experiential", "Business Creation Capstone", "Five-person teams build a venture over 20 weeks in year two; 100+ companies launched.", "anderson-academics", why=["founders"], url="https://www.anderson.ucla.edu/degrees/full-time-mba/academics/capstone-projects")
P.thing("academics.experiential", "Advanced Topics capstones", "Includes Advancing Health Tech Innovation, Tough Tech Commercialization, an A/B-testing project and a VC fund project.", "anderson-academics", why=["health tech and tech goals"], url="https://www.anderson.ucla.edu/degrees/full-time-mba/academics/capstone-projects")
for name, what, why in [
    ("Easton Technology Management Center", "Anderson's center for technology management and tech careers.", ["tech and product goals"]),
    ("Center for Healthcare Innovation", "Health care management and innovation at Anderson.", ["health care goals"]),
    ("Price Center for Entrepreneurship & Innovation", "Entrepreneurship programming including the Anderson Venture Accelerator.", ["founders"]),
    ("Center for Media, Entertainment & Sports", "Anderson's hub for the entertainment and sports industries.", ["entertainment and media goals"]),
    ("Ziman Institute for Real Estate and Urban Economics", "Real estate research and programs (formerly the Ziman Center).", ["real estate goals"]),
    ("Center for Global Management", "Global programs and immersions.", ["international goals"]),
    ("Morrison Center for Marketing and Data Analytics", "Marketing and analytics research and programs.", ["marketing analytics goals"]),
    ("Center for Impact", "Social and environmental impact programs.", ["impact goals"]),
]:
    P.thing("academics.centers", name, what, "anderson-academics", why=why, url="https://www.anderson.ucla.edu/degrees/full-time-mba/academics")
P.thing("academics.centers", "Parker Career Management Center", "Eight dedicated advisors, the Parker Career Series course, Anderson Career Teams of 90+ volunteer coaches, and PIER for international students; 98% secured a summer internship.", "anderson-academics", why=["career switchers", "international students"], url="https://www.anderson.ucla.edu/degrees/full-time-mba/career-impact")
P.todo.append("community.clubs: verify specific clubs on the official clubs page")

P.employment("anderson-careers", 2025, [
    ("Management Consulting", 0.239, None), ("Investment Banking", 0.133, None), ("Product Management", 0.089, None),
    ("Operations", 0.072, None), ("Product Marketing", 0.056, None), ("Corporate Finance", 0.05, None)],
    ["BCG", "Google", "Goldman Sachs", "Meta", "Nike", "ZS Associates", "Intuit", "LEK Consulting", "Warner Bros. Discovery", "J&J"])
P.add("careers.recruiting_notes", [
    ("Class of 2025 full-time by industry: technology 28.3%, consulting 25.6%, financial services 19.4%, entertainment/media 7.2%, healthcare 5.6%, consumer products 5.6%; full-time compensation shown as US$160K with a US$34K+ signing bonus.", "anderson-careers"),
    ("Anderson says over 86% switch industry, function or both, with an average 85% salary jump.", "anderson-careers"),
])
P.todo.append("careers.employment_report: median base by function and % employed at three months from the Class of 2025 PDF (too large to fetch)")
P.class_profile("anderson-profile", 2028, size=287, intl=0.36)

P.interview("anderson-req", "invite_only", ["student", "adcom"], True, 30, ["virtual", "campus"],
    questions=[("Walk me through your resume (in two minutes or less).", "anderson-req", 5), ("Why an MBA, and why now?", "anderson-req", 5),
               ("What are your short- and long-term career goals?", "anderson-req", 5), ("Why UCLA Anderson? How do you fit?", "anderson-req", 4),
               ("What do you do outside work?", "anderson-req", 3)],
    notes=[
        ("Invitation only, after review; required for admission; about 30 minutes on Zoom or in person, usually with trained second-year students; blind — the interviewer sees only the resume.", "anderson-req"),
        ("Anderson assesses communication, social skills and readiness, and says interviews are rarely the deciding factor. Business attire; photo ID is checked.", "anderson-req"),
    ])
P.ai("anderson-faq", "limited", ["essays"], notes=[
    ("Applicants may use tools to edit and proof for grammar, spelling and clarity, 'but the content, ideas, and writing style must be their own'. 'AI should not generate, rewrite, or significantly alter the essay's substance.'", "anderson-faq")])
P.todo.append("scholarships: Anderson fellowship process (no separate essay found)")
P.add("avoid", [
    ("Listing adjectives about yourself in the classmates essay without a past action behind them.", "al-anderson"),
    ("Using the optional essay as a bonus essay; Anderson says answering it carries no preference.", "anderson-req"),
    ("Goals without named target companies; the prompt asks for examples.", "anderson-req"),
    ("Braggy facts in the 50-word short answer.", "al-anderson"),
])
P.add("angles_that_work", [
    ("A switcher's goals essay with a clear bridge (transferable skill plus homework done) and Anderson resources such as the Easton center or a capstone tied to the new field.", "al-anderson"),
    ("A 'share success' contribution that repeats something the applicant has already built, such as a mentoring circle or interview-prep habit, at a named Anderson club.", "al-anderson"),
    ("Three pieces, three registers: goals in plain logic, the classmates essay warm and specific, the 50-word answer personal and light.", "admitstory-coach"),
])
P.term("AIR / AMR", "Applied Integrated Research, Anderson's consulting capstone (formerly Applied Management Research).", "anderson-academics")
P.term("Parker CMC", "Parker Career Management Center.", "anderson-academics")
P.write()
