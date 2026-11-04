import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("northwestern-kellogg", "Northwestern University Kellogg School of Management", "Kellogg", "US", "Evanston, IL", "https://www.kellogg.northwestern.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
K = "https://www.kellogg.northwestern.edu"
P.source("kellogg-apply", "official", "Kellogg: How to apply to a Full-Time MBA (essays, video essays, recommendations, tests, fee, interview)", K + "/admissions/ft-admissions/ft-how-to-apply/")
P.source("kellogg-admissions", "official", "Kellogg: Full-Time MBA admissions (deadlines, what we look for)", K + "/admissions/ft-admissions/")
P.source("kellogg-live-2026", "official", "Kellogg blog: Full-Time MBA application is now live — here's what's new (Jun 10, 2026)", K + "/news/blog/2026/06/10/full-time-mba-application-live/")
P.source("kellogg-tips-2026", "adcom", "Kellogg blog: Top 5 tips when applying to Kellogg (Jul 16, 2026)", K + "/news/blog/2026/07/16/application-tips/")
P.source("kellogg-profile", "official", "Kellogg: Class profile, Class of 2027 (Two-Year MBA)", K + "/programs/full-time-mba/class-profile/")
P.source("kellogg-outcomes", "official", "Kellogg: Full-Time MBA career outcomes, Class of 2025 (Two-Year MBA)", K + "/programs/full-time-mba/career-services/career-outcomes/")
P.source("kellogg-academics", "official", "Kellogg: Full-Time MBA academics", K + "/programs/full-time-mba/academics/")
P.source("kellogg-portal", "official", "Kellogg online application (applicant portal; not read)", "https://admissions.kellogg.northwestern.edu/apply", read=False)
P.source("sb-kellogg-2026", "press", "Stacy Blackman: Kellogg MBA essays for the Class of 2029 (2026-27), quoting the application", "https://www.stacyblackman.com/blog/northwestern-kellogg-mba-essays/")
P.source("pq-ai-2026", "press", "Poets&Quants (Fortuna, May 26, 2026): AI policies at top MBA programs, quoting each school's application materials", "https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/")
P.source("aringo-kellogg-2026", "press", "Aringo: 5 videos, 1 essay — the Kellogg MBA application 2026-2027", "https://aringo.com/5-videos-1-essay-the-new-rules-of-the-northwestern-kellogg-mba-application-2026-2027/")
P.source("al-kellogg", "third_party_reference", "ApplicantLab — Kellogg school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", K + "/admissions/ft-admissions/ft-how-to-apply/"); P.url("deadlines", K + "/admissions/ft-admissions/")
P.url("class_profile", K + "/programs/full-time-mba/class-profile/"); P.url("employment_report", K + "/programs/full-time-mba/career-services/career-outcomes/")

P.round("Round 1", "2026-09-09", "kellogg-admissions", decision="2026-12-09", notes=[
    ("Video essays are due 96 hours after the round deadline.", "kellogg-apply"),
    ("Deadlines are reported as 5:00 pm Central.", "aringo-kellogg-2026", 0.7),
])
P.round("Round 2", "2027-01-06", "kellogg-admissions", decision="2027-03-24")
P.round("Round 3", "2027-03-31", "kellogg-admissions", decision="2027-05-12")

P.essay("pivotal_and_contribution",
    "Part I: An MBA is a significant investment of time, energy and resources, and the decision to pursue one deserves serious reflection. Tell us about the pivotal experiences and decisions that have brought you to this moment in your career, how they have shaped your ambitions, and why now is the right time to take this next step. Part II: Now turn the lens outward: beyond what you hope to gain, what do you hope to contribute to the students who will learn alongside you?",
    ("words", 550), "kellogg-apply", ["GOALS", "LEADERSHIP", "CONTRIBUTION"],
    parts=["pivotal experiences and decisions that brought you here", "how they shaped your ambitions", "why now", "what you will contribute to classmates"],
    notes=[
        ("New for 2026-27: one written essay for all programs plus five 60-second video essays, 'a more focused' application meant for 'authentic, in-the-moment reflection'.", "kellogg-live-2026"),
        ("Kellogg's own framing: 'The written and video essays are your chance to tell us your story and why Kellogg is the right next chapter for you.' Admissions wants 'moments that highlight your leadership, resilience and growth'.", ["kellogg-apply", "kellogg-tips-2026"]),
        ("Part I: tell the career vision through a development-as-a-leader arc: one or two pivotal decisions (ideally a short leadership story with Kellogg traits: brave, collaborative, proactive, empathetic) that show why growing further now needs an MBA. Not a chronological resume recap.", ["al-kellogg", "aringo-kellogg-2026"]),
        ("Part II is the part nothing else in the file can carry: one specific, evidence-backed contribution (a club initiative, trek, practicum, or something you'd start), built from what you've done before and researched with current students. Not a club list, not 'my warm nature'.", ["al-kellogg", "admitstory-coach"]),
        ("Kellogg prizes a student-driven, flexible culture: combining two or three majors or an unusual pathway reads as eagerness here, not as being scattered.", "al-kellogg"),
        ("When naming courses, pick offerings that set Kellogg apart from the schools it fears you prefer (often Booth, or the top school in your field): one function course for the first job and one leadership or general-management course or experiential lab for later.", "al-kellogg"),
        ("Roughly half the words each way works; answer both parts explicitly and keep context under 15% of the count.", ["aringo-kellogg-2026", "admitstory-coach"]),
    ])
P.optional("additional_information",
    "We know that life is full of extenuating circumstances. Whether you want to explain gaps in work experience, your choice of recommenders, inconsistent or questionable academic performance or something else, you can use this section to briefly tell us anything we need to know about your application.",
    ("words", 280), "sb-kellogg-2026", ["OPTIONAL"], required=False,
    parts=["extenuating circumstances only"],
    notes=[
        ("Brief, factual and mature; a 'silver lining' only if it's real. For a weak score: point to other evidence of ability at peer level. For a non-supervisor recommender: why, and why this person can judge your leadership.", "al-kellogg"),
        ("Kellogg wants one letter from a current supervisor, so a different choice needs a sentence here.", "kellogg-apply"),
    ])
P.form("career_goals_boxes", "Career plan text boxes: short-term and five-years-out goals (about 500 characters each)", "kellogg-portal", limit_kind="chars_incl_spaces", char_limit=500, guidance=[
    ("Draft the full career rationale first, then pull out the boxes: a plan A and plan B short-term role, the function electives, and the long-term or leadership courses. That frees essay space for the leadership story and contribution.", "al-kellogg"),
    ("For the short-term role, choose a field or employer that hires Kellogg graduates (check the employment report) or ask a professional club whether people with your background land it.", "al-kellogg"),
])
P.todo.append("application.form_sections.career_goals_boxes: two 500-character career boxes existed in earlier cycles; a 2026-27 guide says career content now lives in the one essay. Confirm in the portal or delete")
P.reapplicant(essay={"key": "reapplicant",
    "verbatim": "How have you grown or changed personally and professionally since you previously applied and what steps have you taken to become the strongest candidate you can be?",
    "limit": ("words", 250), "src": "kellogg-apply", "archetypes": ["REAPPLICANT"],
    "parts": ["personal and professional growth since applying", "steps taken to strengthen the candidacy"],
    "notes": [("With only 250 words, put the strongest new story in the main essay and refer to it here, adding one or two new examples and saying plainly why they make you stronger.", "al-kellogg")]},
    policy=[("Reapplicants answer the growth prompt in addition to the main essay.", "kellogg-apply")])
P.video("kellogg-apply", "async_video", answer=60, attempts=1, scripting=False, qtypes=[
    ("Five questions, each with a brief moment to think and up to one minute to answer; no re-dos. The link appears on the Application Status Page after you submit and pay; due 96 hours after the round deadline; about 30 minutes including setup; computer with webcam and microphone. Unlimited practice questions.", "kellogg-apply"),
    ("'We've read your essays, we've read your resume — now we want you to bring all that to life in a video. Show us the person behind all those carefully crafted words.'", "kellogg-apply"),
    ("Reported categories: an icebreaker beyond the resume, why Kellogg or a pathway, teamwork or conflict, failure or resilience, values or community impact. About 20 seconds to think.", "aringo-kellogg-2026", 0.7),
    ("Past cycles mixed 'introduce yourself', behavioural leadership or teamwork questions, and a why-Kellogg/career question; prepare all of them rather than guessing.", "al-kellogg"),
    ("Prepare six flexible stories, not scripts: leadership, failure, impact, risk, teamwork, and a hobby. Look at the lens; if you stumble, recover calmly and finish.", ["aringo-kellogg-2026", "admitstory-coach"]),
])
P.todo.append("application.video[0].think_time_s: 'a brief moment' officially; about 20 seconds per one guide")
P.recs("kellogg-apply", 2, "school_specific", questions=[
    ("Share an example of how the candidate has engaged with colleagues, clients, or stakeholders who held perspectives different from their own. How did they navigate the situation, and what does this demonstrate about their ability to lead or collaborate in complex environments?", "words", 300),
    ("How does the candidate's performance compare to those of other well-qualified individuals in similar roles? Please provide specific examples.", "words", 300),
    ("Describe the most important piece of constructive feedback you have given the candidate. Please detail the circumstances and the applicant's response.", "words", 250),
], notes=[
    ("Ideally one from a current supervisor; the second from someone who can evaluate your performance and managerial or leadership potential (former supervisor, previous employer, client). Additional letters are 'neither required nor encouraged'.", "kellogg-apply"),
    ("The Kellogg-specific question means each recommender needs a different story of you working across differing perspectives; brief both early so they don't overlap.", ["al-kellogg", "admitstory-coach"]),
])
P.resume("kellogg-apply", 2, notes=[
    ("No required format or length; like a job-application resume but written for a general audience, so a reader can quickly understand your background and accomplishments. A separate employment section asks for transitions and promotions; keep it consistent with the resume.", "kellogg-apply"),
    ("'Your resume should highlight your impact and leadership.'", "kellogg-tips-2026"),
])
P.add("application.test_policy", [
    ("GMAT or GRE required, from a single sitting (no superscores); no preference and no minimum. Valid five years.", "kellogg-apply"),
    ("Non-native English speakers may need TOEFL, IELTS or the Duolingo English Test.", "kellogg-apply"),
    ("Without calculus and statistics, Kellogg encourages introductory courses before enrolling.", "kellogg-apply"),
])
P.add("application.fees_waivers", [
    ("Application fee US$250. Waivers for active-duty US military and veterans, and for Teach For America, Title 1 schools, AmeriCorps or Peace Corps employees within the past three years.", "kellogg-apply"),
    ("One full-time Kellogg program per year; after submitting you may name one alternate full-time program and/or the Evening & Weekend MBA, with a short paragraph on why.", "kellogg-apply"),
])

P.add("values.stated", [
    ("'Are you an empathetic collaborator who can bring everyone to the table? Are you an innovator with a clear vision and entrepreneurial spirit?'", "kellogg-admissions"),
    ("Kellogg looks for 'the ability to push past comfort zones and question the norm', and people 'who are not afraid to question the status quo, can motivate a team to drive impact, and are eager to dive in and collaborate'.", "kellogg-apply"),
    ("Kellogg aims for 'a special combination of analytical, creative and social intelligence' in each student; collaboration and community are 'at the heart of everything we do'.", "kellogg-tips-2026"),
])
P.value("question the status quo; push past comfort zones (brave)", ["principled_stands", "originates_ideas", "acts_unasked"])
P.value("empathetic collaborator who brings everyone to the table", ["empathetic", "brings_people_along"], ("The recommendation question on differing perspectives shows how much Kellogg weighs this; show it in an essay and a video answer too.", "kellogg-apply"))
P.value("motivate a team to drive impact (high impact, low ego)", ["brings_people_along", "measurable_impact"])
P.value("eager to dive in; community", ["community_builder", "curious_learner"])
P.add("insider_notes", [
    ("Class of 2027 (Two-Year MBA): 534 students; average GPA 3.68 (range 2.7–4.0); average GMAT Focus 687, legacy GMAT 733; 37% international; 9% US veterans; 5.1 years' average experience.", "kellogg-profile"),
    ("Kellogg recommends at least two years of full-time work experience at matriculation.", "kellogg-apply"),
    ("Admissions: 'think of each section like a puzzle piece'; be genuine, avoid generic responses, 'there are no right or wrong answers'.", "kellogg-tips-2026"),
    ("Updates (new job, grades, scores) can be added after submitting on the supplemental information page.", "kellogg-apply"),
])
P.add("culture_and_location", [
    ("A collaborative, student-driven culture ('curiosity, warmth and collaborative spirit') in Evanston, just north of Chicago, in the Global Hub building on Lake Michigan.", ["kellogg-live-2026", "al-kellogg"], 0.75),
])
P.add("academics.structure", [
    ("Six full-time programs: One-Year (skips the core; needs prior business study), Two-Year, MBAi (with McCormick engineering, business plus AI), MMM (MBA plus MS in Design Innovation), JD-MBA and MD-MBA.", ["kellogg-live-2026", "kellogg-apply"]),
    ("A general-management philosophy with more than 200 electives on top of the core.", "kellogg-academics"),
    ("Students often take two or three majors and follow pathways (unofficial elective roadmaps across majors); Managing Organizations is a flexible second major for almost any plan. Independent studies with faculty are possible.", "al-kellogg", 0.7),
])
P.thing("academics.experiential", "Global Initiatives in Management (GIM)", "A student-started course combining classroom study with an international research trip; one of Kellogg's signature global offerings.", "al-kellogg", why=["international goals", "evidence Kellogg acts on student ideas"])
P.thing("academics.experiential", "Experiential labs and practicums", "Hands-on courses where students work on live company problems; Kellogg lists experiential learning prominently.", "al-kellogg", why=["career switchers", "a 'learning by doing' contribution"])
P.todo.append("academics: verify current majors, pathways, labs and GIM details on the Kellogg site (the academics page didn't render them)")
P.todo.append("community.clubs: verify specific Kellogg clubs and conferences")

P.employment("kellogg-outcomes", 2025, [
    ("Consulting", 0.38, 190000), ("Financial Services", 0.21, 175000), ("Technology", 0.19, 151500),
    ("Consumer Packaged Goods", 0.09, 128000), ("Healthcare", 0.06, 142500), ("Manufacturing", 0.03, 159500)],
    ["McKinsey & Company", "Bain & Company", "Boston Consulting Group", "PwC Strategy&", "Deloitte Consulting", "Accenture Strategy", "J.P. Morgan", "KKR", "Warburg Pincus", "Evercore"])
P.add("careers.recruiting_notes", [
    ("Class of 2025 (Two-Year): median total compensation US$205,000, median base US$175,000, median signing bonus US$30,000; 90% accepted an offer within six months; a record 20 graduates launched ventures, including search funds.", "kellogg-outcomes"),
    ("Top target industries of the Class of 2027: consulting, financial services, technology, healthcare/biopharma and consumer products.", "kellogg-profile"),
])
P.class_profile("kellogg-profile", 2027, size=534, gmat_focus=687, gmat=733, gpa=3.68, wexp=5.1, intl=0.37)
P.todo.append("class_profile: Kellogg publishes averages, not medians")

P.interview("kellogg-apply", "invite_only", ["alum", "student", "adcom"], None, 45, ["virtual"],
    questions=[
        ("Walk me through your background.", "kellogg-tips-2026", 4),
        ("What are your career goals, and why is Kellogg the right fit?", "kellogg-tips-2026", 5),
        ("Tell me about a time you led a team or a project. (STAR)", "kellogg-tips-2026", 4),
        ("Tell me about working with someone whose perspective differed from yours.", "kellogg-apply", 3),
    ],
    notes=[
        ("All interviews are virtual; invitations go out on a rolling basis until decision release, and timing says nothing about your status. Scheduled times can't be changed.", "kellogg-apply"),
        ("The interview evaluates 'interpersonal and communication skills, career focus and motivations for pursuing a Kellogg MBA'.", "kellogg-apply"),
        ("Admissions' tips: one-on-one with a member of the Kellogg community; use STAR stories; be ready for career goals and why Kellogg; 'be yourself… demonstrate how you engage as a peer and learner'.", "kellogg-tips-2026"),
        ("Keep answers consistent with the essay and videos, and bring a specific contribution idea and a question that shows you've talked to students.", "admitstory-coach"),
    ])
P.todo.append("interview: confirm who interviews (alumni, second-year students, admissions), whether interviewers see more than the resume, and typical length")
P.ai("pq-ai-2026", "permitted_with_disclosure", ["essays"],
    disclosure="Cite the use of generative AI by referencing the tool at the conclusion of the essay (Name of Tool, URL).",
    notes=[
        ("Kellogg's application: 'Generative AI can be a powerful aid in crafting an essay, but it should be used as a supplementary tool rather than a replacement for your own effort and creativity.'", "pq-ai-2026"),
        ("The move to five unscripted videos is widely read as a check on AI-polished writing; the voice in the essay must match the voice on camera.", ["aringo-kellogg-2026", "admitstory-coach"], 0.7),
    ])
P.todo.append("ai_policy: confirm the statement in the live portal")
P.add("avoid", [
    ("A chronological resume recap in Part I.", "aringo-kellogg-2026"),
    ("A club list or vague personality claim in Part II.", ["al-kellogg", "admitstory-coach"]),
    ("Scripted, memorised video answers; Kellogg wants 'the person behind all those carefully crafted words'.", "kellogg-apply"),
    ("Extra recommendation letters.", "kellogg-apply"),
    ("Generic responses.", "kellogg-tips-2026"),
])
P.add("angles_that_work", [
    ("Part I built on one pivotal decision where the applicant questioned the norm and brought a team along, leading naturally to why now.", ["kellogg-apply", "al-kellogg"]),
    ("Part II naming one concrete thing the applicant would start or run for classmates, drawn from something they've already built.", "al-kellogg"),
    ("A video set showing warmth and humour that the essay couldn't.", "kellogg-apply"),
])
P.term("Global Hub", "Kellogg's main building on the Evanston lakefront.", "al-kellogg")
P.term("MBAi", "Kellogg's full-time MBA run with Northwestern's McCormick School of Engineering, focused on business and AI.", "kellogg-live-2026")
P.term("MMM", "Kellogg's dual degree: MBA plus an MS in Design Innovation from the Segal Design Institute.", "kellogg-live-2026")
P.write()
