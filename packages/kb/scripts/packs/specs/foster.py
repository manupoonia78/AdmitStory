import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("uw-foster", "University of Washington Michael G. Foster School of Business", "Foster", "US", "Seattle, WA",
         "https://foster.uw.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are Admitstory rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
ADM = "https://foster.uw.edu/academics/degree-programs/full-time-mba/admissions/"
P.source("foster-admissions", "official", "Foster Full-time MBA: Admissions (essays, deadlines, interview, recommendations, resume, tests, fee, AI FAQ)", ADM)
P.source("foster-profile", "official", "Foster Full-time MBA: Class profile (Class of 2028)", "https://foster.uw.edu/academics/degree-programs/full-time-mba/class-profile/")
P.source("foster-employment-2025", "official", "Foster Full-time MBA Employment Report, Class of 2025 (PDF, Apr 2026)", "https://foster.uw.edu/wp-content/uploads/2026/04/2026-Full-Time-MBA-Employment-Report-4.29.26-r2.pdf")
P.source("foster-careers", "official", "Foster Full-time MBA: Career management", "https://foster.uw.edu/academics/degree-programs/full-time-mba/career-management/")
P.source("foster-curriculum", "official", "Foster Full-time MBA: Curriculum, Applied Strategy, certificates and specializations", "https://foster.uw.edu/academics/degree-programs/full-time-mba/curriculum/")
P.source("foster-centers", "official", "Foster centers", "https://foster.uw.edu/centers/")
P.source("foster-about", "official", "About the Foster School (purpose and shared commitments)", "https://foster.uw.edu/about-foster-school/")
P.source("foster-contact", "official", "Foster Full-time MBA: Contact us (admissions team)", "https://foster.uw.edu/academics/degree-programs/full-time-mba/contact-us/")
P.source("touch-town-2015", "adcom", "Touch MBA podcast #79: Erin Town, then Director of MBA Admissions, 'Take the Reins' (c. 2015)", "https://touchmba.com/foster-mba-admissions-interview/")
P.source("ca-foster-reports", "interview_reports", "Clear Admit Foster interview reports (2024–2026)", "https://www.clearadmit.com/interview-reports/school/foster")
P.source("al-foster", "third_party_reference", "ApplicantLab — Foster school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "Admitstory coaching canon and Manu's storytelling rules", None)

P.url("prompts", ADM); P.url("deadlines", ADM)
P.url("class_profile", "https://foster.uw.edu/academics/degree-programs/full-time-mba/class-profile/")
P.url("employment_report", "https://foster.uw.edu/wp-content/uploads/2026/04/2026-Full-Time-MBA-Employment-Report-4.29.26-r2.pdf")
P.url("ai_policy", ADM)

P.round("Round 1", "2026-10-01", "foster-admissions", decision="2026-12-18", notes=[("Deadline 11:59pm Pacific; enrollment deadline 4 February 2027.", "foster-admissions")])
P.round("Round 2", "2027-01-05", "foster-admissions", decision="2027-03-26", notes=[("Final deadline for international applicants; enrollment deadline 29 April 2027.", "foster-admissions")])
P.round("Round 3", "2027-03-23", "foster-admissions", decision="2027-05-14", notes=[("Domestic applicants only in practice (R2 is the international deadline); enrollment deadline 2 June 2027.", "foster-admissions", 0.8)])

P.essay("post_mba_plans",
    "Tell us your ideas about what lies ahead in your career. What are the gaps or deficiencies currently preventing you from pursuing these potential career paths? How do you plan to use your time in the Foster MBA program to fill these gaps and advance your career?",
    ("words", 750), "foster-admissions", ["GOALS", "WHY-SCHOOL"],
    parts=["what lies ahead in your career (potential paths)", "the gaps or deficiencies holding you back", "how you'll use the Foster MBA to fill them"],
    notes=[
        ("Foster recommends 550–750 words, double-spaced, 10- or 12-point professional font, with your full name and the essay title on each page; it uploads as the 'Statement of Purpose'.", "foster-admissions"),
        ("Foster says its most successful applicants use essays to share genuine motivations, stories and goals that create context around their MBA journey.", "foster-admissions"),
        ("The prompt says 'potential career paths', plural: a main path and a credible alternative read as realistic, as long as both sit in the same lane.", "admitstory-coach"),
        ("Name each gap honestly, show how you found it, and match it to one specific Foster resource (Applied Strategy, a certificate or specialization, a center) with a concrete use. Seattle employers in the goal make the location part of the answer.", "admitstory-coach"),
        ("Open on the moment the career direction took hold, keep background under about 15% of the words, and land on a forward beat rather than a summary.", "admitstory-coach"),
    ])
P.essay("mission_statement",
    "TOGETHER – WE FOSTER LEADERS, WE FOSTER INSIGHTS, WE FOSTER PROGRESS – TO BETTER HUMANITY. This is the Foster School's mission statement, and it serves as the north star for how we do business here. Please select one part of our mission statement and describe how it resonates with you in your personal or professional life. Please describe a specific experience in which you put this into practice.",
    ("words", 550), "foster-admissions", ["LEADERSHIP", "VALUES"],
    parts=["choose one part: leaders, insights or progress", "how it resonates with you", "a specific experience where you put it into practice"],
    notes=[
        ("Foster recommends 350–550 words; uploads as the 'Personal Statement'. The 2026-27 wording adds the explicit 'specific experience' requirement.", "foster-admissions"),
        ("Work backwards: start from the strongest leadership story, then choose the part of the mission it most plausibly shows. 'Leaders' fits most leadership stories; 'Insights' fits a story turned by reading people or by analysis (a test, a survey, data that moved a decision); 'Progress' fits an innovation or getting a stalled effort moving.", "al-foster"),
        ("The best stories show more than one part in practice even though only one is named, for example an innovation that also depended on an insight into a colleague.", "al-foster"),
        ("Structure: the problem before you acted, the barriers (usually interpersonal), your actions and the insight behind them, a short result, then why this part of the mission is yours. Spell out that connection rather than assuming the reader sees it.", "al-foster"),
        ("Prove the value lasted with a brief later example where you acted on it again.", "al-foster"),
    ])
P.essay("nurturing_community",
    "At the Foster School of Business, we embrace inclusion and belonging as two of the foundations of both successful business strategy and a world-class educational experience. We share the University's dedication to promoting the understanding and appreciation of human differences, and the constructive expression of ideas. We welcome you to share some of the ways you have practiced inclusion and promoted belonging.",
    ("words", 550), "foster-admissions", ["CONTRIBUTION"], required=False,
    parts=["ways you have practiced inclusion", "ways you have promoted belonging"],
    notes=[
        ("Optional 'Nurturing Our Community' essay; Foster recommends 350–550 words.", "foster-admissions"),
        ("Inclusion doesn't have to mean demographics: drawing out dissenting views, bringing in a sidelined colleague, or helping a newcomer adapt all count.", "al-foster"),
        ("Show the before state, why it mattered, what you did, and the insight into others' perspectives that guided you. If people resisted, explain their position with empathy rather than blame. The result matters least; what you learned matters most.", "al-foster"),
    ])
P.short("test_optional",
    "Please detail the specific evidence in your academic and/or professional experience that supports your analytical and quantitative preparedness for success in the program. (150 words maximum)",
    ("words", 150), "foster-admissions", ["OPTIONAL"], required=False,
    parts=["specific academic evidence", "specific professional evidence of analytical and quantitative work"],
    notes=[
        ("Required only for applicants applying test optional. Foster names strong quant GPA, a STEM or business degree, quantitative work experience and four or more years of progressive work experience as signs of a competitive test-optional candidate.", "foster-admissions", 0.75),
        ("List concrete evidence (courses and grades, models built, budgets owned) in plain business language, not jargon.", "admitstory-coach"),
    ])
P.optional("optional",
    "Include this essay if you have additional information you believe would be helpful to the admissions committee in considering your application.",
    ("words", 500), "foster-admissions", ["OPTIONAL"], required=False,
    parts=["context the rest of the application doesn't give"],
    notes=[
        ("Keep it brief, factual and mature: what happened, the context, what you did about it, what is different now. If a hard life event is already in a main essay, this can stay blank.", "al-foster"),
        ("For a recommender who isn't your boss, say why and why this person is qualified. For weak grades or scores, state the reason plainly and point to other evidence of academic ability.", "al-foster"),
    ])
P.todo.append("application.reapplicant: Foster publishes no reapplicant essay; confirm whether the form asks reapplicants anything")

P.video("foster-admissions", "async_video", scripting=False, qtypes=[
    ("All applicants receive the video interview by email one to three business days after their round deadline and have about a week to complete it; it assesses communication and thinking on your feet. Practice questions are available in the system.", "foster-admissions"),
    ("Because the written essay already covers goals, expect behavioural 'tell me about a time' questions. Prepare talking points, not scripts.", "al-foster", 0.6),
])
P.todo.append("application.video[0]: number of questions, think time and answer time (not published)")

P.recs("foster-admissions", 2, "school_specific", notes=[
    ("Two letters required, up to three allowed; professional recommenders preferred over academic or personal ones. Due by the round deadline.", "foster-admissions"),
    ("The form is short-answer questions plus a rating of strengths, areas to improve, leadership, interpersonal skills, motivation and initiative, accomplishments and managerial potential.", "foster-admissions"),
])
P.todo.append("application.recommendations.questions: the short-answer questions verbatim")
P.resume("foster-admissions", 3, notes=[
    ("Up to three pages allowed: reverse chronological, with each company's name and a short description or web address, title and responsibilities, all significant work since high school, education, activities and community involvement.", "foster-admissions"),
    ("Three pages is a ceiling, not a target; most strong resumes stay at one or two.", "admitstory-coach"),
])
P.add("application.test_policy", [
    ("GMAT (10th Edition or Focus) or GRE, no preference; scores valid five years; highest total used; no GMAT superscore for this cycle.", "foster-admissions"),
    ("Foster doesn't waive requirements but lets applicants apply test optional, with the 150-word evidence answer; a minimum 3.0 GPA is reported for that route.", "foster-admissions", 0.7),
    ("English proficiency: TOEFL 5 (100 iBT before 21 Jan 2026), IELTS 7.0 or Duolingo 130.", "foster-admissions"),
])
P.add("application.fees_waivers", [
    ("Application fee US$90, non-refundable, managed by the UW Graduate School; Foster itself offers no fee waivers (limited need-based Graduate School waivers may exist).", "foster-admissions", 0.8),
])

P.add("values.stated", [
    ("Foster's purpose statement: 'Together – we foster leaders, we foster insights, we foster progress – to better humanity.'", "foster-about"),
    ("Shared commitments: careful analysis and evidence-based decision-making; collaboration across perspectives and disciplines; curiosity about how organizations and markets evolve; responsibility to the communities business serves.", "foster-about"),
    ("The program says it prepares ambitious, globally minded professionals to lead with impact.", "foster-admissions"),
])
P.value("we foster leaders", ["originates_ideas", "acts_unasked", "brings_people_along"])
P.value("we foster insights", ["analytical", "empathetic"], ("An 'insight' can be analytical or emotional, so a story that turns on understanding someone counts as much as one that turns on data.", "al-foster"))
P.value("we foster progress", ["originates_ideas", "measurable_impact"])
P.value("inclusion and belonging", ["community_builder", "empathetic"])

P.add("culture_and_location", [
    ("A small cohort (77 in the Class of 2028) in Seattle; Foster stresses individual attention, team-based learning and access to Seattle employers.", "foster-profile"),
    ("Erin Town, then admissions director, described Seattle's business leaders as approachable and keen to learn from students, and highlighted Foster's mentorship program (c. 2015).", "touch-town-2015", 0.6),
])
P.add("academics.structure", [
    ("88 credits over two years, in person in Seattle. Year one is the core, including Leadership Development & Building Effective Teams, Leading Teams and Organizations, Applied Strategy and Professional Communications; electives begin in the third quarter of year one.", "foster-curriculum"),
    ("No formal concentrations. Students can take up to 16 credits elsewhere at UW, earn certificates (Entrepreneurship, Global Business) or specializations (ESG Leadership, Marketing Analytics, Product Marketing).", "foster-curriculum"),
    ("Degree activities also include professional development, a core case competition, a summer internship or project, and international-perspective and practical-experience activities.", "foster-curriculum"),
    ("Concurrent degrees: MBA/JD, MBA/MHA, MBA/MPAcc and MBA/MAIS.", "foster-curriculum"),
])
P.thing("academics.experiential", "Applied Strategy", "Required first-year consulting-style course: MBA teams solve a challenge set by a company sponsor (past clients include Amazon, Microsoft, Starbucks, Boeing, Costco and Nike).", "foster-curriculum",
        why=["career switchers needing hands-on proof", "consulting and tech goals"], url="https://foster.uw.edu/academics/degree-programs/full-time-mba/curriculum/applied-strategy-projects/")
P.thing("academics.courses", "Product Marketing specialization", "At least three of four designated product-marketing electives.", "foster-curriculum", why=["tech product and marketing goals"], url="https://foster.uw.edu/academics/degree-programs/full-time-mba/curriculum/certificates-concurrent-degrees/")
P.thing("academics.courses", "Marketing Analytics specialization", "At least three of four designated marketing-analytics electives.", "foster-curriculum", why=["analytics and marketing goals"], url="https://foster.uw.edu/academics/degree-programs/full-time-mba/curriculum/certificates-concurrent-degrees/")
P.thing("academics.courses", "ESG Leadership specialization", "Twelve credits plus the Ethical Leadership course.", "foster-curriculum", why=["sustainability and impact goals"], url="https://foster.uw.edu/academics/degree-programs/full-time-mba/curriculum/certificates-concurrent-degrees/")
for name, what, why, url in [
    ("Arthur W. Buerk Center for Entrepreneurship", "Courses, real-world experience and links to Seattle's startup community; runs the Dempsey Startup Competition and the Hollomon Health Innovation Challenge.", ["founders", "health innovation"], "https://foster.uw.edu/centers/buerk-ctr-entrepreneurship/"),
    ("Center for Leadership and Strategic Thinking (CLST)", "Leadership research and education, including the Fritzky Leadership Fellows.", ["leadership development goals"], "https://foster.uw.edu/centers/leadership/"),
    ("Consulting and Business Development Center (CBDC)", "Student consulting that helps grow businesses owned by under-represented entrepreneurs in under-served communities.", ["consulting", "community impact"], "https://foster.uw.edu/centers/consulting-and-business-development-center/"),
    ("Global Business Center (GBC)", "Global business opportunities in Seattle and abroad, including study abroad and the Global Business certificate.", ["international careers"], "https://foster.uw.edu/centers/gbc/"),
    ("Creative Destruction Lab – Seattle", "Pairs seed-stage science and technology startups with experienced mentors; initial focus on computational health and AI applications.", ["health tech and AI ventures"], "https://foster.uw.edu/centers/creative-destruction-lab/"),
    ("Center for Sales and Marketing Strategy", "Applies academic research to sales and marketing operations.", ["marketing and sales goals"], "https://foster.uw.edu/centers/center-for-sales-and-marketing-strategy/"),
]:
    P.thing("academics.centers", name, what, "foster-centers", why=why, url=url)
P.todo.append("community.clubs: verify specific Foster MBA clubs and treks on the official site")

P.employment("foster-employment-2025", 2025, [
    ("Consulting", 0.297, 175000), ("Marketing/Sales", 0.27, 135000), ("General Management", 0.176, 142800),
    ("Finance/Accounting", 0.135, 135000), ("Operations/Logistics", 0.095, 142650), ("Information Technology", 0.027, None)],
    ["Amazon", "Microsoft", "Google", "Apple", "Adobe", "Deloitte", "McKinsey & Company", "The Boston Consulting Group", "Kearney", "Accenture", "Ernst & Young", "PwC", "ZS Associates", "Boeing", "Blue Origin", "Nike", "Nestle", "P&G", "Goldman Sachs", "Zscaler"],
    intl=("Class of 2025: of international graduates seeking work, 72.7% had an offer by three months after graduation, against 85% of those with permanent work authorization.", "foster-employment-2025"))
P.add("careers.recruiting_notes", [
    ("Class of 2025 by industry: technology 40.5% (median base US$142,800), consulting 25.7% (US$175,000), retail 10.8%, financial services 5.4%, manufacturing 5.4%.", "foster-employment-2025"),
    ("Overall median base US$142,800 (mean US$144,411); 77.9% of graduates seeking work had an offer within three months, and Foster reports 86% at six months.", "foster-employment-2025"),
    ("51.4% of jobs came through school-facilitated activities, including 35.1% from converted internships, so the summer internship matters a great deal.", "foster-employment-2025"),
])

P.class_profile("foster-profile", 2028, size=77, gre=(160, 163), gpa=3.34, intl=0.48)
P.add("insider_notes", [
    ("Class of 2028: median GMAT 655 (middle 80% 571–705), median GRE 160 verbal and 163 quant, median GPA 3.34, average work experience six years, 41% women, 48% international, 18% US military among US students.", "foster-profile"),
    ("Admissions leadership listed on the site: Erin E. Town, Assistant Dean of MBA Admissions and Enrollment Strategy; Brent Nagamine, Director.", "foster-contact"),
    ("Foster's admissions team has long described its approach as counselling-style and encourages applicants to get in touch before and during their application.", "touch-town-2015", 0.55),
])
P.todo.append("class_profile.gmat: confirm whether the 655 median is GMAT Focus or classic before filling a GMAT field")
P.todo.append("insider_notes: a recent (2024–2026) interview or blog post from Erin Town on what Foster looks for")

P.interview("foster-admissions", "invite_only", ["adcom"], None, 45, ["virtual"],
    questions=[("Why an MBA, and why Foster?", "ca-foster-reports", 5), ("Walk me through your resume.", "ca-foster-reports", 4),
               ("Tell me about a time you received negative (or positive) feedback.", "ca-foster-reports", 4),
               ("Tell me about a time you fostered a diverse community or culture of belonging; how will you contribute to belonging at Foster?", "ca-foster-reports", 4),
               ("What will you bring to your learning team?", "ca-foster-reports", 3),
               ("Tell me about a time you led without formal authority, or handled a disagreement.", "ca-foster-reports", 3)],
    notes=[
        ("Interviews are by invitation, sent three to five weeks after the deadline, run by Foster MBA admissions staff over Zoom; an invited applicant must interview to stay in consideration.", "foster-admissions"),
        ("Applicants report a conversational style, 15 to 45 minutes, and some interviewers have read the essays, so be ready for questions about anything in the file.", "ca-foster-reports", 0.7),
    ])

P.ai("foster-admissions", "permitted_with_disclosure", ["essays"],
    disclosure="The use of any AI tools on our application must be disclosed in the Foster Integrity Statement.",
    notes=[
        ("AI isn't prohibited for essays but should 'only assist in refining content, not creating it'; applicants are expected to generate their own ideas.", "foster-admissions"),
        ("Foster warns that candidates who lean too heavily on AI do themselves a disservice.", "foster-admissions"),
    ])
P.add("scholarships", [("Foster's admissions page has no separate scholarship essay; merit aid is considered with the application.", "foster-admissions", 0.6)])
P.todo.append("scholarships: verify Foster's merit scholarship process and named fellowships")

P.add("avoid", [
    ("Treating the mission essay as a values statement with no story: the 2026-27 prompt explicitly asks for a specific experience.", "foster-admissions"),
    ("Using AI to generate content rather than refine it, or failing to disclose its use in the Integrity Statement.", "foster-admissions"),
    ("Picking the mission phrase first and forcing a story to fit it.", "al-foster"),
])
P.add("angles_that_work", [
    ("A leadership story with an innovation in it, told under 'Progress' or 'Insights', that also shows the applicant reading what a colleague needed.", "al-foster"),
    ("A post-MBA plan with Seattle-anchored targets (cloud, retail, aerospace, health) and a named second path, tied to Applied Strategy and a specialization.", "admitstory-coach"),
    ("Each essay keeps its own story: the plans essay carries the career origin, the mission essay a leadership moment, the inclusion essay a different relationship story.", "admitstory-coach"),
])
P.term("Applied Strategy", "Foster's required first-year consulting project for a company sponsor.", "foster-curriculum")
P.term("Foster Integrity Statement", "The application statement where applicants must disclose any AI tool use.", "foster-admissions")
P.write()
