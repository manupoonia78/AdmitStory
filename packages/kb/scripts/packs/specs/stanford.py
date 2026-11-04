import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from packlib import Pack

P = Pack("stanford-gsb", "Stanford Graduate School of Business", "Stanford GSB", "US", "Stanford, CA", "https://www.gsb.stanford.edu")
AL = "Paid coaching platform material (ApplicantLab). Private reference; items are AdmitStories rewrites approved by Manu 2026-11-04 (§9.6). Never name or quote."
G = "https://www.gsb.stanford.edu/programs/mba/admission"
P.source("gsb-essays", "official", "Stanford GSB MBA: Essays (prompts, word limits, feedback vs coaching, Additional Information)", G + "/application/essays")
P.source("gsb-short", "official", "Stanford GSB MBA: Optional short answer question", G + "/application/optional-short-answer-question")
P.source("gsb-deadlines", "official", "Stanford GSB MBA: Deadlines for applying", G + "/deadlines")
P.source("gsb-recs", "official", "Stanford GSB MBA: Letters of recommendation (policy and recommender questions)", G + "/application/letters-recommendation")
P.source("gsb-interviews", "official", "Stanford GSB MBA: Interviews", G + "/interviews")
P.source("gsb-criteria", "official", "Stanford GSB MBA: Evaluation criteria", G + "/evaluation-criteria")
P.source("gsb-reapply", "official", "Stanford GSB MBA: Reapplication", G + "/application/reapplication")
P.source("gsb-personal", "official", "Stanford GSB MBA: Personal information, activities & awards (optional background question)", G + "/application/personal-information-activities-awards")
P.source("gsb-fee", "official", "Stanford GSB MBA: Application fee and waivers", G + "/application/fee")
P.source("gsb-experience", "official", "Stanford GSB MBA: Professional experience and resume", G + "/application/professional-experience")
P.source("ca-gsb-2027", "press", "Clear Admit: Stanford GSB MBA Class of 2027 profile (Nov 2025)", "https://www.clearadmit.com/2025/11/stanford-gsb-mba-class-of-2027-profile/")
P.source("ca-gsb-2025", "press", "Clear Admit: Stanford GSB employment report, MBA Class of 2025 (Dec 2025)", "https://www.clearadmit.com/2025/12/stanford-gsb-employment-report-mba-class-of-2025/")
P.source("pq-ai-2026", "press", "Poets&Quants (Fortuna, May 26, 2026): AI policies at top MBA programs, quoting each school's application materials", "https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/")
P.source("al-stanford", "third_party_reference", "ApplicantLab — Stanford school tab", None, rights=AL)
P.source("admitstory-coach", "coach_notes", "AdmitStories coaching canon and Manu's storytelling rules", None)

P.url("prompts", G + "/application/essays"); P.url("deadlines", G + "/deadlines")
P.url("class_profile", G + "/class-profile"); P.url("employment_report", "https://www.gsb.stanford.edu/programs/mba/career-impact/positions-compensation")

P.round("Round 1", "2026-09-09", "gsb-deadlines", decision="2026-12-09", notes=[
    ("Due 4:00 pm Pacific, including both recommendation letters and the fee. One application per year, in any one round.", "gsb-deadlines"),
    ("Partners applying the same year are strongly encouraged to apply in the same round.", "gsb-deadlines"),
])
P.round("Round 2", "2027-01-06", "gsb-deadlines", decision="2027-04-01")
P.round("Round 3", "2027-04-07", "gsb-deadlines", decision="2027-05-27")

P.essay("what_matters_most",
    "Essay A: What matters most to you, and why? For this essay, we would like you to reflect deeply and write from the heart. Once you've identified what matters most to you, help us understand why. You might consider, for example, what makes this so important to you? What people, insights, or experiences have shaped your perspectives?",
    ("words", 650), "gsb-essays", ["VALUES", "IDENTITY"],
    parts=["what matters most to you", "why", "the people, insights or experiences that shaped it"],
    notes=[
        ("GSB: 'Essays help us learn about who you are rather than solely what you have done… the essays reveal the person behind those achievements.' 'There is no right answer… the best answer is the one that is truest for you.' Up to 650 words; 'we often read effective essays that are written in fewer words.'", "gsb-essays"),
        ("The 'what' matters least; the 'why' and the proof matter most. Start from your big, ambiguous decisions, find the thread that ran through them, and show the value through choices it forced, ideally ones a reasonable person would have made differently.", "al-stanford"),
        ("Use a 'ladder of whys' on each major decision until you reach something core; test whether the value has ever cost you something. A value everyone shares, or one only shown in easy times, isn't deep enough.", "al-stanford"),
        ("Never: bragging (not an atom of arrogance), a resume in prose, a philosophy lecture, famous quotes, a noble cause with no history behind it, or a pity party. Humility is the tone.", "al-stanford"),
        ("Write it so you'd be slightly embarrassed if a colleague found it on the printer; vivid, specific details only you could give. Friends and family should recognise your voice.", ["al-stanford", "gsb-essays"]),
    ])
