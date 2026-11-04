import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("mit-sloan", "MIT Sloan School of Management", "MIT Sloan", "US", "Cambridge, MA", "https://mitsloan.mit.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are Admitstory rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
M = "https://mitsloan.mit.edu/mba"
P.source("sloan-apply", "official", "MIT Sloan MBA: How to apply (cover letter, resume, recommendation, references, org chart, coursework, tests, videos, fee)", M + "/admissions/how-to-apply")
P.source("sloan-admissions", "official", "MIT Sloan MBA: Admissions (what kind of leader thrives, deadlines)", M + "/admissions")
P.source("sloan-faq", "official", "MIT Sloan MBA: Admissions FAQ (process, committee, interviews, waitlist)", M + "/admissions/frequently-asked-questions")
P.source("sloan-employment-2025", "official", "MIT Sloan 2025-2026 MBA Employment Report (Class of 2025) (PDF)", "https://mitsloan.mit.edu/sites/default/files/2026-03/2025-2026-MBA-Employment-Report.pdf")
P.source("ca-sloan-2028", "press", "Clear Admit: MIT Sloan MBA Class of 2028 profile (Sep 2026)", "https://www.clearadmit.com/2026/09/mit-sloan-mba-class-of-2028-profile/")
P.source("al-sloan", "third_party_reference", "ApplicantLab — MIT Sloan school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "Admitstory coaching canon and Manu's storytelling rules", None)

P.url("prompts", M + "/admissions/how-to-apply"); P.url("deadlines", M + "/admissions")
P.url("employment_report", "https://mitsloan.mit.edu/sites/default/files/2026-03/2025-2026-MBA-Employment-Report.pdf")

P.round("Round 1", "2026-09-29", "sloan-admissions", notes=[
    ("Due 3:00 pm ET; decisions mid-December 2026, released early to candidates denied without an interview. Reapplicants may apply in either round.", "sloan-admissions"),
    ("Round 1 interviews run late October to early December.", "sloan-faq"),
])
P.round("Round 2", "2027-01-12", "sloan-admissions", notes=[
    ("Decisions early April 2027; interviews typically February and March. MIT Sloan/Harvard Kennedy dual-degree applicants must apply in Round 2; LGO has its own round.", ["sloan-admissions", "sloan-faq", "sloan-apply"]),
    ("A waitlisted Round 1 applicant is automatically reconsidered in the next round.", "sloan-faq"),
])
P.todo.append("rounds: decision dates are published only as 'mid-December' and 'early April'")

P.essay("cover_letter",
    "MIT Sloan seeks students whose personal characteristics demonstrate that they will make the most of the incredible opportunities at MIT, both academic and non-academic. We are on a quest to find those whose presence will enhance the experience of other students. We seek thoughtful leaders with exceptional intellectual abilities and the drive and determination to put their stamp on the world. We welcome people who are independent, authentic, and fearlessly creative — true doers. We want people who can redefine solutions to conventional problems, and strive to preempt unconventional dilemmas with cutting-edge ideas. We demand integrity and respect passion. Taking the above into consideration, please submit a cover letter seeking a place in the MIT Sloan MBA program. Your letter should conform to a standard business correspondence, include one or more professional examples that illustrate why you meet the desired criteria above, and be addressed to the Admissions Committee.",
    ("words", 300), "sloan-apply", ["LEADERSHIP", "IDENTITY"],
    parts=["standard business letter addressed to the Admissions Committee", "one or more professional examples", "how they show the criteria (independent, creative doers who redefine solutions; integrity)"],
    notes=[
        ("300 words excluding address and salutation, in full business-letter format (your address, date, the admissions office address, 'Dear Admissions Committee').", "sloan-apply"),
        ("Write the resume first. Skip the 'My name is… I am writing to apply' opener: open on a hook (the origin of your career passion or a reason to care), name the goal in a line, then spend most words on one to three examples.", "al-sloan"),
        ("Sloan wants the how behind the resume: how you persuaded, innovated or got a sceptic to change their mind. Two people with the same result led differently; show your way. A story where you challenged someone senior to get an idea adopted fits especially well.", "al-sloan"),
        ("'Why Sloan' is optional and brief at most (a track or certificate, an Action Learning Lab, a student you spoke to); prioritise the leadership story if you're over the limit.", "al-sloan"),
        ("End on a line that echoes the opening thread, not 'I look forward to hearing from you'.", "al-sloan"),
    ])
P.video("sloan-apply", "async_video", answer=90, attempts=1, scripting=False, qtypes=[
    ("Video 1 (required, recorded and uploaded): 'Every applicant has a story that can't be captured in a resume. Take up to 90 seconds to share yours: who you are, where you come from, and what's shaped the person you are today. Be conversational, be yourself.' Speak directly to the camera; no music or subtitles; avoid reading a script.", "sloan-apply"),
    ("This video replaced the old written background essay and is required of everyone, so it needn't be about hardship. Start from what energises you today, then where it came from; every claim needs a concrete anchor (a scene, a habit), and 'where you come from' must appear.", "al-sloan"),
    ("Structures that work in 90 seconds: two or three quick facets then a deep dive on one; from/shaped/am beats; one vivid scene that carries everything; a short then-to-now arc. Practise from bullet points, not a script; a few 'ums' beat sounding memorised.", "al-sloan"),
])
P.video("sloan-apply", "async_video", think=10, answer=60, attempts=1, scripting=False, qtypes=[
    ("Video 2 (required): a randomly generated, open-ended question answered in the application; 'We want to hear how you think and communicate in your own words. No prior preparation is required.' Examples: 'What achievement are you most proud of and why?' 'Tell us about a time a classmate or colleague wasn't contributing to a group project. What did you do?'", "sloan-apply"),
    ("Reported prompts include a non-contributing teammate, the most important thing on your resume, creativity, inspiring a team, a failing team, change at work, presenting data clearly, upholding a principle, and office politics. Have flexible stories ready.", "al-sloan", 0.7),
])
P.todo.append("application.video[1]: the 10-second prep / 60-second answer timing comes from earlier cycles; confirm in the portal")
P.form("org_chart", "Organizational chart", "sloan-apply", guidance=[
    ("Show the internal structure, where you sit, your line of reporting and anyone who reports to you; circle your role in red and highlight your recommender or references if they appear. Names and titles help, but redacting is fine. Consultants, entrepreneurs and military applicants should check the FAQ samples.", "sloan-apply"),
    ("Focus on your department and where it sits in the organisation; it tells readers how senior an 'analyst' really is at your firm.", "al-sloan"),
])
P.form("employment_history", "Employment history (up to three entries, with compensation)", "sloan-apply", item_count_max=3, guidance=[
    ("Starting with the current role: organisation, role and compensation; entrepreneurs add company formation, partnership and revenue model. Focus on impact.", "sloan-apply"),
])
P.form("coursework", "Relevant coursework and professional certifications", "sloan-apply", guidance=[
    ("No prerequisites, but list courses (and grades) in the listed subject areas, plus certifications such as CFA, CPA or ACCA and graded non-degree work (MITx MicroMasters, CORe, edX, MBA Math).", "sloan-apply"),
])
P.form("academic_concerns", "Academic concerns and employment gaps (short explanation fields)", "sloan-apply", char_limit=1000, limit_kind="chars_incl_spaces", guidance=[
    ("These short fields replace an optional essay: brief, factual, mature. Sloan has no place to explain a non-supervisor recommender, so have the recommender explain the relationship, and show their position on the org chart.", "al-sloan"),
])
P.todo.append("application.form_sections.academic_concerns: the 1,000-character limit comes from coaching material; confirm in the portal")
P.reapplicant(essay=None, policy=[("Reapplicants may apply in either round and submit a full application.", "sloan-admissions")])
P.recs("sloan-apply", 1, "school_specific", questions=[
    "How long and in what capacity have you known the applicant?",
    "How does the applicant stand out from others in a similar capacity?",
    "Please give an example of the applicant's impact on a person, group, or organization.",
    "Please give a representative example of how the applicant interacts with other people.",
    "Please tell us anything else you think we should know about this applicant.",
    "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
], notes=[
    ("One letter, ideally from a manager or supervisor; no family. Plus two additional professional references (different people) whom the committee may contact.", "sloan-apply"),
    ("Brief the recommender with persuasion and relationship stories (Sloan asks how you interact with people), not a drafted letter.", ["al-sloan", "admitstory-coach"]),
])
P.resume("sloan-apply", 1, notes=[
    ("One page, reverse chronological, in this order: Education (awards, scholarships, societies); Work Experience (company, title, results-oriented bullets, dates); Additional Information (activities, community service, skills, certifications, interests, languages). 'Focus on your work results, not just your title.'", "sloan-apply"),
    ("Drop low-value skills lines if space is better used for an achievement.", "al-sloan"),
])
P.add("application.test_policy", [
    ("A valid GMAT (Focus or 10th Edition) or GRE is required by the deadline; self-reported scores accepted; no preference between online and test-centre exams. Single-attempt scores are evaluated this cycle; a GMAT Superscore on the report won't hurt.", "sloan-apply"),
])
P.add("application.fees_waivers", [("Fee US$250; waivers for current Peace Corps members and US veterans or active-duty military. No retroactive waivers.", "sloan-apply")])

P.add("values.stated", [
    ("Sloan brings together 'independent, authentic, and fearlessly creative thinkers who are determined to make ideas matter'. Those who thrive: lead collaboratively and inspire others; show intellectual curiosity and analytical strength; approach complex problems with persistence, creativity and ingenuity; show growth and achievement; act with integrity and contribute responsibly.", "sloan-admissions"),
    ("'Above all, we seek thoughtful leaders with exceptional intellectual abilities who value dignity and respect and are determined to make a meaningful impact.'", "sloan-apply"),
    ("No single component outweighs another; the committee is professional staff and current students aren't involved in evaluation.", "sloan-faq"),
])
P.value("fearlessly creative; redefine solutions to conventional problems", ["originates_ideas", "creative"])
P.value("true doers (mens et manus: mind and hand)", ["acts_unasked", "measurable_impact"])
P.value("lead collaboratively; persuade and build relationships", ["brings_people_along", "cross_functional_influence"], ("Sloan's interviews ask how you persuade others; persuasion stories are prime material across the cover letter, videos and interview.", "sloan-faq"))
P.value("integrity; dignity and respect", ["principled_stands", "empathetic"])
P.add("insider_notes", [
    ("Class of 2028: 450 students (including LGO); 43% women; 45% international from 65 countries; median GMAT Focus 675 (middle 80% 645–715); about five years' average experience.", "ca-sloan-2028"),
    ("Class of 2025 profile: 409 MBA candidates plus 53 LGO; median GMAT 730; average GPA 3.61; 40% international; 46% women.", "sloan-employment-2025"),
    ("Sloan cares less about precise post-MBA plans than other schools; the application is built around evidence of how you act.", "al-sloan", 0.7),
    ("Signal interest: sign up with admissions and talk to a student ambassador or club member in your field, so Sloan believes it isn't your backup.", "al-sloan"),
])
P.add("culture_and_location", [
    ("In Cambridge on the MIT campus; a collaborative community where 'varied experiences and perspectives strengthen learning'.", ["sloan-admissions", "sloan-apply"], 0.8),
])
P.add("academics.structure", [
    ("Programs alongside the two-year MBA: LGO (MBA plus SM from the School of Engineering, applied to in its own round, with automatic MBA consideration), MBA Early deferred admission, and a three-year MIT Sloan/Harvard Kennedy dual degree.", "sloan-apply"),
    ("Certificates in Enterprise Management, Finance and other areas; Action Learning Labs bring 'mens et manus' into practice.", ["sloan-employment-2025", "al-sloan"], 0.75),
])
P.todo.append("academics: verify Action Learning lab names (G-Lab, etc.), tracks/certificates and clubs from mitsloan.mit.edu")

P.employment("sloan-employment-2025", 2025, [
    ("Consulting", 0.323, 190000), ("Technology", 0.233, 165000), ("Finance", 0.206, 175000), ("Healthcare/Pharma/Biotech", 0.081, 160000),
    ("Retail/CPG", 0.036, 145000), ("Energy", 0.031, 170000), ("Auto/Aerospace", 0.022, 160000)],
    ["Boston Consulting Group", "McKinsey & Company", "Amazon", "Bain & Company", "Verizon", "Strategy&"])
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$175,000 (mean US$173,132); median signing bonus US$30,000; 91.0% of job seekers had an offer within three months. Top functions: consulting/strategy 38.5%, finance 15.9%.", "sloan-employment-2025"),
    ("Class of 2026 internships: technology 31.0%, finance 29.6%, consulting 16.0%, healthcare 6.5%.", "sloan-employment-2025"),
])
P.class_profile("ca-sloan-2028", 2028, size=450, gmat_focus=675, wexp=5, intl=0.45)
P.todo.append("class_profile: from a press summary of Sloan's Class of 2028 profile; confirm on mitsloan.mit.edu")

