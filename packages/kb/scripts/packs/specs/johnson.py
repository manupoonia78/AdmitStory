import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("cornell-johnson", "Cornell University SC Johnson Graduate School of Management", "Johnson", "US", "Ithaca, NY", "https://business.cornell.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are Admitstory rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
B = "https://business.cornell.edu/admissions/graduate/mba"
P.source("johnson-faq", "official", "Cornell MBA: Application requirements & FAQs (2026-2027 essay prompts, tests, waivers, Park essay)", B + "/application-guide/mba-application-requirements-faqs/")
P.source("johnson-guide", "official", "Cornell MBA: Admissions process & application guide (checklist, interviews, waitlist, scholarships, reapplicants)", B + "/application-guide/")
P.source("johnson-dates", "official", "Cornell MBA: Important dates (2026-27 rounds)", B + "/application-guide/important-dates/")
P.source("johnson-outcomes", "official", "Cornell MBA: Career outcomes, Class of 2025", B + "/career-outcomes/")
P.source("johnson-leadership", "official", "Cornell MBA: Our leadership framework (the 4Cs)", B + "/leadership/our-leadership-framework/")
P.source("johnson-immersions", "official", "Cornell MBA: Immersions & areas of focus", B + "/immersion-learning/")
P.source("ca-johnson-2027", "press", "Clear Admit: Cornell Johnson Two-Year MBA Class of 2027 profile (Sep 2025)", "https://www.clearadmit.com/2025/09/cornell-johnson-two-year-mba-class-of-2027-profile/")
P.source("al-johnson", "third_party_reference", "ApplicantLab — Cornell Johnson school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "Admitstory coaching canon and Manu's storytelling rules", None)

P.url("prompts", B + "/application-guide/mba-application-requirements-faqs/"); P.url("deadlines", B + "/application-guide/important-dates/")
P.url("employment_report", B + "/career-outcomes/")

P.round("Round 1", "2026-09-17", "johnson-dates", decision="2026-12-09", notes=[
    ("Due 11:59 pm Eastern. Initial notification (interview invitation or waitlist/deny without interview) 27 Oct 2026; deposit and official documents due 29 Jan 2027.", ["johnson-dates", "johnson-guide"]),
    ("Decisions are released on a rolling basis up to the final notification date; admits often get a phone call.", "johnson-guide"),
])
P.round("Consortium early", "2026-10-15", "johnson-dates", decision="2026-12-09")
P.round("Round 2", "2027-01-05", "johnson-dates", decision="2027-03-26", notes=[("Initial notification 3 Mar 2027; deposit 30 Apr 2027. The Consortium traditional deadline is the same day.", "johnson-dates")])
P.round("Round 3", "2027-04-06", "johnson-dates", decision="2027-05-21", notes=[("Initial notification 7 May 2027; deposit 4 Jun 2027.", "johnson-dates")])

P.goal("goals_fill_in",
    "Immediately post-MBA, my goal is to work as a(n) ____[Role]____ at ___[Company]___within___[Industry]___. In 5 – 10 years post-MBA, my goal is to work as a(n) ____[Role]____ at ___[Company]___within___[Industry]___.",
    ("words", 30), "johnson-faq", ["GOALBOX"],
    parts=["immediate role, company, industry", "5–10 year role, company, industry"],
    notes=[
        ("'A statement of your goals will begin a conversation that will last throughout the admissions process'; if invited to interview, expect to connect prior experience with these goals.", "johnson-faq"),
        ("A quick snapshot: Johnson is open to career switchers, but the switch should make sense at a glance.", "al-johnson"),
    ])
P.short("goals_leverage",
    "Please share how you plan to leverage your unique qualities and utilize the resources available to you at Johnson to transition to your immediate post-MBA career goal.",
    ("words", 350), "johnson-faq", ["GOALS", "WHY-SCHOOL"], verified=False,
    parts=["your unique qualities (relevant experience and skills)", "Johnson resources you'll use", "how they get you to the immediate goal"],
    notes=[
        ("'Unique' means the specific experience and knowledge a post-MBA employer would value, not astronaut-level distinction. Treat it as a rehearsal for the job hunt.", "al-johnson"),
        ("Open with the long-term hook, say what the immediate job must teach you (role and company are already in the blanks), then spend at least half the essay proving you can get hired: transferable skills, informational interviews, and the immersion, electives or club that fill the gap. A plan B role is fine.", "al-johnson"),
        ("Don't force a Johnson resource into every paragraph; showing you understand what the target job needs matters more.", "al-johnson"),
    ])
P.todo.append("application.short_answers.goals_leverage: the 350-word limit comes from coaching material; the FAQ doesn't state it. Confirm in the portal")
P.essay("impact",
    "Essay 1: At Cornell, our students and alumni share a desire to positively impact the organizations and communities they serve. How do you intend to make a meaningful impact on the Johnson community?",
    ("words", 350), "johnson-faq", ["CONTRIBUTION"], required=False,
    parts=["choose this or the Table of Contents", "the impact you will make on the Johnson community"],
    notes=[
        ("One of two required options (choose this or Table of Contents).", "johnson-faq"),
        ("Every contribution needs a past parallel: what you did for a community before, then the specific club role, event or study group you'll bring to Johnson. Name the student, alum or admissions officer whose conversation shaped the idea; Johnson expects that outreach.", "al-johnson"),
        ("Strongest contributions: professional clubs (especially helping classmates into your current field), then identity, service and fun clubs. Keep career talk to a quarter or a third at most.", "al-johnson"),
    ])
P.essay("table_of_contents",
    "Essay 2: Table of Contents essay. You are the author of your Life Story. Please create the table of contents for the book in the space provided or upload it as an attachment. We value creativity and authenticity and encourage you to approach this essay with your unique style. Alternative submission formats may include a slide presentation, links to pre-existing media (personal website, digital portfolio, YouTube, etc.), as well as visually enhanced written submissions.",
    ("words", 350), "johnson-faq", ["IDENTITY"], required=False,
    parts=["choose this or the Impact essay", "chapters of your life story", "format: written, slides, media link or visual"],
    notes=[
        ("Written versions up to 350 words; multimedia under 3 minutes; files up to 25 MB.", "johnson-faq"),
        ("A video in your own voice and face is the strongest format; then the impact essay if you have a strong community leadership story; a plain text list is the weakest. Don't build a website of clickable chapters.", "al-johnson"),
        ("Mix pivotal moments with charming, personal details, chronological or thematic; balance work with life and community; no bragging chapters. Slip in a hint of how you help others, since you're not writing the impact essay.", "al-johnson"),
        ("Each chapter title should carry a scene or a turn, not a label ('Chapter 4: Forgetting my lines, finding the debate team').", "admitstory-coach"),
    ])
P.optional("optional",
    "You may use this essay to call attention to items needing clarification and to add additional details to any aspects of your application that do not accurately reflect your potential for success at Johnson.",
    ("words", 350), "johnson-faq", ["OPTIONAL"], required=False,
    parts=["items needing clarification"],
    notes=[
        ("Applicants with a previous MBA should use it to explain why they want a second one.", "johnson-faq"),
        ("Brief, factual and mature; leave it blank if there's nothing to clarify.", "admitstory-coach"),
    ])
P.reapplicant(essay={"key": "reapplicant",
    "verbatim": "If you are reapplying for admission, please use this essay to indicate how you have strengthened your application and candidacy since the last time you applied for admission.",
    "limit": ("words", 350), "src": "johnson-faq", "archetypes": ["REAPPLICANT"],
    "parts": ["how you have strengthened your application and candidacy"],
    "notes": [("Show what changed and what it taught you, not a list; nothing carries over from the old application.", ["johnson-guide", "admitstory-coach"])]},
    policy=[("Reapplicants must write this essay and resubmit everything, including a new recommendation (it can be from the same person) and new scores if old ones expired.", "johnson-guide")])
P.recs("johnson-guide", 1, "school_specific", notes=[
    ("One professional letter of recommendation is required; a second is optional.", "johnson-guide"),
    ("Waitlisted candidates may send up to two additional letters to waitlist@johnson.cornell.edu.", "johnson-guide"),
])
P.todo.append("application.recommendations: confirm the recommender questions and whether Johnson uses the GMAC common letter")
P.resume("johnson-faq", 1, notes=[("Johnson wants 'a resume outlining notable professional accomplishments'; no page rule is published (1 is the default, not a Johnson rule).", "johnson-faq", 0.7)])
P.add("application.test_policy", [
    ("GMAT (including 10th Edition), GRE or Executive Assessment, valid five years; no minimum, and the highest total is evaluated. The middle 80% of applicants submit GMAT 660–740.", "johnson-faq"),
    ("Test waiver requests (with a 100-word statement on why you'll flourish academically) are considered for a STEM, business or quantitative degree with a 3.0 GPA or equivalent, or full-time analytical work shown on the resume; not guaranteed.", "johnson-faq"),
    ("If your score is an outlier, Johnson encourages a retake or switching test types.", "johnson-guide"),
])
P.add("application.fees_waivers", [
    ("Non-refundable US$250 fee. Apply to only one Johnson full-time MBA (Ithaca two-year or the one-year Johnson Cornell Tech MBA). No pre-assessments.", "johnson-guide"),
])

P.add("values.stated", [
    ("Johnson looks for a resume of notable accomplishments, 'thoughtful essays communicating your fit and potential contributions as a community member', competitive scores, 'the desire to make a positive impact', and 'the ability to clearly communicate their career goals and the role Johnson will play'.", "johnson-faq"),
    ("Leadership framework, the 4Cs: Character (values informing honest, fair decisions), Cognition (how you think through complex problems), Connection (respect and care for those you lead, so everyone belongs) and Courage (daring to do things differently and enact change).", "johnson-leadership"),
])
P.value("Character", ["principled_stands", "self_aware", "honest_about_limits"])
P.value("Cognition", ["analytical", "commercial_judgment"])
P.value("Connection", ["empathetic", "brings_people_along", "community_builder"])
P.value("Courage", ["acts_unasked", "originates_ideas"])
P.add("insider_notes", [
    ("Class of 2027 (Two-Year): 276 students; median GMAT 710; median GPA 3.4; 38% women; 42% international from 34 countries; 5.3 years' average experience; average age 29.", "ca-johnson-2027"),
    ("Engagement matters: talk to student ambassadors, club leaders or staff office hours before applying and use what you learn in the essays, since Johnson worries about yield.", "al-johnson"),
    ("Ways Johnson offers to engage: the Ask Admissions online series, MBA fairs, student ambassadors matched by immersion or interests, class visits in Ithaca, and Johnson Means Business, a weekend admissions event and symposium on campus.", "johnson-guide"),
    ("Waitlisted with a low GPA? Johnson suggests MBA Math or an accounting or finance course to show academic readiness.", "johnson-guide"),
    ("A waitlist means potential with areas to strengthen; waitlisted candidates can send an action plan, an updated resume and extra letters.", "johnson-guide"),
])
P.add("culture_and_location", [
    ("A tight-knit two-year program in Ithaca, NY, with a one-year Johnson Cornell Tech MBA in New York City.", ["johnson-guide", "al-johnson"], 0.8),
])
P.add("academics.structure", [
    ("The second semester of the two-year MBA is an immersion: semester-long, integrated learning centred on an industry or career path, with practitioner coaching, field trips, client projects and travel. Options include investment banking, consulting, digital technology and strategic operations.", "johnson-immersions"),
    ("Hundreds of electives across Cornell University can be added to the immersion.", "johnson-immersions"),
])
P.todo.append("academics: verify the full immersion list, leadership offerings and clubs (e.g. BR Venture Fund) from business.cornell.edu")

P.employment("johnson-outcomes", 2025, [
    ("Financial services", 0.41, 175000), ("Consulting", 0.28, 175000), ("Technology & Telecommunications", 0.11, 133700),
    ("Consumer Packaged Goods", 0.05, 126000), ("Healthcare/Pharma", 0.04, 137000), ("Manufacturing", 0.04, 135000), ("Energy/Utilities", 0.02, 150000)], [],
    intl=("Graduates without US work authorization: 77% had offers within three months (91% with authorization); average base US$154,963.", "johnson-outcomes"))
P.add("careers.recruiting_notes", [
    ("Class of 2025: of 285 graduates, 239 sought jobs; 85% had offers and 83% accepted within three months. Median base US$175,000 (average US$158,426); average signing bonus US$39,795. 95% work in North America.", "johnson-outcomes"),
    ("Johnson 'punches above its weight' in banking hiring; financial services takes over 40% of the class.", ["johnson-outcomes", "al-johnson"], 0.75),
])
P.class_profile("ca-johnson-2027", 2027, size=276, gmat=710, gpa=3.4, wexp=5.3, intl=0.42)
P.todo.append("class_profile: from a press summary; confirm on Johnson's class profile page")

P.interview("johnson-guide", "invite_only", ["adcom", "student"], None, 30, ["campus", "virtual"],
    questions=[
        ("Walk me through your goals statement: how does your experience lead to your immediate post-MBA goal?", "johnson-faq", 5),
        ("Tell me about a time you showed courage or did something differently. (4Cs)", "johnson-leadership", 3),
        ("How have you engaged with the Johnson community so far?", "al-johnson", 3),
    ],
    notes=[
        ("Required for admission; by invitation after a preliminary review. In Ithaca or on Zoom, with no preference; schedule within seven days of the invitation and finish by the round's completion deadline.", "johnson-guide"),
        ("Interviewers are the admissions team, MBA program staff or trained second-years in the Johnson Admissions Group (JAG); all interviews are weighted equally.", "johnson-guide"),
    ])
P.todo.append("interview: length and whether interviewers read the full file aren't published")
P.todo.append("ai_policy: no published Johnson generative-AI policy found")
P.add("scholarships", [
    ("All admits are considered for merit scholarships, regardless of citizenship, with no separate application; awards come with the offer. Partners: Consortium, Forté and ROMBA fellowships. Students without first-year funding shouldn't expect second-year aid.", "johnson-guide"),
    ("Roy H. Park Leadership Fellowship: full tuition for up to 25 US citizens or permanent residents per year. Candidates are invited after the interview to a virtual L.E.A.D. event and write a 500-word essay: 'Describe a past formal or informal leadership experience and how it informs your goals for growth as a leader. How would the Park Leadership Fellowship assist with these goals?'", "johnson-faq"),
    ("For the Park essay: show the leadership skill you built, say you want to keep growing that same skill, and name the Johnson offering that develops it; avoid citing an ethics class unless the story was about ethics.", "al-johnson"),
])
P.add("avoid", [
    ("A contribution with no past evidence behind it.", "al-johnson"),
    ("A Table of Contents of bragging chapter titles.", "al-johnson"),
    ("A switch that needs paragraphs to make sense in the fill-in-the-blank goals.", "al-johnson"),
    ("Assuming a campus visit helps your candidacy; it doesn't directly, though it helps you learn the culture.", "johnson-guide"),
])
P.add("angles_that_work", [
    ("A Table of Contents video in the applicant's own voice that mixes career turns with personal chapters and a hint of community help.", "al-johnson"),
    ("A goals essay that cites informational interviews and maps one immersion to the exact gap the target job reveals.", "al-johnson"),
])
P.term("Immersion", "Johnson's semester-long, career-focused learning experience in the second semester.", "johnson-immersions")
P.term("JAG", "Johnson Admissions Group: trained second-year students who conduct some interviews.", "johnson-guide")
P.term("4Cs", "Johnson's leadership framework: Character, Cognition, Connection, Courage.", "johnson-leadership")
P.term("L.E.A.D.", "Leadership Exploration and Assessment Day, the virtual event for Park Fellowship candidates.", "johnson-faq")
P.write()