P.essay("why_stanford",
    "Essay B: Describe your aspirations and how your Stanford GSB experience will help you realize them. If you are applying to both the MBA and MSx programs, use this essay to address your interest in both programs.",
    ("words", 350), "gsb-essays", ["GOALS", "WHY-SCHOOL"],
    parts=["your aspirations", "how the GSB experience will help realise them", "MBA+MSx applicants: interest in both"],
    notes=[
        ("GSB lets you dream big, but a bold vision is only credible with receipts: past impact that shows you have the raw ingredients to drive that change. It must still be plausible and clearly yours.", "al-stanford"),
        ("Be specific about GSB: name the leadership skill you've struggled with and the course that addresses it (not just 'Interpersonal Dynamics will make me a better leader'), cross-university courses or a dual degree, the global experience requirement, a club with what you'd give it.", "al-stanford"),
        ("Location and weather are not reasons. The small class and personal attention can be, briefly.", "al-stanford"),
        ("Now 350 words (down from 400), so keep why-GSB to two or three strong, specific links.", ["gsb-essays", "admitstory-coach"]),
    ])
P.essay("msx_community",
    "How will you enhance the MSx community? For this essay, describe how you plan to support and enhance the experience of your classmates and the learning community at Stanford GSB.",
    ("words", 250), "gsb-essays", ["CONTRIBUTION"], required=False, verified=False,
    parts=["how you will support classmates and the learning community"],
    notes=[
        ("Only for applicants to both the MBA and MSx. Say you prefer the two-year MBA (internship, breadth of electives) but would gladly take the MSx; anything else reads as not valuing the community.", "al-stanford"),
    ])
P.todo.append("application.essays.msx_community: word limit not shown on the essays page; confirm in the portal")
P.short("impact_examples",
    "We believe that leadership comes through in different shapes and forms and look for examples of when you have taken initiative, persisted through challenges, engaged others in your efforts, or supported those around you. Think about a time in the last five years when you've created a significant impact, whether in professional, extracurricular, civic, or academic settings. What was the situation, what did you do, and what was the impact?",
    ("chars_incl_spaces", 1200), "gsb-short", ["LEADERSHIP", "MICRO"], required=False, list_count=3,
    parts=["the situation", "what you did", "the impact"],
    notes=[
        ("Optional; up to three examples of up to 1,200 characters (about 200 words) each. GSB suggests expanding a resume bullet with 'the how or why behind the what', or an impact that doesn't fit elsewhere. If you've covered your contributions already, 'congratulations, you're done!'", "gsb-short"),
        ("Fewer is fine: what you leave out tests judgment. Don't inflate a modest story; pick ones where you persuaded, persisted or did the right thing with people, and say why it was significant for others or you, not the bonus.", "al-stanford"),
        ("Each example: the challenge in plain English, the interpersonal barrier, the actions and the insight behind them, the result in a line, the meaning in more. Keep the values consistent with Essay A.", "al-stanford"),
    ])
P.form("background_shaped", "Personal information: how your life experiences have shaped how you see the world (optional)", "gsb-personal", char_limit=800, limit_kind="chars_incl_spaces", guidance=[
    ("GSB: 'We know that each person is more than a list of facts or predefined categories. Please feel free to elaborate on how your life experiences have helped shape how you see the world (up to 800 characters, or approximately 150 words).'", "gsb-personal"),
    ("Name something relatively distinctive in your background (a prior field, an upbringing, a personality trait among a different team) and one real action it led to, ideally where your perspective changed a group's conclusion. Don't repeat Essay A.", "al-stanford"),
])
P.optional("additional_information",
    "If there is any information that is critical for us to know and is not captured elsewhere, include it in the Additional Information section of the application.",
    ("words", 300), "gsb-essays", ["OPTIONAL"], required=False, verified=False,
    parts=["extenuating circumstances", "academic experience not noted elsewhere", "why no current supervisor recommends you", "founders: company transition plan"],
    notes=[
        ("GSB examples: extenuating academic, work or test circumstances; unlisted academic experience such as research; why you aren't using a current supervisor; founders' plans for handing over day-to-day leadership. 'This section should not be used as an additional essay.'", "gsb-essays"),
    ])
