import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("cmu-tepper", "Carnegie Mellon University Tepper School of Business", "Tepper", "US", "Pittsburgh, PA", "https://www.cmu.edu/tepper")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
APPLY = "https://www.cmu.edu/tepper/programs/mba/admissions/apply-full-time-mba"
P.source("tepper-apply", "official", "Tepper: Apply to the Full-Time MBA (essays, video essay, deadlines, interview, recommendation, resume, tests, fee)", APPLY)
P.source("tepper-profile", "official", "Tepper Full-Time MBA class profile (Class of 2027)", "https://www.cmu.edu/tepper/programs/mba/admissions/ft-class-profile")
P.source("tepper-employment-2025", "official", "Tepper 2025 MBA Employment Report Summary (PDF)", "https://cmu.edu/sites/default/files/cmu-tepper-site-files/documents/2025%20MCC%20MBA%20Employment%20Summary%20Report_Web.pdf")
P.source("tepper-curriculum", "official", "Tepper MBA curriculum, concentrations, capstones and full-time program pages", "https://www.cmu.edu/tepper/programs/mba/curriculum")
P.source("tepper-mba", "official", "Tepper MBA overview", "https://www.cmu.edu/tepper/programs/mba")
P.source("tepper-team", "official", "Tepper Masters Admissions team", "https://www.cmu.edu/tepper/programs/masters-admissions/masters-admissions-team")
P.source("ca-mcgrath-2026", "adcom", "Clear Admit Admissions Director Q&A: J.R. McGrath, Executive Director of Masters Admissions, Tepper (Jun 22, 2026)", "https://www.clearadmit.com/2026/06/admission-director-qa-carnegie-mellon-tepper-mba/")
P.source("ca-mcgrath-2025", "adcom", "Clear Admit Admissions Director Q&A: J.R. McGrath, Tepper (Jul 29, 2025)", "https://www.clearadmit.com/2025/07/admission-director-qa-mcgrath-carnegie-mellon-tepper-2/")
P.source("al-tepper", "third_party_reference", "ApplicantLab — Tepper school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", APPLY); P.url("deadlines", APPLY)
P.url("class_profile", "https://www.cmu.edu/tepper/programs/mba/admissions/ft-class-profile")
P.url("employment_report", "https://www.cmu.edu/tepper/programs/mba/careers/compensation-highlights")

for name, dl, dec, note in [
    ("Round 1", "2026-09-30", "2026-12-09", "Deposit due 9 February 2027."),
    ("Round 2", "2027-01-08", "2027-03-10", "Deposit due 20 April 2027 (the site prints 2026, apparently a typo)."),
    ("Round 3", "2027-03-03", "2027-04-22", "Final round for international applicants; deposit due 13 May 2027."),
    ("Round 4", "2027-05-05", None, "Rolling decisions; domestic applicants only."),
    ("Round 4 Final", "2027-06-15", None, "Rolling decisions; domestic applicants only."),
]:
    P.round(name, dl, "tepper-apply", decision=dec, notes=[(note, "tepper-apply", 0.8 if "typo" in note else 0.85)])
P.add("rounds[0].notes", [("McGrath: international applicants have the best chance of admission and a competitive scholarship in Rounds 1 or 2.", "ca-mcgrath-2026")])

P.essay("essay_option_1_uncertainty",
    "At the Tepper School, we value leaders who can make confident decisions when facing complexity and uncertainty. Tell us about a time when you had to take action without having all of the answers. How did you navigate the situation and what was the outcome?",
    ("words", 500), "tepper-apply", ["LEADERSHIP"], required=False,
    parts=["a time you had to act without all the answers", "how you navigated it", "the outcome"],
    notes=[
        ("Applicants answer one of two options (500 words); Tepper says it has no preference.", "tepper-apply"),
        ("This option gives more room to show leadership than the transformation option, which reads like a recycled statement of purpose; goals can still come through in the video and interview.", "al-tepper"),
        ("Tepper's pool is full of innovators, so persuasion, initiative and teamwork make a candidate stand out more than innovation alone: show people you brought along, not just the clever fix.", "al-tepper"),
        ("McGrath: the best essays answer the question straightforwardly and then give context; 'the why' behind each choice is the most important part.", "ca-mcgrath-2026"),
        ("Make the uncertainty concrete: what you didn't know, what you couldn't wait for, the call you made and how you hedged it. Credit others; make your own decisions unmistakable.", "admitstory-coach"),
    ])
