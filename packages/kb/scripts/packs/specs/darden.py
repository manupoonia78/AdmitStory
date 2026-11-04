import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("uva-darden", "University of Virginia Darden School of Business", "Darden", "US", "Charlottesville, VA", "https://www.darden.virginia.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
B = "https://www.darden.virginia.edu"
P.source("darden-guidelines", "official", "Darden Full-Time MBA: Application guidelines (format, video essay, recommendation, resume, tests, fee)", B + "/mba/admissions/apply/guidelines")
P.source("darden-deadlines", "official", "Darden Full-Time MBA: Deadlines (Class of 2029)", B + "/mba/admissions/apply/deadlines")
P.source("darden-ea", "official", "Darden Full-Time MBA: Early Action", B + "/mba/admissions/apply/early-action")
P.source("darden-interviews", "official", "Darden Full-Time MBA: Interviews", B + "/mba/admissions/apply/interviews")
P.source("darden-reapplicant", "official", "Darden Full-Time MBA: Reapplicants", B + "/mba/admissions/apply/reapplicant")
P.source("darden-faq", "official", "Darden Full-Time MBA: Admissions FAQ", B + "/mba/admissions/faq")
P.source("darden-employment-2025", "official", "UVA Darden Class of 2025 Full-Time MBA Employment Outcome Data (PDF)", B + "/sites/default/files/2025-11/UVA%20Darden%20Class%20of%202025%20FT%20Employment%20Outcome%20Data_web.pdf")
P.source("darden-careers", "official", "Darden: Employment data page (top hiring companies)", B + "/mba/career-support/employment-data")
P.source("darden-scholarships", "official", "Darden scholarships: Batten Scholars, Jefferson Fellowship, Worldwide Scholarship", B + "/mba/tuition-financial-aid/scholarships")
P.source("darden-academics", "official", "Darden: learning experience and concentrations", B + "/mba/academics/learning-experience")
P.source("darden-blog-video", "adcom", "Darden admissions blog: How to approach the Darden MBA video essay with confidence (Oct 1, 2026)", B + "/programs/blog/how-approach-darden-mba-video-essay-confidence")
P.source("darden-blog-dean", "official", "Darden blog: Why Darden — Dean Yael Grushka-Cockayne discusses our next chapter (Oct 22, 2026)", B + "/programs/blog/why-darden-dean-yael-grushka-cockayne-discusses-our-next-chapter")
P.source("sb-darden-2026", "press", "Stacy Blackman: Darden MBA Essays for the Class of 2029 (Jun 30, 2026), quoting Darden's 2026-27 application preview", "https://www.stacyblackman.com/blog/university-virginia-darden-mba-essays/")
P.source("al-darden", "third_party_reference", "ApplicantLab — Darden school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", B + "/mba/admissions/apply/guidelines"); P.url("deadlines", B + "/mba/admissions/apply/deadlines")
P.url("class_profile", B + "/mba/admissions/class-profile"); P.url("employment_report", B + "/mba/career-support/employment-data")
P.url("other", B + "/mba/admissions/apply/interviews")

P.round("Early Action", "2026-09-09", "darden-deadlines", decision="2026-10-28", invites="Limited open interviews 24 Aug–8 Sep 2026; then by invitation 17 Sep–28 Oct", notes=[
    ("Binding and non-binding Early Action. Darden says EA offers tend to be more generous, and every EA applicant is assessed for merit scholarships. Binding deposit US$6,000 by 30 Nov 2026; non-binding US$4,000 by 30 Nov plus US$2,000 by 8 Feb 2027.", "darden-ea"),
    ("Open EA interviews are virtual, first come first served and not guaranteed. Booking one needs a started EA application, resume, the 'Relationships Matter Here' answer and a verified test score; you can interview before submitting.", "darden-ea"),
    ("If Darden is your clear first choice, apply binding; if it's one of several top choices, use non-binding and be honest about it.", "al-darden"),
    ("International applicants should apply in EA to be considered for a Jefferson Fellowship nomination.", "darden-scholarships"),
])
P.round("Round 1", "2026-10-07", "darden-deadlines", decision="2026-12-09", notes=[("Interviews by invitation; deposits US$2,000 by 15 Feb and US$2,000 by 19 Apr 2027. Jefferson Fellowship nominations come from EA and R1.", "darden-deadlines")])
P.round("Round 2", "2027-01-07", "darden-deadlines", decision="2027-03-17", notes=[("Historically most applicants apply in Round 2. With each deadline, fewer seats and less scholarship money remain.", "darden-faq")])
P.round("Round 3 – March", "2027-03-01", "darden-deadlines", decision="2027-04-02")
P.round("Round 3 – April", "2027-04-01", "darden-deadlines", decision="2027-05-05")
P.round("Round 3 – May", "2027-05-01", "darden-deadlines", decision="2027-05-28")

P.essay("relationships_matter_here",
    "What would you want your classmates to know about you that is not on your resume?",
    ("words", 200), "sb-darden-2026", ["IDENTITY"],
    parts=["something classmates should know", "not on the resume", "(implied) why it matters to them"],
    notes=[
        ("Framed by 'At Darden, learning is personal': who you are — interests, passions, curiosities, ideas — matters in a case classroom where students teach each other.", "sb-darden-2026"),
        ("Darden's own advice: approach the application as storytelling, prioritise examples that show the authentic person, and 'show don't tell'.", "darden-faq"),
        ("One to three things under an umbrella, built around one key story; go below the surface: why you got involved, why it matters to you, and why classmates should care.", "al-darden"),
        ("With no explicit leadership essay this cycle, an extracurricular leadership story is the strongest material here: the resume has the numbers, this essay has the story behind them.", "al-darden"),
        ("Include at least one serious or significant thing, not only fun facts. Something mentioned on the resume can appear if this goes much deeper. The essay should show you invest in relationships for the long haul.", "al-darden"),
        ("A work-context story is fine if it's about people (a grieving team, a difficult client won over), never 'a project I managed'.", "al-darden"),
    ])
P.essay("careers_with_purpose",
    "At this time how would you describe your short-term, post-MBA goal in terms of industry, function, geography, company size and/or mission and how does it align with the long-term vision you have for your career?",
    ("words", 200), "sb-darden-2026", ["GOALS"],
    parts=["short-term goal: industry and function", "geography, company size and/or mission", "alignment with the long-term vision"],
    notes=[
        ("Framed by Darden's Career Center: personalised coaching across industries, functions and geographies, and career support for life.", "sb-darden-2026"),
        ("Darden says the most compelling applications connect past decisions to future goals.", "darden-faq"),
        ("Open on the long-term 'why' rather than answering the prompt in order; then the role, the type of company defined by the problem it solves, and two example employers.", "al-darden"),
        ("Use the 'and/or': geography, size and mission aren't all mandatory, but include at least one. Make one target employer one that hires Darden graduates or sits in the Virginia–DC corridor. International students should be careful naming startups that can't sponsor visas.", "al-darden"),
        ("Say what the job will teach you, more than which title at which company. Switchers should show their transferable skills and, ideally, evidence from someone who made the same move.", "al-darden"),
    ])
P.todo.append("application.essays: confirm both short-answer prompts verbatim in the 2026-27 portal (public pages name only 'Relationships Matter Here'; wording here is from a June 2026 summary of Darden's announcement)")
P.optional("additional",
    "If there is further information you believe would be helpful to the Admissions Committee, please provide it.",
    ("words", 250), "sb-darden-2026", ["OPTIONAL"], required=False,
    parts=["further information"],
    notes=[
        ("Darden calls Additional Comments 'not an additional essay, just a place to connect the dots': be brief, make the point and give action items where appropriate.", "darden-guidelines"),
    ])
P.reapplicant(essay=None, policy=[
    ("Reapplicants complete the short answers, a reapplicant short answer, an updated resume and one new recommendation; 2025-26 reapplicants get a fee waiver.", "darden-reapplicant"),
    ("Name what changed and what it taught you; show the career vision is sharper and how you've engaged with Darden since.", "al-darden"),
])
P.todo.append("application.reapplicant.essay: prompt wording and limit")
P.video("darden-guidelines", "async_video", think=10, answer=90, attempts=1, scripting=False, qtypes=[
    ("New for 2026-27: one randomly drawn question from a pool written by the Admissions Committee; 10 seconds to prepare, 90 to record, no pausing. Darden says 'lead with authenticity'.", "darden-guidelines"),
    ("Merav Frazier, Senior Associate Director of Global Recruitment: 'make your main point, give a brief example, and end with a takeaway.'", "darden-blog-video"),
    ("Expect leadership, community or why-Darden questions; prepare talking points for each, not scripts.", "al-darden", 0.55),
])
P.todo.append("application.video[0].attempts: confirm (1 assumed from 'no pausing'; retakes not stated)")
P.recs("darden-guidelines", 1, "school_specific", questions=[
    "Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's role in your organization.",
    "How does the performance of the applicant compare to that of other well-qualified individuals in similar roles?",
    "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
], notes=[("One required (a second optional if it adds new insight), from someone who has supervised you professionally; a competency ratings grid plus short answers. Academic letters are less helpful.", "darden-guidelines")])
P.resume("darden-guidelines", 1, notes=[
    ("One page is sufficient under ten years' experience; quantify impact and leadership. Darden encourages personal items: hobbies, books, podcasts, countries visited.", "darden-guidelines"),
    ("Interviews are blind, but personal lines on the resume give classmates and recruiters something to talk about later.", "admitstory-coach", 0.6),
])
P.add("application.test_policy", [
    ("GMAT (any edition), GRE, EA, MCAT or LSAT, no preference; GMAT superscores accepted; report all valid scores; verified score due within a week of the deadline; no minimum GMAT, GRE or GPA.", "darden-guidelines"),
    ("Test waivers case by case, weighing academic and professional accomplishment; a 'strong' undergraduate record means above the class average (about 3.5); apply three to four weeks before the deadline.", "darden-faq", 0.75),
    ("In the waiver form's job description, emphasise quantitative work (messy data, analysis) and, for non-native speakers, communication — the opposite of the leadership emphasis in the main application.", "al-darden"),
])
P.add("application.fees_waivers", [
    ("US$250 non-refundable; US$100 off for Darden webinars or off-site events, US$150 off for events in Charlottesville or Rosslyn (1 May 2026–1 May 2027).", "darden-guidelines"),
    ("Full waivers: 2025-26 reapplicants, US military, current and recent government employees, national-service alumni, first-generation students, UVA alumni and graduate students, and alumni of Virginia colleges.", "darden-guidelines"),
])
P.add("values.stated", [
    ("Darden evaluates academics, professional experience, and personal qualities and characteristics; at least two committee members read every file.", "darden-faq"),
    ("What makes an application stand out: 'a strong academic foundation, demonstrated leadership and a well-articulated narrative'.", "darden-faq"),
    ("Darden's 2026-27 refresh is built on 'Relationships are central to the Darden experience'.", "sb-darden-2026"),
])
P.value("relationships and community", ["community_builder", "brings_people_along", "empathetic", "develops_people"], ("A small, tight-knit class in learning teams of five or six; show you build and keep relationships.", "al-darden"))
P.value("learning from others in the case method", ["curious_learner", "unusual_path"], ("Show you'll speak up with a perspective others lack and learn from theirs.", "al-darden"))
P.value("leadership with initiative and courage", ["acts_unasked", "principled_stands"], ("Where a story involved risk (backing someone others shunned, challenging the room), say what was risky.", "al-darden"))
P.add("culture_and_location", [
    ("Charlottesville campus with a DC-area site in Rosslyn (UVA Darden DC Metro) for part-time and executive programs and admissions events.", "darden-academics"),
    ("Most students live close together and study in sections and learning teams, so the culture runs on supportiveness.", "al-darden", 0.6),
])
P.add("insider_notes", [
    ("Darden's admissions team suggests testing your answers on friends without telling them the prompts, to see whether they can guess them.", "darden-faq"),
    ("Willie Green leads admissions (titled both Senior Assistant Dean and Director of Admissions on Darden's site); the dean is Yael Grushka-Cockayne.", "darden-blog-dean", 0.7),
    ("Darden offers short calls with the admissions team; use them for a substantive question about how your background fits, not anything on the website. Contact one or two student ambassadors at most, chosen for a reason.", "al-darden", 0.65),
    ("If Darden is your first choice but you applied after Early Action, say so somewhere in the application, briefly.", "al-darden", 0.6),
])
P.add("academics.structure", [
    ("Case method throughout: students teach each other while the professor conducts. First-years stay with a section and a learning team of five or six through the core, with spring electives before the internship.", "darden-academics"),
    ("Concentrations (unlimited, not on the transcript): career tracks in finance, entrepreneurship and innovation, marketing, real estate, strategy consulting, supply chain; theme tracks in AI, Data Analytics and Decision Sciences, and ESG.", "darden-academics"),
    ("The Management Science Specialization (12 credits) carries a STEM designation, giving eligible F-1 students up to 36 months of US work authorisation; it's the only one on the transcript.", "darden-academics"),
])
P.thing("academics.courses", "AI, Data Analytics and Decision Sciences concentration", "About 25 electives drawing on the Batten Institute and the LaCross AI Institute.", "darden-blog-dean", why=["tech, product and analytics goals"], url=B + "/mba/academics/concentrations")
P.thing("academics.experiential", "Darden Worldwide Courses (Batten Foundation Worldwide Scholarship)", "The scholarship covers the program fee for one Darden Worldwide Course for every full-time student (or travel for an exchange or Global Client Project).", "darden-scholarships", why=["international goals"], url=B + "/mba/tuition-financial-aid/scholarships/darden-worldwide-scholarship-program")
P.thing("academics.centers", "Batten Institute", "Darden's centre for entrepreneurship, innovation and technology; runs the Batten Scholars program.", "darden-scholarships", why=["founders", "innovation and tech goals"], url=B + "/mba/tuition-financial-aid/scholarships/competitive-scholarships/batten-scholars")
P.thing("academics.centers", "LaCross AI Institute", "Darden's AI institute, feeding the AI and analytics concentration.", "darden-blog-dean", why=["AI goals"], url=B + "/mba/academics/concentrations")
P.todo.append("academics: health care offerings and core course list; community.clubs: verify specific clubs")

P.employment("darden-employment-2025", 2025, [
    ("Consulting", 0.394, 190000), ("Finance/Accounting", 0.305, 175000), ("General Management", 0.137, 135000),
    ("Marketing/Sales", 0.072, 141500), ("Operations/Logistics", 0.045, 143900), ("Information Technology", 0.031, 142800)],
    ["Amazon", "Barclays", "BCG", "J.P. Morgan Chase", "McKinsey", "PwC/Strategy&", "American Express", "Accenture", "Emerson", "Bain & Company"],
    intl=("Non-permanent-work-authorization graduates: 87.6% had an offer by three months (70.5% by graduation), with the same US$175,000 median base.", "darden-employment-2025"))
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$175,000, median signing bonus US$30,000; 90.2% had offers and 89.3% had accepted by three months.", "darden-employment-2025"),
    ("By industry: consulting 37.3% (US$190,000), financial services 26.0% (US$175,000), technology 16.1% (US$142,800), CPG 3.8%, healthcare 3.1%, retail 3.1%. 98% of jobs were in North America.", "darden-employment-2025"),
    ("70.5% of accepted jobs came through school-facilitated channels, 48.3% from internship conversions.", "darden-employment-2025"),
])
P.todo.append("class_profile: Class of 2028 numbers (the profile page loads them by script; still labelled Class of 2027)")

