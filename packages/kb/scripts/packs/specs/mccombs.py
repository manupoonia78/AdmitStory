import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("ut-austin-mccombs", "The University of Texas at Austin McCombs School of Business", "McCombs", "US", "Austin, TX", "https://www.mccombs.utexas.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
G = "https://www.mccombs.utexas.edu/graduate/mba/full-time-mba"
BL = "https://blogs.mccombs.utexas.edu/mba-insider"
P.source("mccombs-apply", "official", "Texas McCombs Full-Time MBA: Application process (essays, video assessment, interview, recommendation, tests, deadlines)", G + "/admissions/application-process/")
P.source("mccombs-waiver", "official", "Texas McCombs: Requesting a test waiver", "https://www.mccombs.utexas.edu/graduate/mba/requesting-a-test-waiver/")
P.source("mccombs-profile", "official", "Texas McCombs Full-Time MBA: Class profile (Class of 2027)", G + "/admissions/class-profile/")
P.source("mccombs-employment-2025", "official", "Texas McCombs Full-Time MBA Employment Report, Class of 2025 (PDF)", "https://go.mccombs.utexas.edu/rs/503-KLY-263/images/FT%20MBA%20Employment%20Report%202025-26.pdf")
P.source("mccombs-academics", "official", "Texas McCombs Full-Time MBA: concentrations, McCombs+, Hildebrand leadership, fellows, global studies", G + "/academics/curriculum/concentrations/")
P.source("mccombs-blog-essays", "adcom", "MBA Insider (Texas MBA Admissions): Successfully answering the Texas McCombs MBA essay prompts (Jul 1, 2025)", BL + "/successfully-answering-the-texas-mccombs-mba-essay-prompts/")
P.source("mccombs-blog-video", "adcom", "MBA Insider (Texas MBA Admissions): Mastering the Texas McCombs video assessment (Jul 11, 2026)", BL + "/lights-camera-mba-mastering-the-texas-mccombs-video-assessment/")
P.source("mccombs-blog-recipe", "adcom", "MBA Insider (Texas MBA Admissions): An admissions committee's recipe for a strong application (Aug 30, 2024)", BL + "/an-admissions-committees-recipe-for-a-strong-application/")
P.source("mccombs-blog-interview", "adcom", "MBA Insider (Texas MBA Admissions): The value of the MBA admissions interview (Jul 15, 2025)", BL + "/value-of-the-mba-admissions-interview/")
P.source("mccombs-blog-reapply", "adcom", "MBA Insider (Texas MBA Admissions): Complete guide to reapplying (Jul 5, 2025)", BL + "/complete-guide-reapplying-tips-success/")
P.source("al-mccombs", "third_party_reference", "ApplicantLab — McCombs school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", G + "/admissions/application-process/"); P.url("deadlines", G + "/admissions/application-process/")
P.url("class_profile", G + "/admissions/class-profile/"); P.url("employment_report", G + "/career/")

P.round("Round 1", "2026-10-15", "mccombs-apply", decision="2026-12-17", notes=[("Due 11:59pm Central.", "mccombs-apply")])
P.round("Round 2", "2027-01-15", "mccombs-apply", decision="2027-03-25")
P.round("Round 3", "2027-04-01", "mccombs-apply", decision="2027-05-06")

P.essay("mba_journey",
    "Imagine yourself at the completion of your MBA journey. Why was pursuing your MBA at Texas McCombs the right decision for your personal and professional growth? Reflect on how you made the most of your time in the program—academically, through hands-on learning opportunities, and within the McCombs community. Highlight how you contributed to the McCombs community and used its resources to grow both professionally and personally.",
    ("words", 250), "mccombs-apply", ["GOALS", "WHY-SCHOOL", "CONTRIBUTION"],
    parts=["why McCombs was the right decision for personal and professional growth", "academics", "hands-on learning", "the McCombs community: what you contributed and used"],
    notes=[
        ("McCombs' own tip: 'Open with a specific scene from your imagined post-MBA life'. Avoid generic school praise and recycled content.", "mccombs-blog-essays"),
        ("Write it in the past tense, looking back from graduation or the eve of the first post-MBA job. The short-term role appears early; the long-term goal can be woven in later or land at the end.", "al-mccombs"),
        ("At 250 words, keep the most distinctive McCombs resources (a concentration, a fellows program, a McCombs+ project) and cut what any school offers. A global course belongs only if the career needs it.", "al-mccombs"),
        ("Hildebrand leadership coaching has two pillars, character and credibility; cite the credibility side so it doesn't read as a worry about your own character.", "al-mccombs", 0.65),
        ("Split contributions across the two essays: the one that matches your Essay 2 value goes there, the rest here.", "al-mccombs"),
    ])
P.essay("core_value",
    "Reflect on a core value that defines you. Share a specific example of how it has guided your decisions and actions, and explain how it will shape your contributions and growth as a McCombs MBA student. Highlight how this value has influenced your leadership style and life path, and how it will shape your MBA experience.",
    ("words", 250), "mccombs-apply", ["VALUES", "LEADERSHIP"],
    parts=["one core value", "a specific example where it guided decisions and actions", "how it influenced your leadership style and life path", "how it will shape contributions and growth at McCombs"],
    notes=[
        ("Work backwards from the leadership story you most want readers to know, ideally one where you questioned the status quo, then name the value it shows.", "al-mccombs"),
        ("Use one or two quick later examples to show the value recurs, then the McCombs contribution that matches it.", "al-mccombs"),
        ("Show the value through the decision it forced (what it cost, what the easy path was), never by defining the value.", "admitstory-coach"),
    ])
P.optional("optional",
    "Please explain any gaps in work experience, choice of recommender, and/or academic performance issues that may help the admission committee in reviewing your application.",
    ("words", 250), "mccombs-apply", ["OPTIONAL"], required=False,
    parts=["gaps, recommender choice or academic issues"],
    notes=[
        ("McCombs: it 'is not designed for you to tell us more about your extracurricular activities'. If your recommender isn't your direct supervisor, explain why here.", "mccombs-blog-essays"),
        ("Without coursework in calculus, statistics, accounting or finance, or with a weak score, say how you'll prepare for the quantitative rigour.", "al-mccombs"),
    ])
P.short("test_waiver_petition",
    "A brief statement highlighting the merits of your request (200 words or less)",
    ("words", 200), "mccombs-waiver", ["OPTIONAL"], required=False,
    parts=["academic evidence", "analytical work evidence"],
    notes=[
        ("Eligibility needs both strong performance in an analytical degree (ideally GPA 3.0+) and at least three years of progressive analytical work; submit at least 10 days before applying, with a resume and transcripts.", "mccombs-waiver"),
        ("Highlight a few strong quant courses (calculus, statistics, quant business) rather than listing every grade, and describe analytical work in plain business terms tied to MBA coursework, not jargon.", "al-mccombs"),
        ("A waiver may help admission but a strong score helps scholarships; admits without a valid score must take the paid one-week Accelerated Foundations Program.", "mccombs-waiver"),
    ])
P.reapplicant(essay=None, policy=[
    ("Reapplicants submit new essays, an updated resume, the current video assessment and the fee; a new recommendation is optional. The key question to answer: 'Since your previous application, what steps have you taken to enhance your candidacy?'", "mccombs-blog-reapply"),
    ("Show what changed and what it taught you; refine, don't reverse, the career vision.", "al-mccombs"),
])
P.video("mccombs-apply", "async_video", answer=90, attempts=1, scripting=False, qtypes=[
    ("Required for all applicants shortly after submitting, with seven days to complete: six prompts of up to 90 seconds each; two are viewed but not scored. Kira platform, desktop or laptop only; unlimited practice but one attempt per question.", "mccombs-apply"),
    ("Evaluated themes: communication, adaptability and resilience, leadership and ambition, clear goals, empathy and inclusivity, personal interests, professionalism and poise. Sample: 'Tell us about your most significant leadership experience.'", "mccombs-blog-video"),
    ("Prepare: long- and short-term goals plus a plan B; a failure or adapting-to-the-unexpected story; an empathy or inclusion story; a leadership story; a short resume walk-through with a hobby; why McCombs woven into why an MBA.", "al-mccombs"),
])
P.todo.append("application.video[0].think_time_s: not published")
P.recs("mccombs-apply", 1, "school_specific", questions=[
    ("Please provide a brief description of your interaction with the applicant, and if applicable, the applicant's role in your organization.", "words", 50),
    ("How does the performance of the applicant compare to that of other well-qualified individuals in similar roles? For example, what are the applicant's principal strengths?", "words", 500),
    ("Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.", "words", 500),
    "Is there anything else we should know about the applicant?",
], notes=[("One recommendation from someone who supervised or assessed your work; professional recommenders strongly recommended; competency ratings plus three questions (500-word limits are recommended).", "mccombs-apply")])
P.resume("mccombs-apply", 2, notes=[("No page limit is stated for the application resume (the waiver petition asks for one to two pages); typically two years of full-time post-bachelor's experience are required.", "mccombs-apply", 0.7)])
P.add("application.test_policy", [
    ("GMAT, GMAT Focus, GRE or EA required unless waived (approved waiver, a 5+-year-old expired score, or dual degree); no minimum, no preferred test. Superscores considered for quant readiness.", "mccombs-apply"),
])
P.add("application.fees_waivers", [("A separate US$85 Re Vera employment-verification fee is required; the fee invoice arrives one to two days after submission.", "mccombs-apply")])
P.todo.append("application.fees_waivers: the application fee amount and waiver criteria")

P.add("values.stated", [
    ("McCombs students 'navigate challenges with a growth mindset, embrace unique perspectives, and thrive in collaborative environments.'", "mccombs-apply"),
    ("The admissions committee weighs academic aptitude, work experience and leadership potential, motivation for choosing McCombs, and support network, with no fixed weights.", "mccombs-blog-recipe"),
    ("Traits McCombs names: brave and pioneering, innovative and enterprising, dynamic and resilient, open-minded and collaborative, down-to-earth and optimistic.", "mccombs-blog-recipe"),
])
P.value("brave and pioneering; innovative and enterprising", ["originates_ideas", "acts_unasked"])
P.value("dynamic and resilient", ["resilient", "steady_in_ambiguity"], ("Resilience is a distinctive emphasis: a setback you came back from is strong material.", "al-mccombs"))
P.value("open-minded and collaborative", ["brings_people_along", "empathetic"])
P.value("down-to-earth and optimistic", ["community_builder", "self_aware"])
P.add("insider_notes", [
    ("Most applicants with under two years of work experience aren't competitive.", "mccombs-blog-recipe"),
    ("Class of 2027 (latest profile): 235 students; GMAT Focus median 655 (middle 80% 615–695), GRE median 319, EA median 155, GPA median 3.53; six years' average experience; 31% international; 15% military.", "mccombs-profile"),
    ("McCombs warns that admissions readers are skilled at spotting insincere, generic or AI-generated content.", "mccombs-blog-essays"),
    ("Start essays at least six to eight weeks before the deadline.", "mccombs-blog-essays"),
])
P.add("culture_and_location", [
    ("Rowling Hall is ten blocks from downtown Austin, which McCombs calls one of the most dynamic and innovative US cities; 72% of the Class of 2025 stayed in Texas.", "mccombs-academics"),
    ("A small, team-based culture where you'll work in many group projects.", "al-mccombs", 0.6),
])
P.add("academics.structure", [
    ("20+ concentrations, 14 STEM-certified, including Artificial Intelligence, Healthcare, CleanTech, Entrepreneurship, Business Analytics, Brand & Product Management, High Tech Marketing and Strategy & Innovation; students can take more than one.", "mccombs-academics"),
    ("STEM designation through defined pathways (for example Financial Mathematics or Management Sciences/Quantitative Methods).", "mccombs-academics", 0.75),
])
P.thing("academics.experiential", "McCombs+", "Co-curricular experiential and global programs: 8–10-week micro-consulting projects, one-on-one professional coaches and workshops.", "mccombs-academics", why=["career switchers", "hands-on proof"], url=G + "/academics/experiential-learning/")
P.thing("academics.experiential", "Hildebrand leadership coaching", "Leadership framework with two pillars, character and credibility; Hildebrand Leadership Fellows (self-paced) and courses such as Leading People and Organizations.", "mccombs-academics", why=["leadership growth"], url=G + "/academics/hildebrand-leadership-coaching/")
P.thing("academics.experiential", "Fellows programs", "Health Innovation Fellows, CleanTech Fellows, Venture Fellows (VC/PE internships), Marketing, Operations and Sports Fellows, Golub Capital Nonprofit Board Fellows, Wall Street for McCombs.", "mccombs-academics", why=["health care, climate, VC and finance goals"], url=G + "/student-experience/fellows-groups-and-funds/")
P.thing("academics.experiential", "MBA Investment Fund", "About 40 student investors managing roughly US$17 million; also real estate funds.", "mccombs-academics", why=["investment management goals"], url=G + "/student-experience/fellows-groups-and-funds/")
P.thing("academics.experiential", "Global Connections and Patagonia leadership course", "Spring courses with a one-to-two-week trip abroad, a NOLS leadership course in Patagonia, short exchanges and semester exchanges with 13 partners.", "mccombs-academics", why=["international goals"], url=G + "/academics/global-studies/")
P.todo.append("community.clubs: verify specific McCombs clubs")

P.employment("mccombs-employment-2025", 2025, [
    ("Consulting", 0.30, 189000), ("Investment Banking", 0.10, 175000), ("Operations & Logistics", 0.09, 140000), ("Other Marketing", 0.09, 140000),
    ("Product Management", 0.05, 178500), ("Corporate Finance", 0.05, 130000), ("Asset Management", 0.05, 150000), ("Product Marketing", 0.04, 145950)],
    [], intl=("Non-permanent-work-authorization graduates: 68.6% had an offer by three months; international median base US$165,000.", "mccombs-employment-2025"))
P.add("careers.recruiting_notes", [
    ("Class of 2025: average base US$154,053, average signing bonus US$34,279; 74.6% had offers and 72.1% had accepted by three months.", "mccombs-employment-2025"),
    ("By industry: consulting 28%, technology 22%, financial services 19%, energy 6%, healthcare 6%, retail 5%. 56% of full-time offers came from internship conversions.", "mccombs-employment-2025"),
])
P.todo.append("careers.employment_report.top_employers: from the full PDF")
P.class_profile("mccombs-profile", 2027, size=235, gmat_focus=655, gpa=3.53, intl=0.31)

P.interview("mccombs-blog-interview", "open", ["student"], None, 30, ["virtual"],
    questions=[("Tell us about your most significant leadership experience.", "mccombs-blog-video", 4), ("Why an MBA, and why McCombs? (clear goals theme)", "mccombs-blog-video", 4),
               ("Tell us about a time something did not go to plan and you had to adapt. (adaptability and resilience theme)", "mccombs-blog-video", 3)],
    notes=[
        ("All full-time applicants are encouraged but not required to complete a 20–30-minute virtual, behavioural interview with a student on the Ambassador Committee; it can be done after submitting, even after the deadline.", "mccombs-apply"),
        ("The interview assesses motivation, collaboration and preparedness.", "mccombs-blog-interview"),
        ("Treat the optional interview as required. Bring a 2–3-minute introduction, a strong story you couldn't fit elsewhere, and one positive question at the end.", "al-mccombs"),
    ])
P.ai("mccombs-blog-essays", "limited", ["essays"], notes=[
    ("'While you may use AI tools for research or grammar checking, all submitted text must be written by you and reflect your voice and experiences.'", "mccombs-blog-essays")])
P.add("scholarships", [
    ("Hildebrand Scholars receive significant scholarship support; Dean Lillian Mills: 'We're investing in future CEOs and founders.'", "mccombs-academics"),
    ("A test waiver may make you a weaker scholarship candidate, since awards often reward strong scores.", "al-mccombs"),
])
P.add("avoid", [
    ("Generic school praise or an essay recycled from another school.", "mccombs-blog-essays"),
    ("Using the optional statement for extracurriculars.", "mccombs-blog-essays"),
    ("Skipping the optional student interview.", "al-mccombs"),
    ("Jargon in the waiver petition (simulations and distributions) instead of business language.", "al-mccombs"),
])
P.add("angles_that_work", [
    ("Essay 1 opened as a scene on the eve of the first post-MBA job, looking back on one concentration, one fellows program or McCombs+ project, and one contribution.", "mccombs-blog-essays"),
    ("Essay 2 built from a leadership moment where the applicant challenged the status quo at a cost, with a later example showing the value holds.", "al-mccombs"),
    ("A resilience story in the video set, since resilience is one of McCombs' named traits.", "mccombs-blog-recipe"),
])
P.term("McCombs+", "McCombs' co-curricular experiential programs (micro-consulting, coaching, workshops).", "mccombs-academics")
P.term("Rowling Hall", "The McCombs graduate business building in Austin.", "mccombs-academics")
P.write()