P.essay("essay_option_2_transformation",
    "The Tepper School of Business is committed to helping students reach their full potential by supporting their professional and personal transformation. How do you hope to transform, both professionally and personally, during your time in the program? Please describe your development goals and steps you plan to achieve them.",
    ("words", 500), "tepper-apply", ["GOALS", "WHY-SCHOOL"], required=False,
    parts=["professional transformation hoped for", "personal transformation hoped for", "development goals and the steps to achieve them"],
    notes=[
        ("The alternative to option 1; one essay only, 500 words.", "tepper-apply"),
        ("If chosen, make it more than a why-Tepper list: name the specific gaps (professional and personal), how you discovered them, and the Tepper mechanism for each, such as Accelerate Leadership Center coaching or a concentration.", "al-tepper"),
        ("McGrath warns against recycling another school's essay; reuse your points, not your paragraphs.", "ca-mcgrath-2026"),
    ])
P.todo.append("application.essays: Tepper asks for one of two options; the kit should treat essay_option_1 and essay_option_2 as a choice of one")

P.video("tepper-apply", "async_video", answer=120, scripting=False, qtypes=[
    ("Video Essay: Goals — 'Please describe your post-MBA career goals.' Up to two minutes; be specific; it's fine not to name companies yet; say what appeals about the industry, company or role, your criteria for choosing, and how it relates to the long-term plan.", "tepper-apply"),
    ("McGrath: the video isn't impromptu and isn't a test of reading on camera; it exists to get to know you and the content of your answer — 'frame your response and talk to us'. Career outcome is the main driver of student satisfaction.", "ca-mcgrath-2026"),
    ("Use a few key points on a sticky note, not a script; Tepper says it doesn't want stiff, scripted answers. Follow webcam basics on lighting and framing.", "al-tepper"),
    ("Suggested beats in two minutes: the target role and why it appeals, your criteria, the bridge from current experience, how it serves the long-term plan, and what Tepper adds.", "admitstory-coach"),
])
P.todo.append("application.video[0]: prep time and number of attempts")

P.short("interesting_fact",
    "One more question from the Admission Committee - just for fun! List an interesting fact about yourself that you'd like to share with your future Tepper classmates (P.S. - 1 or 2 sentences will be just fine):",
    ("words", 50), "al-tepper", ["MICRO"], required=False, verified=False,
    parts=["one interesting fact for classmates"],
    notes=[
        ("Keep it delightful and likeable. Prefer the most surprising option (a coder who paints beats a coder who codes games) or one that quietly shows warmth.", "al-tepper"),
        ("Hint at what it says about you through a detail, never by spelling out the lesson. Skip anything that raises questions about ethics, maturity or comfort, and anything braggy.", "al-tepper"),
    ])
P.todo.append("application.short_answers[key=interesting_fact]: confirm this question and its limit exist in the 2026-27 portal (only seen in coaching material; not on public pages)")

P.optional("optional",
    "There also is an optional essay for additional information about your candidacy that you may wish to share with the admissions committee. Use this essay to convey important information that you may not have otherwise been able to convey. This may include unexplained resume gaps, context for recommender selection, etc. However, do not feel obligated to complete the optional essay.",
    ("words", 500), "tepper-apply", ["OPTIONAL"], required=False, verified=False,
    parts=["important information not conveyed elsewhere"],
    notes=[
        ("No word limit is published; keep it brief and factual.", "tepper-apply"),
        ("McGrath asks international applicants to explain context such as company size, normal promotion speed and how their grades compare locally: 'It is your story to tell'.", "ca-mcgrath-2026"),
        ("Explain gaps, grades or an unusual recommender plainly and point to better evidence; no apology, no excuses.", "al-tepper"),
    ])
P.todo.append("application.optional_essay.limit: no limit is published; 500 words is a placeholder")
P.reapplicant(essay=None, policy=[
    ("Reapplicants use the optional essay to explain how their candidacy has strengthened since the last application.", "tepper-apply"),
    ("Reapplicants within a year log in to the same account, some information carries over, and the fee is waived; interviews remain by invitation.", "tepper-apply"),
    ("Name what changed (new scope, results, a sharper goal, a better score) and what it taught you, briefly, inside the optional essay.", "al-tepper"),
])

P.recs("tepper-apply", 1, "gmac_common", notes=[
    ("One recommendation via the GMAC Common LOR; ideally a current or previous supervisor, or anyone who can speak in detail to your professional work.", "tepper-apply")])