P.interview("darden-interviews", "invite_only", ["adcom", "student"], True, 45, ["campus", "virtual"], notes=[
    ("Required before admission; up to 45 minutes; anonymous — the interviewer hasn't read the application or the resume. Admissions staff or second-years, weighted equally.", "darden-interviews"),
    ("Rounds 1–3 are by invitation after review, rolling until the decision date; timing carries no significance. Early Action has a limited open-interview window.", "darden-interviews"),
    ("Because the interviewer knows nothing, come ready to tell your whole story concisely and to give vivid examples on teamwork, leadership and why Darden.", "admitstory-coach"),
])
P.ai("darden-guidelines", "unknown", notes=[("Darden's admissions pages don't address applicant AI use.", "darden-faq", 0.7)])
P.add("scholarships", [
    ("Every admit is considered for merit scholarships with no separate application (from a stipend to full tuition and fees); AccessDarden is need-based.", "darden-scholarships"),
    ("Batten Scholars (up to full tuition and fees): a 500-word essay on how you meet one track — entrepreneurship, innovation or technology — how you'd contribute to Darden, and how the award furthers your career; finalists interview at decision time.", "darden-scholarships"),
    ("For Batten, spend most words proving you've driven innovation, technology or ventures; keep the contribution part short and concrete.", "al-darden"),
    ("Darden Jefferson Fellowship: full tuition and fees, health insurance and a US$20,000 stipend; nominees come from EA and R1 and attend a case discussion and panel interview.", "darden-scholarships"),
])
P.add("avoid", [
    ("Answering the careers question point by point in the order asked; start with the purpose.", "al-darden"),
    ("Naming tech employers with unrelated business models ('Apple, Netflix or Google').", "al-darden"),
    ("Only fun facts in 'Relationships Matter Here', or a resume project dressed as a personal story.", "al-darden"),
    ("Using Additional Comments as another essay.", "darden-guidelines"),
])
P.add("angles_that_work", [
    ("'Relationships Matter Here' built on an extracurricular leadership story told through the people involved, closing on why classmates can count on you long after Charlottesville.", "al-darden"),
    ("A careers answer that opens on the purpose, defines the target company by the problem it solves, names two employers (one with Darden ties), and says what the job will teach.", "al-darden"),
    ("A video answer with one point, one short example and one takeaway, said conversationally.", "darden-blog-video"),
])
P.term("Learning team", "A group of five or six first-years from different sections who prepare cases together.", "darden-academics")
P.term("Grounds", "UVA's word for its campus.", "darden-interviews")
P.write()