P.todo.append("application.optional_essay: no limit published on the essays page (300 is a placeholder); confirm in the portal")
P.reapplicant(essay=None, policy=[
    ("Reapplying is 'not a negative factor'; every year GSB admits reapplicants. Complete a new application; the reviewer likely hasn't seen the old one, though GSB may consult it. No feedback on denials. 'Approach your application with a fresh outlook. We will!' Reusing recommenders is fine if they write a current letter.", "gsb-reapply"),
])
P.recs("gsb-recs", 2, "school_specific", questions=[
    ("How does the applicant's performance compare to that of other well-qualified individuals in similar roles? Please provide specific examples.", "words", 500),
    ("Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.", "words", 500),
    "(Optional) Is there anything else we should know? Please be concise.",
], notes=[
    ("One from your current direct supervisor (or next best alternative) and one from someone else who has supervised you, within the last three years; no family or direct reports. Recommenders also rate leadership competencies.", "gsb-recs"),
    ("Recommenders must be the sole authors: drafting, editing, translating or submitting your own letter, or letting anyone review it, violates the terms, and letters can't be sent from your devices.", "gsb-recs"),
    ("Letters run two to four double-spaced pages; recommenders choose whether to answer the optional third question.", "gsb-recs"),
    ("GSB is 'impressed by what a recommendation letter says, not by the title or background of the individual who wrote it'.", "gsb-recs"),
    ("Brief recommenders with facts and stories only, never wording; read the GSB competency grid (innovative, determined when things go badly, persuasive, willing to take risks) to see the Stanford flavour of leadership.", ["al-stanford", "admitstory-coach"]),
])
P.resume("gsb-experience", 1, notes=[
    ("One page unless there's a compelling reason such as 10+ years' experience; no photos. GSB cares about 'the impact you have had in your workplace' more than the organisation's name; no industry or function is preferred.", "gsb-experience"),
])
P.add("application.test_policy", [
    ("GMAT or GRE required (interviews aren't granted without valid scores); TOEFL, IELTS or PTE for English proficiency where required. Scores valid for the round carry over for reapplicants.", ["gsb-interviews", "gsb-reapply"]),
])
P.add("application.fees_waivers", [
    ("Fee US$275; US$100 for defer-eligible applicants; waived for US active-duty military, honourably discharged veterans and reservists. Need-based waivers by request, due 18 Dec 2026, first come first served.", "gsb-fee"),
])

P.add("values.stated", [
    ("Mission: 'to develop principled, insightful, and innovative leaders.' The application seeks 'how you think, how you lead, and how you see the world'.", "gsb-criteria"),
    ("Leadership 'at all levels': 'when you have taken initiative, persisted through challenges, engaged others in your efforts, and supported those around you.' Past actions are 'the best predictor of future actions'.", "gsb-criteria"),
    ("How you think: GSB wants times 'you have taken the initiative to learn new things, solve challenging problems, or develop new insights. What have you discovered? How did you share what you learned? Why does it matter to you and others?'", "gsb-criteria"),
    ("How you see the world: 'Your values, beliefs, identity, and ambitions will help shape your journey and enrich the perspectives of your classmates… We are interested in how your background has shaped your path so far.'", "gsb-criteria"),
    ("'There is neither an ideal candidate nor a typical Stanford MBA student. In your application, we would like you, quite simply, to be yourself.'", "gsb-criteria"),
])
P.value("take initiative; innovative", ["acts_unasked", "originates_ideas"])
P.value("persist through challenges", ["resilient", "delivers_under_pressure"])
P.value("engage others; support those around you", ["brings_people_along", "develops_people", "empathetic"])
P.value("principled", ["principled_stands", "honest_about_limits"], ("Humility is non-negotiable: a whiff of arrogance anywhere in the file is fatal.", "al-stanford"))
P.add("insider_notes", [
    ("Class of 2027: 434 students; average GPA 3.76; average GMAT Focus 689 (range 615–785), GMAT 10th edition 738; average GRE 164 quant and verbal; 45% women; 38% international from 64 countries.", "ca-gsb-2027"),
    ("Strong admits have usually changed at least one life deeply, often an organisation, and sometimes shown the capacity for change at scale (GSB's motto: 'Change lives. Change organizations. Change the world.').", "al-stanford", 0.7),
    ("'Feedback' versus 'coaching': the line is crossed when any part of the application stops being exclusively yours in thought or word. 'It is improper… to have another person or tool write your essays.'", "gsb-essays"),
])
P.add("culture_and_location", [
    ("An intentionally small class (about 430) on the Stanford campus in Silicon Valley; collaborative learning that draws on everyone's background.", ["ca-gsb-2027", "gsb-criteria"], 0.8),
])
P.add("academics.structure", [
    ("Joint degrees include MS Computer Science/MBA, MS Electrical Engineering/MBA and MS Environment and Resources (E-IPER)/MBA; the MSx is a one-year program for experienced professionals.", "gsb-essays"),
    ("Quarter system with many short electives; the required first-year Leadership Labs; famous 'Touchy Feely' (Interpersonal Dynamics) and other OB electives; a global experience requirement.", "al-stanford", 0.7),
])
P.todo.append("academics: verify course names, the Global Experience Requirement and clubs from gsb.stanford.edu before citing")

