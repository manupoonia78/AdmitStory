import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("harvard-business-school", "Harvard Business School", "HBS", "US", "Boston, MA", "https://www.hbs.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
H = "https://www.hbs.edu/mba/admissions"
P.source("hbs-process", "official", "HBS MBA: Application process (essays, recommendations, resume, tests, interview, post-interview reflection, FAQs)", H + "/application-process")
P.source("hbs-dates", "official", "HBS MBA: Application dates (Class of 2029)", H + "/application-dates")
P.source("hbs-who", "official", "HBS MBA: Who are we looking for? (business-minded, leadership-focused, growth-oriented)", H + "/who-are-we-looking-for")
P.source("hbs-profile", "official", "HBS MBA: Class profile (Class of 2027)", H + "/class-profile")
P.source("hbs-portal", "official", "HBS online application (applicant portal; not read)", "https://apply.hbs.edu/apply/", read=False)
P.source("ca-hbs-2025", "press", "Clear Admit: HBS MBA Class of 2025 employment report (Dec 1, 2025)", "https://www.clearadmit.com/2025/12/hbs-mba-class-of-2025-employment-report/")
P.source("pq-ai-2026", "press", "Poets&Quants (Fortuna, May 26, 2026): AI policies at top MBA programs, quoting each school's application materials", "https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/")
P.source("al-hbs", "third_party_reference", "ApplicantLab — HBS school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", H + "/application-process"); P.url("deadlines", H + "/application-dates")
P.url("class_profile", H + "/class-profile")

P.round("Round 1", "2026-09-09", "hbs-dates", decision="2026-12-10", notes=[
    ("Submit by 12:00 pm ET. Applications received after the Round 1 deadline are considered in Round 2; one application per year.", "hbs-dates"),
    ("Interview invitations come about four to six weeks after the deadline; the process takes about three months from deadline to decision.", "hbs-process"),
])
P.round("Round 2", "2027-01-05", "hbs-dates", decision="2027-03-25", notes=[("Submit by 12:00 pm ET. Applications after the Round 2 deadline are not considered (there is no Round 3).", "hbs-dates")])
P.round("2+2 Round", "2027-04-28", "hbs-dates", decision="2027-06-30", notes=[("For college seniors and full-time master's students graduating between 1 Oct 2026 and 30 Sep 2027; reduced US$100 fee.", "hbs-process")])

P.essay("business_minded",
    "Business-Minded Essay: Please reflect on how your choices have influenced your career path and aspirations.",
    ("words", 300), "hbs-process", ["GOALS", "IDENTITY"],
    parts=["the choices you made", "how they shaped your career path", "your aspirations"],
    notes=[
        ("HBS on business-minded: 'passionate about using business as a force for good'; in the application they look for 'interpersonal skills, quantitative abilities, and the ways in which you plan to create impact through business in the future'.", "hbs-who"),
        ("A narrated resume fails here. Fill the employment boxes and the short career-aspirations field first so they carry the facts and the plan, then spend the essay on one or two real choices: a risky decision, the reasoning behind it, the person you had to convince.", "al-hbs"),
        ("The future is the least interesting part; keep aspirations short and let past choices show judgment and values.", "al-hbs"),
        ("No 'why HBS': flattery wastes words at a school that knows its appeal. Every word should sell you.", "al-hbs"),
        ("You may write under the limit but not over it.", "hbs-process"),
    ])
P.essay("leadership_focused",
    "Leadership-Focused Essay: What experiences have shaped how you invest in others and how you lead?",
    ("words", 250), "hbs-process", ["LEADERSHIP", "SUPPORT"],
    parts=["experiences that shaped you", "how you invest in others", "how you lead (present tense)"],
    notes=[
        ("HBS on leadership-focused: you don't need a formal role; they build a class of 'different kinds of leaders, from the front-line manager to the startup founder to the behind-the-scenes thought leader', and leadership 'may be most evident in extracurriculars, community initiatives, or your professional work'.", "hbs-who"),
        ("Spend most words on how you invest in others, not on the shaping experience: readers recognise the familiar shapers (a coach, a hard childhood, a bad boss) quickly. What sets you apart is what you did with it.", "al-hbs"),
        ("A backstory alone isn't the point; the outsized leadership impact it propelled is. Misjudging how hard your story was reads as low self-awareness.", "al-hbs"),
        ("'Community' can be broad: first-generation colleagues, a struggling teammate, a support group. If you use a work story, make sure part of it shows you investing in someone.", "al-hbs"),
        ("Dramatise rather than label: show the moment you chose to help and what it cost you, then the lesson in one plain line.", "admitstory-coach"),
    ])
P.essay("growth_oriented",
    "Growth-Oriented Essay: Curiosity can be seen in many ways. Please share an example of how you have demonstrated curiosity and how that has influenced your growth.",
    ("words", 250), "hbs-process", ["IDENTITY", "SETBACK"],
    parts=["one example of curiosity", "how it influenced your growth"],
    notes=[
        ("HBS on growth-oriented: people who 'broaden their perspectives through creative problem solving, active listening, and lively discussion'; the case method depends on 'curious students who are excited to listen and learn'. They look for 'the ways in which you have grown, developed, and how you engage with the world'.", "hbs-who"),
        ("Not a brain-size essay: scores and transcripts show intelligence. Show curiosity that went beyond the expected: taking another person's view seriously (the heart of the case method), looking somewhere unexpected, or persuading someone to share what you needed.", "al-hbs"),
        ("Curiosity about a person's motives (why a colleague resisted a change) can turn into a leadership story; the growth can be one line plus a brief later example.", "al-hbs"),
        ("Strongest move: reverse-engineer a curiosity angle into one of your best leadership stories, ideally where you changed your mind because of someone else's insight.", "al-hbs"),
    ])
P.form("career_aspirations", "Career aspirations (short text field, about 500 characters)", "hbs-portal", limit_kind="chars_incl_spaces", char_limit=500, guidance=[
    ("Use it for the plain plan (target role, industry, the impact you want) so the business-minded essay can tell a story instead of restating goals.", "al-hbs"),
])
P.form("employment", "Employment section (job descriptions, accomplishments, challenges, reasons for leaving)", "hbs-portal", guidance=[
    ("The most important form section: interviewers draw on it. Pack in motivations, results, a challenge overcome and investing in others, so the essays don't have to carry everything. Leave 'reason for leaving' blank or N/A for the current job.", "al-hbs"),
    ("Entrepreneurial or self-employed roles are welcome; tell HBS about the company here, on the resume or through recommenders. Employment gaps of two months or more can be explained in the resume section.", "hbs-process"),
])
P.todo.append("application.form_sections: confirm the career-aspirations field and its limit in the 2026-27 portal")
P.optional("additional_information",
    "Please enter important information that you want the Board to know in the Additional Information section of the application.",
    ("words", 75), "hbs-portal", ["OPTIONAL"], required=False, verified=False,
    parts=["special circumstances only"],
    notes=[
        ("HBS: use the Additional Information section for important information, including special circumstances.", "hbs-process"),
        ("Short, factual, mature; never a fourth essay.", ["al-hbs", "admitstory-coach"]),
    ])
P.todo.append("application.optional_essay: the 75-word limit comes from coaching material; confirm in the portal")
P.reapplicant(essay={"key": "reapplicant",
    "verbatim": "Please use this space to share with the Admissions Committee how you have reflected and grown since your previous application and discuss any relevant updates to your candidacy (e.g., changes in your professional life, additional coursework, and extracurricular/volunteer engagements).",
    "limit": ("words", 250), "src": "hbs-portal", "archetypes": ["REAPPLICANT"], "verified": False,
    "parts": ["reflection and growth", "professional, academic and extracurricular updates"],
    "notes": [
        ("A quick 'delta' between then and now, not a hidden extra leadership essay: what the new scope taught you, any refined career thinking with the homework behind it, academic updates in a line, continued (not newly started) volunteering.", "al-hbs"),
    ]},
    policy=[
        ("HBS is 'reapplicant friendly': about 10% of a class previously applied; reapplying 'often signals genuine commitment'. The Board can see prior materials but focuses on the current application, which must be complete; scores must still be valid.", "hbs-process"),
    ])
P.todo.append("application.reapplicant.essay: prompt wording and limit come from coaching material; confirm in the portal")
P.recs("hbs-process", 2, "school_specific", questions=[
    ("Please provide specific examples of how the applicant's performance, potential, background, or personal qualities compare to those of other well-qualified individuals in similar roles.", "words", 300),
    ("Please describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.", "words", 250),
], notes=[
    ("Recommenders also fill in a personal qualities and skills grid. One should ideally be a current or recent supervisor, but HBS won't have you jeopardise your job: 'How well a person knows you should take priority over level of seniority or HBS alumni status.'", "hbs-process"),
    ("Recommenders submit separately by the round deadline; don't wait for them before submitting.", "hbs-process"),
])
P.resume("hbs-process", 1, notes=[("'This can be your standard business resume or CV'; no format preference. HBS recommends at least two years of full-time work before enrolling.", "hbs-process")])
P.todo.append("application.resume.page_limit: HBS states no limit; 1 is the conventional default, not an HBS rule")
P.add("application.test_policy", [
    ("GRE or GMAT (including GMAT Focus/10th Edition) required, no waivers 'under any circumstances'; no minimum, no preference. Scores must be dated between 9 Sep 2021 and 9 Sep 2026 for Round 1, or 5 Jan 2022 and 5 Jan 2027 for Round 2. Unofficial scores can be self-reported at submission.", "hbs-process"),
    ("TOEFL iBT, IELTS, PTE or Duolingo required without an English-only undergraduate degree; HBS discourages applying below TOEFL 5 (new scale) or 109, IELTS 7.5, PTE 75, Duolingo 145.", "hbs-process"),
])
P.add("application.fees_waivers", [
    ("US$250 fee (US$100 for 2+2); waived for active-duty military; need-based waivers by request after starting an application.", "hbs-process"),
    ("HBS says you don't need a paid consultant and runs Application Help Sessions for applicants (sign-up in the portal).", "hbs-process"),
])

P.add("values.stated", [
    ("'Our students are: business-minded, leadership-focused, and growth-oriented.' A class of 900+ students 'who bring as many different experiences and perspectives as possible'.", "hbs-who"),
    ("Leadership-focused: people 'who aspire to lead others toward making a difference in the world' and who recognise they 'must develop and nurture diverse teams'.", "hbs-who"),
])
P.value("business-minded: business as a force for good", ["commercial_judgment", "analytical", "measurable_impact"])
P.value("leadership-focused: develop and nurture teams", ["brings_people_along", "develops_people"], ("Investing in others is the emphasis: show someone you developed, not just a team you ran.", "al-hbs"))
P.value("growth-oriented: listening, discussion, broadened perspectives", ["curious_learner", "acts_on_feedback", "self_aware"])
P.add("insider_notes", [
    ("Class of 2027: 943 students from 9,409 applications (2024-25); average GPA 3.76; average 4.9 years' experience (middle 80% 3–7); 44% women; 37% international; 62 countries; 283 universities; 10% first-generation.", "hbs-profile"),
    ("44% of the Class of 2027 submitted the GRE, 34% the GMAT and 28% the GMAT 10th Edition.", "hbs-profile"),
    ("Persuasion stories land especially well at HBS (its teaching is built on discussion): an insight into what a sceptic cared about, used to win them over.", "al-hbs"),
    ("The 'story behind the bullet point': never retell what the resume says or what any MBA reader would assume (analysis, a pitch, status meetings). Tell the hidden obstacle and the interpersonal move that overcame it.", "al-hbs"),
    ("Readers are trained admissions staff who often stay for years, not students.", "al-hbs", 0.65),
])
P.add("culture_and_location", [
    ("A residential campus in Boston across the river from Cambridge; Boston is a major US start-up hub. Daily case discussion in sections is the core experience.", "hbs-process"),
])
P.add("academics.structure", [
    ("Case method: read a 10–20 page case ending in a decision, discuss it in a morning discussion group, then debate in class, where students do most of the talking.", "hbs-process"),
    ("Required Curriculum includes Finance 1, Leadership & Organizational Behavior, Leadership & Corporate Accountability, and Data Science & AI for Leaders.", "hbs-process"),
    ("Joint degrees with Harvard Medical, Dental, Law and Kennedy schools; MS/MBA Biotechnology: Life Sciences and MS/MBA Engineering Sciences apply through the HBS application with an extra essay.", "hbs-process"),
])
P.todo.append("academics.experiential and community.clubs: verify FIELD, electives and clubs from hbs.edu")

P.employment("ca-hbs-2025", 2025, [
    ("Financial Services", 0.34, None), ("Technology", 0.22, None), ("Consulting", 0.21, 190000), ("Health Care", 0.06, None), ("Manufacturing", 0.05, None)], [])
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$184,500; 58% received a signing bonus (median US$30,000). Of the 65% seeking jobs, 90% had an offer within three months; 35% didn't seek employment (17% of them started a business).", "ca-hbs-2025"),
    ("Financial services 34% (private equity 14%, investment management 7%, investment banking 6%, VC 4%); 92% stayed in the US, mostly the Northeast (48%) and West (24%).", "ca-hbs-2025"),
])
P.todo.append("careers.employment_report: replace the press summary with HBS's own recruiting data page and add top employers")
P.class_profile("hbs-profile", 2027, size=943, gpa=3.76, wexp=4.9, intl=0.37)
P.todo.append("class_profile: HBS no longer shows GMAT/GRE medians on the profile page; GPA and experience are averages")

