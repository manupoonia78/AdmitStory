import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("vanderbilt-owen", "Vanderbilt University Owen Graduate School of Management (Vanderbilt Business)", "Owen", "US", "Nashville, TN", "https://business.vanderbilt.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
INS = "https://business.vanderbilt.edu/mba/admissions/application-instructions/"
P.source("owen-instructions", "official", "Vanderbilt MBA: Application instructions (statements, video, interview, recommendation, resume, tests, fee)", INS)
P.source("owen-admissions", "official", "Vanderbilt MBA: Admissions (Fall 2027 deadlines)", "https://business.vanderbilt.edu/mba/admissions/")
P.source("owen-profile", "official", "Vanderbilt MBA: Class of 2028 profile", "https://business.vanderbilt.edu/mba/class-profile/")
P.source("owen-outcomes", "official", "Vanderbilt MBA: Outcomes (Class of 2025)", "https://business.vanderbilt.edu/mba/outcomes/")
P.source("owen-scholarships", "official", "Vanderbilt MBA: Tuition, financing and scholarships; Dean's Scholars", "https://business.vanderbilt.edu/mba/admissions/tuition-financing-scholarships/")
P.source("owen-academics", "official", "Vanderbilt MBA: curriculum, concentrations, Leadership Development Program", "https://business.vanderbilt.edu/mba/curriculum/")
P.source("owen-about", "official", "About Vanderbilt Business (mission, values, Nashville)", "https://business.vanderbilt.edu/about/")
P.source("ca-mcchesney-2025", "adcom", "Clear Admit Admissions Director Q&A: Bailey McChesney, Director of MBA Admissions, Vanderbilt Owen (Sep 3, 2025)", "https://www.clearadmit.com/2025/09/admissions-director-qa-bailey-mcchesney-of-vanderbilt-owen-3/")
P.source("al-owen", "third_party_reference", "ApplicantLab — Vanderbilt Owen school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", INS); P.url("deadlines", "https://business.vanderbilt.edu/mba/admissions/")
P.url("class_profile", "https://business.vanderbilt.edu/mba/class-profile/"); P.url("employment_report", "https://business.vanderbilt.edu/mba/outcomes/")

for name, dl, dec, note in [("Round 1", "2026-10-01", "2026-12-18", "Deposit due 20 January 2027."),
                            ("Round 2", "2027-01-06", "2027-03-12", "Deposit due 21 April 2027."),
                            ("Round 3", "2027-03-10", "2027-04-23", "Deposit due 12 May 2027. International candidates must apply by 5 April 2027."),
                            ("Round 4", "2027-05-05", None, "Rolling decisions; domestic applicants effectively (international cutoff 5 April).")]:
    P.round(name, dl, "owen-admissions", decision=dec, notes=[(note, "owen-admissions")])
P.add("rounds[0].notes", [("Deadlines are 11:59pm Central; an application still incomplete a week after the deadline moves to the next round.", "owen-admissions")])

P.essay("career_journey",
    "As you contemplate your post-MBA aspirations, walk us through your career journey thus far and share two post-MBA career paths you aim to explore during the Vanderbilt MBA program. Please articulate what in your career journey has led to your decision to pursue an MBA, and touch on skills you've developed that will help you achieve your post-MBA career plans.",
    ("words", 400), "owen-instructions", ["GOALS"],
    parts=["your career journey so far", "two post-MBA career paths to explore", "what in your journey led to the MBA decision", "skills you've developed that will help"],
    notes=[
        ("The prompt is framed by Owen's Career Management Center and notes that many students explore multiple industry paths at once.", "owen-instructions"),
        ("McChesney: essays should reflect on experiences and go beyond the resume, and 'fill in any potential unanswered questions'.", "ca-mcchesney-2025"),
        ("Keep one long-term destination (an impact, not necessarily a title) and show two different short-term paths that each build what that destination needs. Two unrelated destinations read as uncommitted.", "al-owen"),
        ("Derive the two paths from the two or three capabilities the long-term goal requires (for example, a large firm for best practice and a boutique for running a small business), then show which courses serve each.", "al-owen"),
        ("Don't pick 'consulting and banking' just because they're common. Spend roughly half the words on how your prior experience and skills are relevant to the paths.", "al-owen"),
        ("Use Owen's employment report to choose paths where Owen actually places people (consulting, financial services, healthcare and technology lead).", "owen-outcomes"),
    ])
P.essay("challenge",
    "Reflect on a challenge or stressful situation you have faced. How did you respond to this challenge, and what did you learn about yourself through the process?",
    ("words", 300), "owen-instructions", ["SETBACK"],
    parts=["a challenge or stressful situation", "how you responded", "what you learned about yourself"],
    notes=[
        ("McChesney describes it as walking the committee through a stressful situation and what you learned in the process.", "ca-mcchesney-2025"),
        ("Pick something genuinely consequential where your own response is the story. Give the situation quickly, spend most words on what you did and how you changed, and end with a later moment that shows the change held. Never make someone else the villain.", "admitstory-coach"),
    ])
P.optional("optional_explanatory",
    "You may provide an additional statement to briefly explain anything that is not already addressed elsewhere in your application. This could include employment gaps, lack of recommendation from your current or most recent supervisor, violations of the law, academic misconduct, sub-par academic performance, or anything else that is relevant to your application. Bullet points are acceptable for this statement when appropriate.",
    ("words", 300), "owen-instructions", ["OPTIONAL"], required=False,
    parts=["anything not addressed elsewhere"],
    notes=[
        ("Bullets are acceptable. Brief, factual, mature; for grades or scores, point to better evidence. Don't say 'I don't test well': business school is full of exams.", "al-owen"),
    ])
P.todo.append("application.optional_essay.limit: the 2026-27 page states no limit; 300 words is the prior-cycle limit")
P.reapplicant(essay=None, policy=[
    ("Reapplicants can complete a reapplicant essay on what has changed in their candidacy, plus an updated resume, statements, recommendation and any new test scores. Owen keeps applications for two years; use the same login.", "owen-instructions"),
    ("Say what changed and what it taught you, how the career vision sharpened, and how you've engaged more with Owen since.", "al-owen"),
])
P.todo.append("application.reapplicant.essay: prompt wording and limit")
P.video("owen-instructions", "async_video", scripting=False, qtypes=[
    ("A required video response: easy 'small talk' questions with prep time, to glimpse your authentic self speaking without a script.", "owen-instructions"),
    ("McChesney: the video is meant to be like small talk (favourite vacation spots or hobbies) and shows who you are and how you communicate; the interview is the job-interview part.", "ca-mcchesney-2025"),
])
P.todo.append("application.video[0]: number of questions, think and answer times")
P.recs("owen-instructions", 1, "school_specific", notes=[
    ("One letter, due on the round deadline, on the Vanderbilt form or as an attached GMAC Common LOR; ideally a direct supervisor, client or project manager. Non-English letters need a certified translation in the same upload.", "owen-instructions")])
P.resume("owen-instructions", 1, notes=[("A one-page resume should be sufficient; the application's work history section can hold more.", "owen-instructions")])
P.add("application.test_policy", [
    ("GMAT, GRE or Executive Assessment, or an approved waiver. Request a waiver at least two weeks before the round deadline, with an unofficial transcript; quant coursework, analytical work and CPA/CFA-type certifications help. One evaluation per cycle, no appeals, and not possible once a score is submitted.", "owen-instructions"),
    ("Owen warns that consulting and finance employers may ask for test scores even after a waiver.", "owen-instructions"),
    ("English proficiency is waived for degrees from English-official-language countries (Owen counts India), two years living and working in one, or a 90th-percentile verbal score.", "owen-instructions"),
    ("Three-year degrees need a WES four-year equivalency, a CA designation or a year of an M.Com.", "owen-instructions"),
])
P.add("application.fees_waivers", [("Application fee US$200.", "owen-instructions")])
P.add("values.stated", [
    ("Mission: 'Creating opportunities to discover, grow, and thrive in business and beyond.'", "owen-about"),
    ("Values: self-direction (choosing your own path), mastery (developing expertise), belonging (being meaningfully connected), and collaboration (challenging and supporting each other).", "owen-about"),
])
P.value("self-direction", ["acts_unasked", "self_aware"])
P.value("mastery", ["curious_learner", "measurable_impact"])
P.value("belonging", ["community_builder", "empathetic"])
P.value("collaboration", ["brings_people_along", "develops_people"])
P.add("insider_notes", [
    ("Owen used to publish six 'Owen Essentials' (trust, transparency, accountability, valuing diversity, collaborative community, innovation and learning) and a scholarship essay built on them; the current site uses the four values above instead.", "al-owen", 0.6),
    ("Every interested candidate gets an assigned Recruiting Manager who is their point of contact and advocate through enrolment.", "ca-mcchesney-2025"),
    ("Class of 2028: 126 students; average GMAT 666 (middle 80% 637–707), average GRE 159 verbal and 160 quant, median GPA 3.5, six years' average experience, 24% women, 28% international, 25% military.", "owen-profile"),
    ("McChesney highlights entrepreneurship: a new Center for Entrepreneurship push, over US$300,000 a year in non-dilutive grants to student founders, and the Convoy conference.", "ca-mcchesney-2025"),
])
P.add("culture_and_location", [
    ("Nashville is pitched as one of the fastest-growing US metros and a hub for health care, finance, technology, real estate and music, with 500+ recruiting relationships. Nashville was the top destination for Class of 2025 hires.", "owen-about"),
    ("A small class (126) with a campus in midtown Nashville; 13,000+ alumni in 101 countries.", "owen-profile"),
])
P.add("academics.structure", [
    ("Two seven-week 'mods' per semester; 11 required core courses in year one, mostly in the first two mods, so specialty courses start early. 62 credit hours; STEM-designated (36 months of OPT in total). Also requires an international course and an internship.", "owen-academics"),
    ("At least one concentration (12+ credit hours): Accounting, Entrepreneurship, Finance, General Management, Healthcare, Human & Organizational Performance, Marketing, Operations & Analytics, Strategy. Emphases (8 hours): Entrepreneurship, International Studies, Sustainability & Social Impact, Real Estate.", "owen-academics"),
])
P.thing("academics.courses", "Healthcare concentration", "Owen says it requires more healthcare courses than comparable programs; includes a Healthcare Immersion course (surgeries, LifeFlight, research centers, community clinics) and quality-improvement projects at VUMC.", "owen-academics", why=["health care and health-system goals"], url="https://business.vanderbilt.edu/mba/curriculum/concentrations/")
P.thing("academics.experiential", "Leadership Development Program", "Optional co-curricular program: Hogan assessment before arrival, one-on-one ICF coaching in year one, Mentor Circles and a Leadership Blueprint in year two.", "owen-academics", why=["applicants naming a leadership gap"], url="https://business.vanderbilt.edu/mba/leadership-development/")
P.thing("academics.centers", "Center for Entrepreneurship (C4E)", "Expanded with a US$20M gift in 2025; Venture Scout program, founder groups, accelerators and grants.", "owen-academics", why=["founders"], url="https://business.vanderbilt.edu/mba/curriculum/")
P.thing("academics.experiential", "Max Adler Student Investment Fund (MASIF)", "Student-run investment fund.", "owen-academics", why=["investment management goals"], url="https://business.vanderbilt.edu/mba/curriculum/")
P.todo.append("community.clubs: verify specific Owen clubs")

P.employment("owen-outcomes", 2025, [
    ("Consulting", 0.34, None), ("Finance/Accounting", 0.22, None), ("Operations Management", 0.12, None), ("Marketing", 0.12, None),
    ("Business/Data Analytics", 0.07, None), ("General Management", 0.06, None)],
    ["Amazon", "Deloitte Consulting", "Highspring Consulting", "Wells Fargo CIB", "BCG", "EY", "EY-Parthenon", "UnitedHealth Group"])
P.add("careers.recruiting_notes", [
    ("Class of 2025: average base US$148K+, average signing bonus US$36K, 87% had full-time offers within 90 days; by industry consulting 29%, financial services 21%, healthcare 16%, technology 13%.", "owen-outcomes"),
    ("Top metros: Nashville (35 hires), Atlanta, New York, Los Angeles, Charlotte; 79% said Vanderbilt resources connected them to their accepted offer.", "owen-outcomes"),
])
P.todo.append("careers.employment_report: median base by function (full report is on issuu)")
P.class_profile("owen-profile", 2028, size=126, gpa=3.5, intl=0.28)

P.interview("owen-instructions", "invite_only", ["student", "adcom"], True, 30, ["virtual", "campus"], notes=[
    ("By invitation after a complete application, on a rolling basis; run by second-year Recruiting & Admissions Fellows or staff; behavioural, with examples from work and how the MBA serves your goals.", "owen-instructions"),
    ("McChesney: the interviewer has seen only the resume, and the interview is an essential part of the application. In-person interviews are available at campus visits and Discover Vanderbilt Business days; no format preference.", "ca-mcchesney-2025"),
])
P.todo.append("interview.length_min: not published; 30 is a placeholder")
P.ai("owen-instructions", "unknown", notes=[("No statement on applicant AI use was found on Owen's admissions pages.", "owen-instructions", 0.7)])
P.add("scholarships", [
    ("All admits are automatically considered for merit aid (US$10,000 a year up to full tuition); the Dean's Scholars award is full tuition, based on academics, professional accomplishments, defined goals, communication and leadership, and commitment to the school's mission and values.", "owen-scholarships"),
    ("Forté and ROMBA fellowships are available; ROMBA requires an additional essay.", "owen-scholarships", 0.7),
    ("Only answer a ROMBA or similar identity-fellowship essay with a concrete record of action; promising future involvement with no history backfires. Tell one or two change-making examples in depth, never as a saviour.", "al-owen"),
])
P.add("avoid", [
    ("Two career paths with two different long-term destinations, or two paths chosen only because they're common.", "al-owen"),
    ("A scripted, rehearsed video; Owen designs it as small talk.", "owen-instructions"),
    ("Identity-fellowship essays without a history of action.", "al-owen"),
])
P.add("angles_that_work", [
    ("Two paths to one destination, each tied to a capability the destination needs, with Owen's concentrations and mods showing how both get explored.", "al-owen"),
    ("A healthcare goal anchored in Nashville's health-care cluster and Owen's healthcare concentration and immersion.", "owen-academics"),
    ("A challenge essay with a specific stressful moment, the applicant's own response, and a later moment showing what changed.", "admitstory-coach"),
])
P.term("Mod", "A seven-week term; Owen runs two per semester.", "owen-academics")
P.write()