P.todo.append("application.recommendations.questions: GMAC Common LOR questions verbatim")
P.resume("tepper-apply", 2, notes=[
    ("One to two pages in a standard 12-point font such as Times New Roman or Arial, with month and year for every start and end date; missing dates trigger a request for a new resume.", "tepper-apply"),
    ("Tepper looks for career advancement, so list every title held at a company; stacking titles makes promotions obvious. One page is preferred where possible, and relevant summer internships can stay.", "al-tepper", 0.7),
])
P.add("application.test_policy", [
    ("GMAT, GMAT Focus, GRE or Executive Assessment required (online or in person); no superscore; highest single test date reported; scores valid five years.", "tepper-apply"),
    ("EA submitters are expected to have extensive quantitative coursework or STEM experience.", "tepper-apply"),
    ("Test waivers case by case on academic readiness, with a response within 10 business days of the deadline; a waiver doesn't affect scholarship eligibility.", "tepper-apply"),
    ("One semester of college calculus with a B or better, or Tepper's Calculus Fundamentals course before matriculating.", "tepper-apply"),
    ("English test (TOEFL, IELTS or Duolingo) unless a degree was taught entirely in English.", "tepper-apply"),
])
P.add("application.fees_waivers", [
    ("US$200 application fee; waived for attending a Tepper event and for reapplicants within a year. Admits are verified by Re Vera.", "tepper-apply")])

P.add("values.stated", [
    ("Tepper describes itself as rigorous and quantitative and says it values 'leaders who can make confident decisions when facing complexity and uncertainty'.", "tepper-apply"),
    ("McGrath: Tepper students are 'more than innovative problem solvers'; success depends on emotional intelligence, communication and leading diverse groups, which the program develops.", "ca-mcgrath-2026"),
    ("Tepper takes a holistic approach, reviewing goals, background and accomplishments to judge fit.", "tepper-apply"),
])
P.value("confident decisions under uncertainty", ["steady_in_ambiguity", "acts_unasked", "commercial_judgment"])
P.value("analytical rigour", ["analytical"], ("Analytical strength is common in this pool; pair it with persuasion and teamwork to stand out.", "al-tepper"))
P.value("people skills: EQ, communication, leading diverse groups", ["brings_people_along", "empathetic", "cross_functional_influence"])
P.add("insider_notes", [
    ("McGrath: 'There is this myth about top MBA programs that you must be perfect to get it. That is simply not true.'", "ca-mcgrath-2026"),
    ("Every application is read to decide interview invitations; the interviewer reads the full file and the committee discusses every interviewed candidate.", "ca-mcgrath-2026"),
    ("Class of 2027 (latest profile): 144 students, 38% international, 14% US military; GMAT Focus median 655 (middle 80% 595–715), GMAT 10th edition median 710, GRE median 164 quant and 159 verbal, GPA median 3.38, five years' median work experience.", "tepper-profile"),
    ("Admissions leadership: J.R. McGrath, Executive Director of Masters Admissions (since 2021).", "tepper-team"),
])
P.add("culture_and_location", [
    ("Full-time students take classes Monday to Thursday; the Tepper Quad is a university-wide collaboration hub; the program targets people with two to eight years' experience.", "tepper-curriculum"),
])
P.add("academics.structure", [
    ("21 months, STEM-designated (F-1 graduates may qualify for 24-month STEM OPT), in a four-mini-semester format with analytics from day one: optimisation, prescriptive and predictive modelling.", "tepper-mba"),
    ("One concentration is required and most students earn three or four, automatically, by taking three or more electives in an area; 14 concentrations including AI for Business, Business Technologies, Health Care Analytics and Operations Research.", "tepper-curriculum"),
    ("Tracks include Technology Strategy and Product Management, Business Analytics, Management of Innovation and Product Development, Energy and Sustainability, and Entrepreneurship in Organizations.", "tepper-curriculum"),
])
P.thing("academics.courses", "Business Technologies concentration", "Solving business problems with data and technology, drawing on courses from the School of Computer Science, the Software Engineering Institute and Heinz College.", "tepper-curriculum", why=["product management and tech goals"], url="https://www.cmu.edu/tepper/programs/mba/curriculum/concentrations")
P.thing("academics.courses", "AI for Business concentration", "From machine learning to the legal and ethical considerations of AI.", "tepper-curriculum", why=["AI product and strategy goals"], url="https://www.cmu.edu/tepper/programs/mba/curriculum/concentrations")
P.thing("academics.courses", "Health Care Analytics concentration", "Analytics applied to health care.", "tepper-curriculum", why=["health data and health tech goals"], url="https://www.cmu.edu/tepper/programs/mba/curriculum/concentrations")
P.thing("academics.experiential", "Strategic Management of the Enterprise capstone", "On-campus capstone run with Kearney and sponsor companies on consulting projects (past clients include Costco, P&G, PNC, Siemens, UPMC and Walmart).", "tepper-curriculum", why=["consulting and strategy goals"], url="https://www.cmu.edu/tepper/programs/mba/curriculum/capstones")
P.thing("academics.centers", "Accelerate Leadership Center", "Personalised coaching from day one to strengthen communication, influence and decision-making.", "tepper-curriculum", why=["applicants naming a leadership or communication gap"], url="https://www.cmu.edu/tepper/programs/mba/curriculum")
P.thing("academics.centers", "Swartz Center for Entrepreneurship", "More than 100 entrepreneur events a year plus funding, mentorship and workspace; more than 260 companies launched since 2008.", "tepper-curriculum", why=["founders"], url="https://www.cmu.edu/tepper/programs/mba/full-time")
P.todo.append("community.clubs: verify Tepper clubs and treks")