P.interview("hbs-process", "invite_only", ["adcom"], False, 30, ["campus", "hub", "virtual"],
    questions=[
        ("Questions built from your own application, especially the employment section and essays.", "al-hbs", 5),
        ("Walk me through a decision you made and why.", "admitstory-coach", 3),
    ],
    notes=[
        ("30 minutes with an MBA Admissions Board member who has reviewed your application; 'tailored to you'. By invitation only; on campus, in hub cities or on Zoom; timing and format imply nothing.", "hbs-process"),
        ("Within 24 hours of the interview, submit the required Post-Interview Reflection through the application system; instructions go to interviewees.", "hbs-process"),
        ("Know every line of your file; the interviewer will probe the form boxes as much as the essays. A second person may take notes.", "al-hbs", 0.7),
        ("For the reflection, add something new the interview didn't reach and show self-awareness about the conversation, rather than a thank-you note or a polished essay.", "admitstory-coach", 0.7),
    ])
P.ai("pq-ai-2026", "permitted_with_disclosure", ["essays"],
    disclosure="If 'yes' to using AI: 'In accordance with HBS student policy, you must cite your sources. Please indicate below in what manner you have utilized AI in completing this application, and in which sections.' (75 words max)",
    notes=[
        ("HBS application: 'the use of AI is permitted; however, you should not claim AI output as your own independent work, and you should always verify the quality of concepts and content that you develop through the use of generative AI tools.'", "pq-ai-2026"),
    ])
