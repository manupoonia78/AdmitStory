import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("hec-paris", "HEC Paris", "HEC Paris", "FR", "Jouy-en-Josas (Paris region)", "https://www.hec.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
B = "https://www.hec.edu/en/mba-executive-mba/mba"
P.source("hec-requirements", "official", "HEC Paris MBA: Requirements (checklist, tests, English, fee)", B + "/admissions/requirements")
P.source("hec-deadlines", "official", "HEC Paris MBA: Application deadlines (January 2027 and September 2027 intakes)", B + "/admissions/application-deadlines")
P.source("hec-apply", "official", "HEC Paris MBA: How do I apply? (five-week process, juries, alumni interviews)", B + "/admissions/how-do-i-apply")
P.source("hec-looking", "official", "HEC Paris MBA: Who are we looking for?", B + "/admissions/who-are-we-looking")
P.source("hec-profile", "official", "HEC Paris MBA: Class profile (Class of 2026 stats infographics)", B + "/class-profile")
P.source("hec-employment", "official", "HEC Paris MBA: Employment statistics (Class of 2025 snapshot)", B + "/careers/employment-statistics")
P.source("hec-ft-2025", "official", "HEC Paris news: HEC Paris rises to 9th worldwide in the FT MBA rankings 2025", "https://www.hec.edu/en/school/news/hec-paris-rises-9th-worldwide-financial-times-mba-rankings-2025")
P.source("hec-formats", "official", "HEC Paris MBA: Formats (12- or 16-month, September and January intakes)", "https://www.hec.edu/en/mba-programs/mba/learning-experience/mba-formats")
P.source("hec-customize", "official", "HEC Paris MBA: Customize your MBA (specializations, concentrations, CDL, New Horizons, exchanges, intensives)", "https://www.hec.edu/en/mba-programs/mba/learning-experience/customize-your-mba")
P.source("hec-specs", "official", "HEC Paris MBA: Specialization and concentration pages", B + "/learning-experience/specializations/specializations-finance")
P.source("hec-ols", "official", "HEC Paris MBA: Outdoor Leadership Seminar", B + "/learning-experience/outdoor-leadership-seminar")
P.source("hec-scholarships", "official", "HEC Paris MBA: Scholarships and fees & funding", B + "/admissions/fees-funding/scholarships")
P.source("hec-meet", "official", "HEC Paris MBA: Meet us (regional recruitment managers, campus visits)", B + "/meet-us")
P.source("hec-portal", "official", "HEC Paris MBA online application (applicant portal; not read)", "https://hecparis.my.site.com/mba", read=False)
P.source("gmac-vanos", "adcom", "GMAC / BusinessBecause: Sara Vanos, Executive Director of Marketing & Admissions, on applying to the HEC Paris MBA", "https://www.gmac.com/resources/learners/how-to-apply/application-guidance/hec-paris-mba-application")
P.source("ca-hec-2026", "press", "Clear Admit: HEC Paris MBA essays & analysis 2026-2027, quoting the prompts", "https://www.clearadmit.com/mba-admissions-essay-topics-analyses/hec-paris-essay-topic-analysis/")
P.source("sb-hec-2026", "press", "Stacy Blackman: HEC Paris essays for 2026-2027 (September 2027 intake; unchanged from the prior season)", "https://www.stacyblackman.com/blog/hec-paris-essays/")
P.source("ca-hec-recs", "press", "Clear Admit: HEC Paris MBA recommendation questions 2026-2027", "https://www.clearadmit.com/mba-admissions-recommendation-questions/hec-paris-mba-recommendation-questions")
P.source("ca-hec-ir-2016", "interview_reports", "Clear Admit interview report: HEC Paris, rolling admissions, alumni, off-campus (admitted applicant, Mar 2016)", "https://www.clearadmit.com/interview-reports/hec-paris-mba-interview-report-rolling-admissions-alumni-off-campus/")
P.source("al-hec", "third_party_reference", "ApplicantLab — HEC school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", "https://hecparis.my.site.com/mba"); P.url("deadlines", B + "/admissions/application-deadlines")
P.url("class_profile", B + "/class-profile"); P.url("employment_report", B + "/careers/employment-statistics")

# September 2027 intake (the class matching this cycle). Rolling: twelve juries a year, decision about five weeks after each deadline.
SEPT = [("2026-08-16", "2026-09-18"), ("2026-09-20", "2026-10-23"), ("2026-10-18", "2026-11-20"), ("2026-11-15", "2026-12-18"),
        ("2027-01-11", "2027-02-19"), ("2027-02-15", "2027-03-19"), ("2027-03-15", "2027-04-16"), ("2027-04-12", "2027-05-21"),
        ("2027-05-17", "2027-06-18"), ("2027-06-14", "2027-07-16")]
CONFIRM = ["16 Oct 2026", "20 Nov 2026", "18 Dec 2026", "18 Jan 2027", "16 Mar 2027", "13 Apr 2027", "17 May 2027", "15 Jun 2027", "13 Jul 2027", "13 Aug 2027"]
for i, ((dl, dec), conf) in enumerate(zip(SEPT, CONFIRM)):
    notes = [(f"September 2027 intake; deadline to confirm a place: {conf}.", "hec-deadlines")]
    if i == 0:
        notes += [
            ("Rolling admissions: apply year-round for a September or January start; a decision comes about five weeks after the deadline you apply under. HEC says deadlines may change and urges applying early if you need campus housing or a visa.", "hec-deadlines"),
            ("January 2027 intake deadlines were 16 Aug, 20 Sep and 18 Oct 2026, then rolling from 15 Nov 2026. One application per graduating cycle (a September intake plus the following January).", "hec-deadlines"),
            ("An incomplete application is moved to the next month's jury, so treat the deadline as the date everything must be in.", "hec-apply"),
        ]
    P.round(f"September 2027 intake, deadline {i + 1}", dl, "hec-deadlines", decision=dec, notes=notes)
P.round("September 2027 intake, rolling", "2027-07-30", "hec-deadlines", notes=[("After 14 June 2027, applications are reviewed on a rolling basis until 30 July 2027; confirmation dates are given by Admissions.", "hec-deadlines")])
P.todo.append("rounds: confirm the exact time of day and time zone for HEC deadlines (not published)")

C = ("chars_incl_spaces", 2000)
P.essay("why_hec_now",
    "Why are you applying to the HEC MBA Program now? What is the professional objective that will guide your career choice after your MBA, and how will the HEC MBA contribute to the achievement of this objective?",
    ("chars_incl_spaces", 3500), ["ca-hec-2026", "sb-hec-2026"], ["GOALS", "WHY-SCHOOL"],
    parts=["why an MBA now", "the professional objective guiding your post-MBA career choice", "how the HEC MBA will help you reach it"],
    notes=[
        ("Sara Vanos (Executive Director, Marketing & Admissions): 'We want to know why the candidate wants to do an MBA and why now? And we want to hear about how the HEC Paris MBA in particular will help them achieve their goals.'", "gmac-vanos"),
        ("HEC wants 'a clear motivation' and says 'your application must be consistent in reflecting this'; pre-selection looks for 'clear reasoning as to why you are applying to the HEC Paris MBA'.", ["hec-looking", "hec-apply"]),
        ("You don't have to answer 'why now' first. Opening with the long-term vision and how it formed, then working back to the post-MBA role and what you must learn, often reads better; 'why now' is usually that the current role has taught what it can.", "al-hec"),
        ("Write this essay together with the form's immediate-career-goals field: the field carries the tactical plan (role, location, how you'll get hired), this essay carries the long-term objective, why an MBA, why now and why HEC. Never paste the same sentences into both.", "al-hec"),
        ("For 'why HEC', use the employment data (where the class lands and which sectors hire), one specialization or concentration with a use for each course you name, one experiential option (CDL, New Horizons Capstone, an exchange) and one club or event you'd add to. Many classmates switch careers, but a switcher still shows the homework done.", "al-hec"),
        ("Characters, not words: 3,500 characters is roughly 500–600 words. Draft with room to cut and finish against the portal counter.", "admitstory-coach"),
        ("Name the gap in plain words ('I can build it; I can't yet price it or sell it') rather than 'level up' or 'leverage'. Rankings and 'global network' are not reasons.", "admitstory-coach"),
    ])
P.essay("significant_achievement",
    "What do you consider your most significant life achievement?",
    C, ["ca-hec-2026", "sb-hec-2026"], ["IDENTITY", "LEADERSHIP"],
    parts=["the achievement", "why you consider it significant", "what it taught you"],
    notes=[
        ("'Life' achievement: the form, resume and essay 1 already carry your career, so a non-work story usually earns more here, ideally one that shows leadership ingredients (initiative, persuasion, working with and through others).", "al-hec"),
        ("Spend half to three-quarters of the space on why it matters to you and what changed in you. Bad reasons for significance: money, winning, proving someone wrong. Good ones: a lesson that made you better with people.", "al-hec"),
        ("Avoid a story that only shows a private trait (a solo analytical feat, a private devotion): the reader should be able to picture you working with others. A one-line nod to where you later used the lesson strengthens the close.", "al-hec"),
        ("Bring the moment to life with a concrete scene first, then the meaning; never end on the result.", "admitstory-coach"),
    ])
P.essay("leadership_ethics",
    "Leadership and ethics are inevitably intertwined in the business world. Describe a situation in which you have dealt with these issues and how they have influenced you.",
    C, ["ca-hec-2026", "sb-hec-2026"], ["VALUES", "LEADERSHIP"],
    parts=["one situation where leadership and ethics met", "how you dealt with it", "how it has influenced you"],
    notes=[
        ("Strongest: a grey-area dilemma where your choice mattered and the ethical path cost you something, with the reasoning shown. Weaker: an obvious choice. Last resort for junior applicants: a dilemma you witnessed closely, with most of the space on how it shaped you.", "al-hec"),
        ("Give both paths real pull so the reader sees an actual dilemma; it's fine that you weren't the final decision-maker if you voiced a view rather than staying silent.", "al-hec"),
        ("Keep the 'what happened' to a third or a half. The influence must be more specific than 'always tell the truth' (confidentiality sometimes requires silence): a practice you now follow or a changed approach to your team.", "al-hec"),
        ("Never make another person the villain; give them a sympathetic reason rooted in their position or pressures.", "admitstory-coach"),
    ])
P.essay("different_life",
    "Imagine a life entirely different from the one you now lead, what would it be?",
    C, ["ca-hec-2026", "sb-hec-2026"], ["IDENTITY"],
    parts=["the alternative life", "why it appeals"],
    notes=[
        ("A disguised 'tell us something interesting about you'. Anchor it in a real hobby or long commitment so the reader notices that part of your file, and keep the imagined life consistent with your values and strengths.", "al-hec"),
        ("Choose the facets that involve people: an architect who pulls designers and builders together, not one alone in a studio. Then write it in your most natural voice.", "al-hec"),
        ("'Good weird' is welcome; avoid an indulgent escape (living on a beach) that shows no strengths.", "admitstory-coach"),
    ])
P.essay("choice_essay",
    "Please choose from one of the following essays: a) What monument or site would you advise a first-time visitor to your country or city to discover, and why? b) Certain books, movies or plays have had an international success that you believe to be undeserved. Choose an example and analyse it. c) What figure do you most admire and why? You may choose from any field (arts, literature, politics, business, etc).",
    C, ["ca-hec-2026", "sb-hec-2026"], ["IDENTITY", "VALUES"],
    parts=["choose one of a, b or c", "the choice", "the reasoning, which reveals you"],
    notes=[
        ("Option c (an admired figure) is the safest: about 30 words on the person and the rest on why, with two or three moments where their example changed what you did. Avoid the obvious (many will write about Steve Jobs).", "al-hec"),
        ("Option b shows independent, critical thinking but risks sounding like a snob: grant why the work is popular before your critique, and phrase criticism constructively.", "al-hec"),
        ("Option a is the riskiest: most answers read like a travel guide and applicants from the same country pick the same sites. Choose it only with a story at that place that only you can tell, ideally one where you acted.", "al-hec"),
        ("Whichever option: answer the prompt in the first line, then use the argument to show a value or trait not yet seen elsewhere in the file.", "admitstory-coach"),
    ])
P.optional("optional",
    "If there is anything else you would like to share with us that has not already been shared elsewhere in your file, please feel free to use this space.",
    ("chars_incl_spaces", 6300), ["ca-hec-2026", "sb-hec-2026"], ["OPTIONAL"], required=False,
    parts=["context not shown elsewhere"],
    notes=[
        ("The space is long, but use it only for real context (a gap, a weak grade or score, a recommender who isn't your manager), not another achievement.", "ca-hec-2026"),
        ("Brief, factual, mature: what happened, the real context, what you did, what is different now. For a non-manager recommender, say why, and why this person can judge you.", "al-hec"),
    ])
P.todo.append("application.essays: confirm wording, character counting (incl. spaces?) and choices in the live portal; prompts come from two press sources quoting the September 2027 application")

P.form("current_position", "Professional experience: description of your current position (mini-essay)", "hec-portal", limit_kind="words", guidance=[
    ("Reported at about 200 words. Don't paste the resume: in full sentences, describe main responsibilities, what projects are like (team or solo, internal or client), and a major result with the obstacle behind it, as you'd explain your job to a new friend.", "al-hec"),
    ("Team size is captured elsewhere on the form; keep job titles, dates and company names identical to the resume.", ["al-hec", "admitstory-coach"]),
])
P.form("immediate_goals", "Professional experience: immediate career goals after the MBA, including location (mini-essay)", "hec-portal", limit_kind="words", guidance=[
    ("Reported at about 200 words. This is the tactical plan: target location (a specific country for your sector; a Plan B such as returning home if EU work authorisation is a risk), one or two job titles, the conversations you've had that show the goal is reachable, and how you'll hunt (campus recruiters, alumni).", "al-hec"),
    ("Keep the long-term objective and 'why HEC' for essay 1, and don't repeat sentences between them.", "al-hec"),
])
P.form("financing", "Professional experience: how you plan to finance your MBA (mini-essay)", "hec-portal", limit_kind="words", guidance=[
    ("Reported at about 250 words. Be honest: don't claim a loan you don't have, and don't rely on a scholarship. Say you expect to borrow like most students (mention a pre-approval if you have one), then add any real hardship that makes scholarship support important.", "al-hec"),
])
P.todo.append("application.form_sections: the three Professional Experience mini-essays and their word limits come only from coaching material; confirm they are still in the September 2027 portal")

P.reapplicant(essay=None, policy=[
    ("Reapplicants are welcome; highlight how your profile has developed or strengthened since the last application, with new information for the Admissions Jury. One application per graduating cycle.", "hec-deadlines"),
    ("Show what changed (new scope, results, coursework, a sharper plan) and what you learned from it; refine rather than reverse the career objective.", "admitstory-coach"),
])
P.recs("ca-hec-recs", 2, "school_specific", questions=[
    "How long and in what capacity have you known the candidate?",
    "If this is a work related reference, in what position is/was the candidate employed and for how long?",
    "What do you consider to be the candidate's principal strengths / talents?",
    "What do you consider to be the candidate's weaknesses or areas that need improvement?",
], notes=[
    ("Two recommendations are required.", "hec-requirements"),
    ("Referees also rate nine qualities (intellectual ability, oral and written communication, analytical skills, teamwork, creativity, competence in current role, leadership, initiative/problem-solving) on a scale from unobserved to outstanding (top 5%), and state the candidate's first language.", "ca-hec-recs"),
    ("Brief each recommender with factual bullets, never a drafted letter: three to five projects with outcomes, the traits each should evidence, and the HEC questions. The weakness should be trainable and shown with the steps you took.", "admitstory-coach"),
])
P.todo.append("application.recommendations: confirm question wording and any length limits in the portal")
P.resume("hec-requirements", 2, notes=[
    ("'Current professional resume (English)'; no page limit is published (2 is a ceiling, not an HEC rule). Sara Vanos: CVs should detail exceptional projects, 'including the tasks and results'.", ["hec-requirements", "gmac-vanos"]),
])
P.add("application.test_policy", [
    ("GMAT, GMAT Focus, Executive Assessment or GRE required (under five years old); no minimum. Current class average GMAT Focus 635 (690 on the old scale); HEC encourages a balance across all three sections. A top-ranked MiM degree may qualify for a waiver.", "hec-requirements"),
    ("English test required for non-native speakers without an English-taught degree (under two years old): IELTS 7.0 (6.5 per part), TOEFL C1, PTE 72, Duolingo 135, TOEIC 340 S&W / 850 L&R, Cambridge 185. English is the only language required.", "hec-requirements"),
    ("Vanos: a strong GMAT or GRE 'shows us that a candidate has already invested time in their wish to do an MBA' and predicts performance in the program.", "gmac-vanos"),
])
P.add("application.fees_waivers", [
    ("Non-refundable application fee of €200.", "hec-requirements"),
])

P.add("values.stated", [
    ("'Our MBA students are not only team players. They are individuals who can inspire their colleagues to do their best work.'", "hec-looking"),
    ("Six criteria: academic accomplishment; professional experience and 'clear evidence of career progression'; leadership potential; international exposure ('globally minded'); MBA motivation and career objectives; interpersonal skills and personality.", "hec-looking"),
    ("'We value passion, humility, individuality and respect for others. You must be able to lead as well as collaborate within a team.'", "hec-looking"),
    ("Vanos: 'overall excellence… well-rounded, high-achieving candidates, who have at least two years of professional experience and have shown career progression', plus international exposure, academics, goals and life outside work.", "gmac-vanos"),
])
P.value("international exposure; open-mindedness", ["global_outlook", "empathetic", "steady_in_ambiguity"], ("Vanos looks for open-mindedness shown by having lived, worked or studied abroad or worked across cultures; make cross-cultural work visible somewhere in the file.", "gmac-vanos"))
P.value("career progression; excelling in the current role", ["measurable_impact", "acts_unasked"])
P.value("lead as well as collaborate; inspire colleagues", ["brings_people_along", "community_builder"])
P.value("passion, humility, individuality, respect for others", ["self_aware", "empathetic"])

P.add("insider_notes", [
    ("Class of 2026: 268 students, 40% women, 60 nationalities, 95% international, average age 30, six years' average work experience.", "hec-profile"),
    ("Class of 2026 pre-MBA sectors: financial services 29%, tech/telecom/commerce 20%, consulting 10%, CPG 8%, manufacturing 6%, healthcare 5%. Highest field of study: engineering 30%, business 26%, humanities 15%.", "hec-profile"),
    ("Ideal experience is two to ten years; without an undergraduate degree you need five years' experience including three in management (or national-team athlete status).", "hec-requirements"),
    ("Vanos: connect before applying; a regional recruitment manager gives feedback and coaches you through the process. The 'Connect with us' form takes about five minutes and doesn't affect the application.", ["gmac-vanos", "hec-apply"]),
    ("Vanos: make essays complement each other to avoid repetition, 'but most importantly, you should write from the heart and present your true self.'", "gmac-vanos"),
    ("Five essays means range matters: map every prompt and form field against your stories so each shows a different trait, and keep career evidence mostly in essay 1 and the form.", ["al-hec", "admitstory-coach"]),
])
P.add("culture_and_location", [
    ("A 340-acre residential campus in the village of Jouy-en-Josas, about 10 miles outside Paris, where most MBA students live; a close-knit community 'where everyone knows your name'. Campus visits run on Mondays.", ["hec-profile", "hec-meet"]),
    ("Admitted applicants report interviewers checking that you know the campus is not in Paris itself.", "ca-hec-ir-2016", 0.6),
])
P.add("academics.structure", [
    ("12-month (accelerated; five intensive electives, fewer customisation options, suited to staying in your industry) or 16-month track; 600–681 teaching hours. September and January intakes share the same core and merge in the Customized Phase.", "hec-formats"),
    ("Specializations: Finance, Entrepreneurship, Strategy, Strategic Marketing, Management and Organizations (formerly Advanced Management). Concentrations: Tech & AI, and Reshaping Business for Sustainability.", ["hec-specs", "hec-customize"]),
    ("Three-day intensive courses run four times a year; sample electives include AI for Business Decision-Making, Private Equity and LBOs, Mergers & Acquisitions in Practice, Designing Sustainable Operations & Supply Chains, and Leading & Owning the Family Business.", "hec-customize"),
    ("Triple-accredited (AACSB, AMBA, EQUIS); the MBA grants a Master's degree registered with France's RNCP.", "hec-formats", 0.8),
])
P.thing("academics.experiential", "Outdoor Leadership Seminar", "A two-day seminar of increasingly difficult team tasks supervised by leadership experts from the French military; every student leads a team of ten classmates and gets feedback.", "hec-ols", why=["leadership growth", "a 'how HEC will change me' line"], url=B + "/learning-experience/outdoor-leadership-seminar")
P.thing("academics.experiential", "Creative Destruction Lab (CDL) Certificate", "Launched in 2020; students work on the front line of launching start-ups with the CDL-Paris program.", "hec-customize", why=["entrepreneurship and deep-tech goals"], url="https://www.hec.edu/en/mba-executive-mba/mba/learning-experience/creative-destruction-lab")
P.thing("academics.experiential", "New Horizons Capstone", "Students apply course knowledge and research to build an analytical toolbox and anticipate which realities are changing faster than businesses expect.", "hec-customize", why=["strategy and consulting goals"])
P.thing("academics.experiential", "Exchanges and double degrees", "On the 16-month track, an exchange or double degree with one of more than 30 partner schools during the Customized Phase.", "hec-customize", why=["international or US-market goals"])
P.todo.append("community.clubs: verify specific HEC MBA clubs and conferences")

P.employment("hec-employment", 2025, [], [], currency="USD")
P.add("careers.recruiting_notes", [
    ("Class of 2025: 75% accepted offers within three months; 64% took jobs outside their home country; 57% switched sector, 54% function, 57% location; 38% changed at least two of the three and 22% all three.", "hec-employment"),
    ("Where the Class of 2025 went: Europe 52%, Asia and Oceania 25%, North America 11%, Africa and Middle East 8%, Latin America and the Caribbean 4%. Technology, finance and consulting remain the main sectors.", "hec-employment"),
    ("FT 2025 ranking: ninth worldwide; average alumni salary about US$192,000 three years out, a 136% increase; top three worldwide for international mobility.", "hec-ft-2025"),
    ("Strong ties to Paris luxury, and a high share of career changers; check the employment report for employers in your target region before naming HEC's fit.", ["al-hec", "hec-profile"], 0.7),
])
P.todo.append("careers.employment_report: salaries by function and top employers are only in the 2025 Employment Report on Calameo (not machine-readable)")
P.class_profile("hec-profile", 2026, size=268, gmat_focus=635, wexp=6, intl=0.95)
P.todo.append("class_profile.gmat_focus_median: 635 is HEC's stated class average (requirements page), not a median")

P.interview("hec-apply", "invite_only", ["alum"], False, 60, ["virtual", "hub"],
    questions=[
        ("Your 10-minute presentation on a topic of your choice.", "hec-apply", 5),
        ("What are your post-MBA career goals?", "ca-hec-ir-2016", 4),
        ("What attracted you to HEC? Which specialization and clubs will you choose?", "ca-hec-ir-2016", 4),
        ("What would your coworkers say is your biggest weakness?", "ca-hec-ir-2016", 3),
    ],
    notes=[
        ("After the pre-selection jury, invited candidates have two separate interviews with HEC MBA alumni, given equal weight. Each starts with a 10-minute oral presentation on a topic of your choice, then an in-depth discussion of your application. In English, usually in the two weeks before the final jury.", "hec-apply"),
        ("Vanos: each interview is about an hour, with an alum in your city or virtually; interviewers judge whether the program is right for you, and if both think not, you are not admitted. 'Be true to themselves and speak from the heart.'", "gmac-vanos"),
        ("Interviewers have read your file; stay consistent with the essays. The final jury (Ministry of Education representatives, alumni, faculty and the MBA Dean) reviews everything, including the interviewers' notes; twelve juries a year.", ["hec-apply", "admitstory-coach"]),
        ("Pick a presentation topic that reveals something new about you and invites conversation (a passion, a project, a place) rather than a resume recap; rehearse to exactly ten minutes, since some interviewers interrupt with questions per slide.", ["ca-hec-ir-2016", "admitstory-coach"], 0.7),
    ])
P.todo.append("interview.blind: HEC sends interviewers the application (blind=False per an admitted-applicant report); confirm")
P.todo.append("ai_policy: no published HEC generative-AI policy for MBA applications found")
P.add("scholarships", [
    ("All admitted applicants can apply for scholarships; over €1,000,000 a year in aid. Merit and need awards include HEC Excellence and Diversity scholarships (up to 50% of tuition), plus named awards for women (e.g. Laidlaw, Forté, 30% Club), healthcare backgrounds (Sanofi) and French armed-forces officers.", ["hec-apply", "hec-scholarships"], 0.8),
    ("Some named scholarships need their own essay (for example a 1,500-word leadership-and-creativity essay for the L'Oréal award).", "hec-scholarships", 0.75),
])
P.todo.append("scholarships: tuition for the September 2027 intake is not shown on the fees page text")
P.add("avoid", [
    ("Copying sentences between essay 1 and the immediate-career-goals mini-essay.", "al-hec"),
    ("A work achievement or a solo feat in the 'life achievement' essay when it shows nothing of how you treat people.", "al-hec"),
    ("An ethics lesson as generic as 'always tell the truth'.", "al-hec"),
    ("A travel-guide answer to the monument option, or a sneering critique in option b.", "al-hec"),
    ("A financing answer that relies entirely on a scholarship or claims a loan you don't have.", "al-hec"),
    ("Five essays that retell the same promotion; HEC wants complementary answers.", "gmac-vanos"),
])
P.add("angles_that_work", [
    ("Essay 1 opened with the long-term objective and its origin, then the post-MBA step, then HEC specifics tied to the employment data for the target region.", "al-hec"),
    ("A life achievement from outside work where the applicant brought people along, with most of the space on why it mattered.", "al-hec"),
    ("A visible international thread (living, working or studying abroad, or cross-cultural teams) somewhere in the essays or form.", "gmac-vanos"),
    ("An interview presentation on a personal passion that sparks a real conversation with the alum.", "ca-hec-ir-2016", 0.65),
])
P.term("Pre-Selection Jury", "HEC's first review of the full written application, which decides interview invitations.", "hec-apply")
P.term("Admissions Jury", "The final committee (Ministry of Education representatives, alumni, faculty, the MBA Dean) that decides admission after the two interviews; twelve a year.", "hec-apply")
P.term("Customized Phase", "The second half of the HEC MBA, when September and January intakes merge for specializations, exchanges and electives.", "hec-formats")
P.term("Jouy-en-Josas", "The village about 10 miles from Paris where the HEC campus is.", "hec-profile")
P.write()