P.employment("ca-gsb-2025", 2025, [
    ("Technology", 0.35, None), ("Finance", 0.33, None), ("Consulting", 0.11, None)], [])
P.add("careers.recruiting_notes", [
    ("Class of 2025: median base US$185,000; 90% of job seekers had offers within three months and 81% accepted; 63% sought jobs; 16% launched ventures.", "ca-gsb-2025"),
])
P.todo.append("careers.employment_report: replace with GSB's own positions-and-compensation data (the page renders by script)")
P.class_profile("ca-gsb-2027", 2027, size=434, gmat_focus=689, gmat=738, gre=(164, 164), gpa=3.76, intl=0.38)
P.todo.append("class_profile: figures are averages from a press summary of GSB's profile; verify on the GSB page")

P.interview("gsb-interviews", "invite_only", ["alum", "adcom"], None, 45, ["virtual", "hub"],
    questions=[
        ("Tell me about a time you had a significant impact on your organisation. What did you do, and how?", "gsb-interviews", 5),
        ("Describe a time you identified an opportunity that others had missed.", "al-stanford", 4),
        ("Tell me about a time you had to persuade someone who disagreed with you.", "admitstory-coach", 4),
    ],
    notes=[
        ("By invitation, with a trained alum or an admissions team member; required before any offer. GSB interviews two to three candidates per seat. Remote or in person; no on-campus requests; location and date don't affect your candidacy. Business attire recommended.", "gsb-interviews"),
        ("A structured behavioural interview on 'what you have done and how you have done it': past actions, not hypotheticals, from the past few years. Expect follow-ups probing your thinking, feelings and the reactions of others.", ["gsb-interviews", "admitstory-coach"]),
    ])
P.ai("pq-ai-2026", "prohibited", ["essays"],
    disclosure=None,
    notes=[
        ("GSB: 'It is improper and a violation of the terms of this application process to have another person or tool write your essays. Such behavior may result in denial of your application or revocation of your admission.'", "gsb-essays"),
        ("Recommendation letters must be written by recommenders alone, with no applicant or outside edits.", "gsb-recs"),
    ])
P.add("scholarships", [
    ("Knight-Hennessy Scholars is a separate Stanford-wide graduate scholarship with its own application and essays.", ["gsb-essays", "al-stanford"], 0.75),
])
P.add("avoid", [
    ("Any trace of arrogance or a list of accomplishments in Essay A.", "al-stanford"),
    ("A grand vision with no past impact to back it up.", "al-stanford"),
    ("Using Additional Information as another essay.", "gsb-essays"),
    ("Touching your recommendation letters in any way.", "gsb-recs"),
    ("Letting anyone or any tool write any part of your essays.", "gsb-essays"),
])
P.add("angles_that_work", [
    ("Essay A built from two or three hard decisions that reveal one value, with its origin and the cost it carried.", "al-stanford"),
    ("Short-answer examples that show the 'how and why' behind a resume line, with an interpersonal turn.", "gsb-short"),
])
P.term("What Matters Most", "GSB's Essay A: what matters most to you, and why.", "gsb-essays")
P.term("MSx", "Stanford GSB's one-year master's for experienced professionals; some applicants apply jointly to MBA and MSx.", "gsb-essays")
P.term("Touchy Feely", "Nickname for GSB's Interpersonal Dynamics elective.", "al-stanford")
P.write()