P.employment("tepper-employment-2025", 2025, [
    ("Consulting", 0.351, 188000), ("Finance", 0.198, 135000), ("General Management", 0.126, 135000),
    ("Marketing", 0.126, 170050), ("Production and Operations Management", 0.117, 142800), ("Information Systems/Technology", 0.036, 160000)],
    ["Amazon", "PwC", "McKinsey & Company", "Deloitte", "Boston Consulting Group", "Republic Services", "Google", "Jefferies", "Ford Motor Co.", "Kearney"],
    intl=("Of non-permanent-work-authorization graduates seeking work, 83.8% had an offer by three months after graduation (63.2% by graduation).", "tepper-employment-2025"))
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$160,000, average total compensation US$186,043; 83% had an offer within three months and 89% within six.", "tepper-employment-2025"),
    ("Consulting (35.7%) and technology (25.1%) took 60% of graduates; financial services 9.9%. Marketing medians are pulled up by B2B product roles (US$170,050).", "tepper-employment-2025"),
    ("Function medians: management/strategy consulting US$188,000; corporate finance US$135,000; operations management US$142,800; product/industrial B2B marketing US$170,050; general management/LDPs US$135,000. Medians in the by-function table are for the largest sub-function.", "tepper-employment-2025", 0.8),
    ("73% of accepted full-time offers came through school-facilitated sources.", "tepper-employment-2025"),
])
P.class_profile("tepper-profile", 2027, size=144, gmat_focus=655, gmat=710, gre=(159, 164), gpa=3.38, wexp=5, intl=0.38)

P.interview("ca-mcgrath-2026", "invite_only", ["adcom"], False, 45, ["virtual", "campus"], notes=[
    ("Tepper calls the interview 'the most important component of the admissions process'. Admissions staff interview after reading the full application and then present the candidate to the committee.", "ca-mcgrath-2026"),
    ("Behavioural: background, goals and how you make decisions, then teamwork, leadership and work examples of success and learning; end with your questions.", "ca-mcgrath-2026"),
    ("Invitations start within a week of the deadline and can come any time before the decision date; the interview is required.", "tepper-apply"),
    ("Tepper's prep advice: reflect on short-term goals and the transition plan, and have examples of teamwork, leading, being challenged, succeeding and learning something new.", "tepper-apply"),
])
P.ai("tepper-apply", "unknown", notes=[("Tepper's admissions pages and director Q&As say nothing about applicants using AI; check the application's certification statement.", "tepper-apply", 0.7)])
P.add("scholarships", [("All admitted applicants are considered for merit scholarships; applying with a test waiver doesn't affect eligibility; international applicants should apply in R1 or R2 for the best scholarship chances.", "ca-mcgrath-2026", 0.75)])
P.add("avoid", [
    ("Recycling another school's essay: McGrath names it as the most common mistake.", "ca-mcgrath-2026"),
    ("Writing what you think Tepper wants to hear instead of your own thinking on the question.", "ca-mcgrath-2026"),
    ("Reading a script in the video essay.", "al-tepper"),
    ("An innovation story with no people in it; the pool already shows plenty of innovation.", "al-tepper"),
    ("Resume dates without months.", "tepper-apply"),
])
P.add("angles_that_work", [
    ("Option 1 told as a decision under real uncertainty where the applicant also had to persuade sceptical colleagues, with the reasoning behind each call made explicit.", "al-tepper"),
    ("A video that names a target role and the criteria behind it in plain, conversational language, connecting to a long-term plan.", "tepper-apply"),
    ("A technical applicant who shows people skills: translating for non-technical stakeholders, bringing a team along, coaching a colleague.", "ca-mcgrath-2026"),
])
P.term("Mini", "A half-semester term; Tepper runs four minis a year.", "tepper-curriculum")
P.term("Accelerate Leadership Center", "Tepper's leadership coaching center.", "tepper-curriculum")
P.write()
