import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("usc-marshall", "USC Marshall School of Business", "Marshall", "US", "Los Angeles, CA", "https://www.marshall.usc.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
F = "https://www.marshall.usc.edu/programs/graduate-programs/mba-programs/full-time-mba"
P.source("marshall-admissions", "official", "USC Marshall Full-Time MBA: Admissions (requirements, deadlines, FAQ)", F + "/admissions")
P.source("marshall-profile", "official", "USC Marshall Full-Time MBA: Class profile (entering 2025) and Class of 2025 outcomes", F + "/class-profile")
P.source("marshall-program", "official", "USC Marshall Full-Time MBA: program overview, tuition and fees", F)
P.source("marshall-global", "official", "USC Marshall: Global opportunities (PRIME)", "https://www.marshall.usc.edu/why-marshall/global-opportunities")
P.source("mbamission-marshall-2026", "press", "mbaMission: USC Marshall essay tips 2026-2027 (Aug 17, 2026), quoting the prompts", "https://www.mbamission.com/blog/how-to-get-into-marshall-school-of-business-usc-marshall-essay-tips-and-examples/")
P.source("ca-marshall-reports", "interview_reports", "Clear Admit USC Marshall interview reports", "https://www.clearadmit.com/interview-reports/usc-marshall-interview-questions-report-round-1-adcom-zoom/", read=False)
P.source("al-marshall", "third_party_reference", "ApplicantLab — USC Marshall school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", F + "/admissions"); P.url("deadlines", F + "/admissions"); P.url("class_profile", F + "/class-profile")

for name, dl, dec in [("Round 1", "2026-10-15", "2026-12-15"), ("Round 2", "2027-01-05", "2027-03-31"), ("Round 3", "2027-03-01", "2027-05-15"), ("Round 4", "2027-04-15", "2027-06-15")]:
    P.round(name, dl, "marshall-admissions", decision=dec)
P.add("rounds[3].notes", [("After 15 April 2027 applications are reviewed first come, first served, as space allows.", "marshall-admissions")])

P.essay("career_goals",
    "What are your short-term and long-term career goals, and how will an MBA from USC Marshall help you achieve those goals? Short-term career goals should be those you want to achieve within 3-5 years post-MBA, whereas long-term goals may span a decade or more and encompass broader professional aspirations.",
    ("words", 400), "mbamission-marshall-2026", ["GOALS", "WHY-SCHOOL"],
    parts=["short-term goals (3–5 years post-MBA)", "long-term goals (a decade or more)", "how a Marshall MBA helps you achieve them"],
    notes=[
        ("Note the unusual definition: 'short-term' means three to five years after the MBA, not the first job, so describe a stage of career rather than a single title.", "admitstory-coach"),
        ("A standard statement of purpose: the long-term hook and why it matters to you, the short-term role and the experience that makes you hireable, then why Marshall fills the gap.", "al-marshall"),
        ("Name about three electives, each with a specific future use; generic lines like 'consumer marketing will help me market to consumers' could come from anyone. Certificates need a separate application, so say you'd apply.", "al-marshall"),
        ("Name one club where you'd contribute something concrete (for example running the budget as VP of Finance), not 'seek a leadership role'. Marshall's alumni culture, the Trojan Family, prizes energetic, lifelong involvement.", "al-marshall"),
        ("Mention PRIME by region and real career reason, not a specific destination, since trips change each year. Students can take electives at other USC graduate schools (engineering, film) if they truly serve the goal.", "al-marshall", 0.7),
        ("At 400 words there's room for one opening scene; keep background under about 15% and land on what the goal means for people, not a summary.", "admitstory-coach"),
    ])
P.optional("additional_information",
    "Please use this space to share any additional information about yourself that cannot be found elsewhere in your application and that you would like the Admissions Committee to consider when reviewing your candidacy for the MBA program. Reapplicants should provide any profile updates since your previous application.",
    ("words", 500), "mbamission-marshall-2026", ["OPTIONAL", "IDENTITY"], required=False,
    parts=["additional information not elsewhere in the application", "reapplicants: profile updates since the last application"],
    notes=[
        ("Optional for new applicants, required for reapplicants. Marshall's FAQ also asks second-MBA applicants to explain why here.", "marshall-admissions"),
        ("With only one required essay and no recommendations, 500 words is the one place to show the person and how you work with others. A short, real story about collaboration or character can earn its place, as long as it isn't repeated elsewhere.", "admitstory-coach"),
        ("Use it first for anything that needs explaining (grades, gaps, scores), briefly and factually, with the better evidence.", "al-marshall"),
    ])
P.todo.append("application.essays: confirm both prompts verbatim in the Liaison portal (Marshall doesn't publish them; wording from a dated August 2026 summary)")
P.reapplicant(essay=None, policy=[
    ("Reapplicants use the additional-information essay to explain what has changed since the previous submission.", "marshall-admissions"),
    ("Say what changed and what it taught you, how the goal sharpened, and how you'll now add more to classmates.", "al-marshall"),
])
P.add("application.test_policy", [
    ("Test optional: GMAT or GRE scores may be submitted but aren't required; no minimum; either accepted.", "marshall-admissions"),
    ("TOEFL or IELTS is required for most international applicants (US permanent residents and English-medium bachelor's degrees exempt).", "marshall-admissions", 0.75),
])
P.add("application.fees_waivers", [("No application fee: Marshall says it wants to assess every serious candidate regardless of ability to pay.", "marshall-admissions")])
P.form("recommendations_none", "Letters of recommendation", "marshall-admissions", guidance=[
    ("Marshall neither requires nor accepts letters of recommendation, so the resume and essays carry the evidence a recommender usually would.", "marshall-admissions")])
P.resume("marshall-admissions", 1, notes=[
    ("A professional resume is required; no length rule is published, so one page is the safe default. Marshall recommends at least two years of work experience.", "marshall-admissions", 0.7),
])
P.todo.append("application.resume.page_limit: not published; 1 is a default")

P.add("values.stated", [
    ("Marshall's admissions page emphasises a serious interest in the program and the Trojan network; with no recommendations, the essays and resume are the main evidence of fit.", "marshall-admissions", 0.6),
])
P.value("Trojan Family: energetic lifelong community", ["community_builder", "brings_people_along"], ("Show you'll contribute to clubs as a student and stay involved as an alum.", "al-marshall"))
P.value("collaboration", ["brings_people_along", "empathetic"], ("Marshall recently ran a teamwork essay; collaboration still matters even though the prompt was dropped for 2026-27.", "al-marshall", 0.6))
P.add("insider_notes", [
    ("Entering class of 2025 (Class of 2027): 1,914 applications, 31% accepted, 176 enrolled; average GMAT 742, average GRE 322, average GPA 3.55; six years' average experience; 31% women; 43% international.", "marshall-profile"),
    ("Marshall gives no pre-application feedback, accepts international GPAs without conversion, and needs both original and translated transcripts.", "marshall-admissions"),
])
P.add("culture_and_location", [
    ("A two-year, in-person program in Los Angeles that starts with Career Launchpad, a week-long immersion; it uses a practice-group career model and a Leadership Fellows program.", "marshall-program", 0.75),
])
P.thing("academics.experiential", "PRIME (GSBA 580, Global Context of Business)", "A mandatory first-year course applying international business frameworks to a specific country, with consulting projects for multinational companies and government institutions.", "marshall-global", why=["international goals", "the why-Marshall paragraph"], url="https://www.marshall.usc.edu/why-marshall/global-opportunities")
for name in ["Lloyd Greif Center for Entrepreneurial Studies", "Brittingham Social Enterprise Lab", "Center for Global Innovation", "Center for Investment Studies", "Neely Center for Ethical Leadership and Decision Making", "Randall R. Kendrick Global Supply Chain Institute", "Andrew Tavakoli Center for Real Estate", "Initiative on Digital Competition"]:
    P.thing("academics.centers", name, "A USC Marshall center or institute listed on the school's site.", "marshall-program", why=[], url="https://www.marshall.usc.edu")
P.todo.append("academics: core structure, concentrations, certificates, STEM option and cross-school elective rules from official pages")
P.todo.append("community.clubs: verify specific clubs")

P.add("careers.recruiting_notes", [
    ("Class of 2025: 71% employed within 90 days; average salary US$142,184 and average signing bonus US$35,896 (averages, not medians).", "marshall-profile"),
    ("Average starting salary by industry: consulting US$167,211, financial services US$148,744, technology US$136,056, entertainment US$117,667.", "marshall-profile"),
])
P.todo.append("careers.employment_report: medians, industry and function shares, top employers")
P.class_profile("marshall-profile", 2027, size=176, intl=0.43)

P.interview("ca-marshall-reports", "invite_only", ["adcom"], None, 30, ["virtual", "campus"], notes=[
    ("Applicants report interviews with admissions staff, on Zoom or on campus.", "ca-marshall-reports", 0.5)])
P.todo.append("interview: verify invitation policy, interviewer, blind or not, length and common questions")
P.ai("marshall-admissions", "unknown", notes=[("No statement on applicant AI use was found on Marshall's admissions pages.", "marshall-admissions", 0.7)])
P.add("scholarships", [("Every admit is automatically considered for merit scholarships; Consortium, Schoen veterans and ROMBA awards also exist.", "marshall-program")])
P.add("avoid", [
    ("Generic elective lines any applicant could write.", "al-marshall"),
    ("'I will seek a leadership role in X club' with no concrete contribution.", "al-marshall"),
    ("Treating 'short-term' as only the first job after graduation.", "admitstory-coach"),
])
P.add("angles_that_work", [
    ("A goals essay where each Marshall resource (an elective, PRIME, a center) is tied to a specific future task, plus one concrete club contribution from your past.", "al-marshall"),
    ("A collaboration story in the additional-information essay, since nothing else in the file shows how you work with people.", "admitstory-coach"),
])
P.term("Trojan Family", "USC's name for its alumni network.", "marshall-admissions")
P.term("PRIME", "Marshall's required first-year global course with an international project.", "marshall-global")
P.write()