P.todo.append("ai_policy: confirm the AI question in the live portal")
P.add("scholarships", [
    ("Need-based: about 50% of students receive HBS scholarships, averaging about US$100k over two years; 10% receive full-tuition scholarships. Awards assume you'll take a loan.", ["hbs-profile", "hbs-process"]),
    ("Named fellowships include Forward (lower-income backgrounds), RISE (under-resourced communities), Goldsmith (nonprofit leadership), Junior Achievement and the McArthur Canadian Fellowship.", "hbs-process", 0.8),
])
P.add("avoid", [
    ("A narrated resume in the business-minded essay.", "al-hbs"),
    ("Any 'why HBS' praise (case method, faculty, classmates).", "al-hbs"),
    ("Bragging about intelligence, especially in the curiosity essay.", "al-hbs"),
    ("Over-telling a hard backstory without the leadership impact it led to.", "al-hbs"),
    ("Peer recommenders; HBS discourages them.", "hbs-process"),
])
P.add("angles_that_work", [
    ("A choice story where the applicant took a risk against advice and explains the reasoning, with goals kept to a sentence.", "al-hbs"),
    ("A leadership essay centred on developing one specific person, with the shaping experience in two lines.", "al-hbs"),
    ("A curiosity essay where the applicant changed their mind because of someone else's insight and led better for it.", "al-hbs"),
])
P.term("Admissions Board", "HBS's admissions committee; Board members conduct the interviews.", "hbs-process")
P.term("Post-Interview Reflection", "A written reflection every interviewee must submit within 24 hours of the HBS interview.", "hbs-process")
P.term("2+2", "HBS deferred admission for final-year students: two to four years of work, then the two-year MBA.", "hbs-process")
P.term("Section", "The cohort of about 90 students who take the first-year Required Curriculum together.", "al-hbs")
P.write()