P.interview("sloan-faq", "invite_only", ["adcom"], None, 30, ["virtual"],
    questions=[
        ("Tell me about a time you persuaded someone to adopt your idea.", "sloan-faq", 5),
        ("Tell me about a time you worked as part of a team that faced a problem. What did you do?", "sloan-faq", 4),
        ("Give an example of how you built a relationship that mattered to a result.", "sloan-faq", 4),
    ],
    notes=[
        ("One-on-one with a member of the Admissions Committee, about 30 minutes, all virtual. Behavioural: 'specific examples of your personal and professional behavior, such as how you persuade others, work as part of a team, and solve problems.'", "sloan-faq"),
        ("They look for 'how you have built relationships and demonstrated leadership', plus professional presentation, communication and English proficiency.", "sloan-faq"),
        ("Prepare four or five stories in situation-action-result form with the persuasion step spelled out; be ready for 'why Sloan' here, since the written application barely asks.", ["al-sloan", "admitstory-coach"]),
    ])
P.todo.append("ai_policy: MIT Sloan had no published generative-AI admissions policy at last check; re-check the portal")
P.add("avoid", [
    ("A cover letter that opens 'My name is… and I am writing to apply'.", "al-sloan"),
    ("Retelling resume results without the how.", "al-sloan"),
    ("Spending cover-letter words on Sloan's culture of innovation, which everyone praises.", "al-sloan"),
    ("Reading a script in Video 1.", "sloan-apply"),
])
P.add("angles_that_work", [
    ("A cover letter built on one example where the applicant pushed an unconventional idea past a sceptical senior person, with the persuasion step shown.", "al-sloan"),
    ("A Video 1 anchored in one concrete scene from where the applicant comes from that explains what they do today.", "al-sloan"),
])
P.term("Mens et manus", "MIT's motto, 'mind and hand': ideas put into action.", "al-sloan")
P.term("LGO", "Leaders for Global Operations: Sloan's two-year MBA plus engineering SM program.", "sloan-apply")
P.term("Action Learning", "Sloan's hands-on lab courses where students work on real organisations' problems.", "al-sloan")
P.write()
