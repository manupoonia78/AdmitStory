"""Builds a School Pack draft (packages/kb/src/schema/school-pack.ts) from a compact Python spec.

Items are written as tuples: (text, sources) or (text, sources, confidence). `sources` is a source
id or a list. K ids are assigned in document order. An item's verified_at is TODAY when at least
one of its sources was read this session (source `read=True`); otherwise null. Items whose only
sources are third_party_reference get approved_rewrite: true (Manu, 2026-11-04).
"""

import json, os

TODAY = "2026-11-04"
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
TRUST = {"official": 5, "adcom": 4, "insider": 3, "interview_reports": 3, "coach_notes": 4,
         "third_party_reference": 2, "press": 2}


class Pack:
    def __init__(self, slug, name, short_name, country, city, website, cycle="2026-27"):
        self.slug = slug
        self.k = 0
        self.sources = {}
        self.todo = []
        self.p = {
            "school": {"id": slug, "name": name, "short_name": short_name, "country": country,
                       "city": city, "website": website, "program": "full_time_mba"},
            "cycle": cycle, "version": 1, "status": "draft",
            "sources": [], "official_urls": [], "rounds": [],
            "application": {"essays": [], "short_answers": [], "goal_fields": [], "video": [],
                            "reapplicant": None, "optional_essay": None, "form_sections": [],
                            "recommendations": None, "resume": None, "test_policy": [],
                            "fees_waivers": []},
            "values": {"stated": [], "trait_map": []},
            "culture_and_location": [],
            "academics": {"courses": [], "centers": [], "experiential": [], "structure": []},
            "community": {"clubs": [], "traditions": [], "treks_events": []},
            "careers": {"employment_report": None, "recruiting_notes": []},
            "class_profile": None, "interview": None, "ai_policy": None,
            "scholarships": [], "insider_notes": [], "avoid": [], "angles_that_work": [],
            "glossary": [],
        }

    # -- plumbing ----------------------------------------------------------------------------
    def kid(self):
        self.k += 1
        return f"K{self.k:02d}"

    def source(self, sid, type_, title, url, read=True, rights=None, trust=None):
        self.sources[sid] = {"type": type_, "read": read}
        self.p["sources"].append({
            "id": sid, "type": type_, "title": title, "url": url,
            "trust": trust or TRUST[type_], "retrieved_at": TODAY if read else None,
            "rights_note": rights})

    def _srcs(self, s):
        s = [s] if isinstance(s, str) else list(s)
        for x in s:
            if x not in self.sources:
                raise KeyError(f"unknown source {x}")
        return s

    def _verified(self, srcs, verified=None):
        if verified is False:
            return None
        return TODAY if any(self.sources[x]["read"] for x in srcs) else None

    def cited(self, srcs, verified=None):
        srcs = self._srcs(srcs)
        return {"id": self.kid(), "source_ids": srcs, "verified_at": self._verified(srcs, verified)}

    def item(self, t):
        if isinstance(t, dict):
            return t
        text, srcs = t[0], self._srcs(t[1])
        conf = t[2] if len(t) > 2 else (0.75 if all(self.sources[x]["type"] == "third_party_reference" for x in srcs) else 0.85)
        out = {"id": self.kid(), "text": text, "source_ids": srcs,
               "verified_at": self._verified(srcs), "confidence": conf}
        if all(self.sources[x]["type"] == "third_party_reference" for x in srcs):
            out["approved_rewrite"] = True
        return out

    def items(self, ts):
        return [self.item(t) for t in ts]

    # -- sections ----------------------------------------------------------------------------
    def url(self, kind, url):
        self.p["official_urls"].append({"kind": kind, "url": url})

    def round(self, name, deadline, src, decision=None, invites=None, notes=()):
        r = {**self.cited(src), "name": name, "deadline": deadline}
        if decision: r["decision_date"] = decision
        if invites: r["interview_invites_window"] = invites
        r["notes"] = self.items(notes)
        self.p["rounds"].append(r)

    def prompt(self, key, verbatim, limit, src, archetypes, parts=(), required=True, notes=(), list_count=None, verified=None):
        kind, value = limit
        e = {**self.cited(src, verified), "key": key, "prompt_verbatim": verbatim,
             "limit": {"kind": kind, "value": value}, "required": required,
             "archetypes": list(archetypes), "parts": list(parts)}
        if list_count: e["list_count"] = list_count
        e["notes"] = self.items(notes)
        return e

    def essay(self, *a, **kw): self.p["application"]["essays"].append(self.prompt(*a, **kw))
    def short(self, *a, **kw): self.p["application"]["short_answers"].append(self.prompt(*a, **kw))
    def goal(self, *a, **kw): self.p["application"]["goal_fields"].append(self.prompt(*a, **kw))
    def optional(self, *a, **kw): self.p["application"]["optional_essay"] = self.prompt(*a, **kw)

    def reapplicant(self, essay=None, policy=()):
        self.p["application"]["reapplicant"] = {"essay": self.prompt(**essay) if essay else None,
                                                "policy": self.items(policy)}

    def video(self, src, format_="async_video", think=None, answer=None, attempts=None, scripting=False, qtypes=()):
        self.p["application"]["video"].append({**self.cited(src), "format": format_,
            "think_time_s": think, "answer_time_s": answer, "attempts": attempts,
            "question_types": self.items(qtypes), "scripting_allowed": scripting})

    def form(self, key, label, src, guidance=(), char_limit=None, item_count_max=None, limit_kind=None):
        f = {**self.cited(src), "key": key, "label": label}
        if item_count_max: f["item_count_max"] = item_count_max
        if char_limit: f["char_limit"] = char_limit
        if limit_kind: f["limit_kind"] = limit_kind
        f["guidance"] = self.items(guidance)
        self.p["application"]["form_sections"].append(f)

    def recs(self, src, count, fmt, questions=(), notes=()):
        self.p["application"]["recommendations"] = {**self.cited(src), "count": count, "format": fmt,
            "questions": [{"text_verbatim": q} if isinstance(q, str) else {"text_verbatim": q[0], "limit": {"kind": q[1], "value": q[2]}} for q in questions],
            "notes": self.items(notes)}

    def resume(self, src, pages, notes=()):
        self.p["application"]["resume"] = {**self.cited(src), "page_limit": pages, "notes": self.items(notes)}

    def add(self, path, ts):
        """Append items to a list of PackItems at a dotted path (e.g. 'application.test_policy')."""
        node = self.p
        for part in path.split("."):
            if "[" in part:
                name, idx = part[:-1].split("[")
                node = node[name][int(idx)]
            else:
                node = node[part]
        node.extend(self.items(ts))

    def value(self, school_value, traits, note=None):
        v = {"school_value": school_value, "admitstory_traits": list(traits)}
        if note: v["note"] = self.item(note)
        self.p["values"]["trait_map"].append(v)

    def thing(self, path, name, what, src, why=(), url=None):
        node = self.p
        for part in path.split("."):
            node = node[part]
        node.append({**self.cited(src), "name": name, "what_it_is": what,
                     "why_it_matters_for": list(why), "url": url})

    def employment(self, src, class_year, by_function, top_employers, currency="USD", intl=None):
        e = {**self.cited(src), "class_year": class_year, "currency": currency,
             "by_function": [{"function": f, "share": s, "median_base": m} for f, s, m in by_function],
             "top_employers": list(top_employers)}
        if intl: e["intl_offer_rates"] = self.item(intl)
        self.p["careers"]["employment_report"] = e

    def class_profile(self, src, class_year, size=None, gmat_focus=None, gmat=None, gre=None, gpa=None,
                      gpa_scale=4.0, wexp=None, intl=None):
        self.p["class_profile"] = {**self.cited(src), "class_year": class_year, "class_size": size,
            "gmat_focus_median": gmat_focus, "gmat_classic_median": gmat,
            "gre_median": ({"verbal": gre[0], "quant": gre[1]} if gre else None),
            "gpa_median": gpa, "gpa_scale": gpa_scale if gpa else None,
            "work_experience_years_median": wexp, "international_share": intl}

    def interview(self, src, invitation, who, blind, length, location, questions=(), notes=()):
        self.p["interview"] = {**self.cited(src), "invitation": invitation, "who": list(who),
            "blind": blind, "length_min": length, "location": list(location),
            "common_questions": [{**self.cited(q[1]), "text": q[0], "frequency_weight": q[2] if len(q) > 2 else 3} for q in questions],
            "format_notes": self.items(notes)}

    def ai(self, src, stance, applies_to=(), disclosure=None, notes=()):
        self.p["ai_policy"] = {**self.cited(src), "stance": stance, "applies_to": list(applies_to),
                               "disclosure_text": disclosure, "notes": self.items(notes)}

    def term(self, term, definition, src):
        self.p["glossary"].append({**self.cited(src), "term": term, "plain_definition": definition})

    def write(self):
        if self.p["ai_policy"] is None:
            self.p["ai_policy"] = {"id": self.kid(), "stance": "unknown", "applies_to": [],
                                   "disclosure_text": None, "notes": [], "source_ids": [], "verified_at": None}
        if self.todo:
            self.p["_todo"] = self.todo
        self.p["k_high_water"] = self.k
        # stable key order like the existing draft
        order = ["school", "cycle", "version", "status", "_todo", "k_high_water", "sources", "official_urls",
                 "rounds", "application", "values", "culture_and_location", "academics", "community",
                 "careers", "class_profile", "interview", "ai_policy", "scholarships", "insider_notes",
                 "avoid", "angles_that_work", "glossary"]
        out = {k: self.p[k] for k in order if k in self.p}
        d = os.path.join(REPO, "knowledge/schools", self.slug, self.p["cycle"])
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "pack.draft.json")
        with open(path, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
            f.write("\n")
        n_items = self.k
        n_unver = json.dumps(out).count('"verified_at": null')
        print(f"wrote {path}: {n_items} K ids, {n_unver} unverified, {len(self.todo)} todo")
        return path
