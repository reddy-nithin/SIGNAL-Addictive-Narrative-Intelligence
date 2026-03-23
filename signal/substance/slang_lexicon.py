"""
Slang-to-clinical substance lexicon.
=====================================
~350 street/slang/brand terms mapped to canonical pharmacological names.
Compiled regex patterns for fast matching, sorted longest-first.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from signal.config import MUST_INCLUDE_OPIOIDS


@dataclass(frozen=True)
class LexiconEntry:
    """A single slang→clinical mapping."""
    slang: str           # street/brand term (lowercase)
    clinical_name: str   # canonical pharmacological name (lowercase)
    drug_class: str      # opioid | benzo | stimulant | alcohol | cannabis | other


# ── Lexicon Data ─────────────────────────────────────────────────────────────
# Organized by drug class. Each entry is (slang, clinical_name, drug_class).
# Clinical names themselves are included so exact mentions are also caught.

_RAW_ENTRIES: tuple[tuple[str, str, str], ...] = (
    # ── OPIOIDS (~80 entries) ────────────────────────────────────────────────
    # fentanyl
    ("fentanyl", "fentanyl", "opioid"),
    ("fent", "fentanyl", "opioid"),
    ("fetty", "fentanyl", "opioid"),
    ("blues", "fentanyl", "opioid"),
    ("blue boys", "fentanyl", "opioid"),
    ("m30s", "fentanyl", "opioid"),
    ("m30", "fentanyl", "opioid"),
    ("china white", "fentanyl", "opioid"),
    ("fake percs", "fentanyl", "opioid"),
    ("pressed pills", "fentanyl", "opioid"),
    ("presses", "fentanyl", "opioid"),
    ("tranq dope", "fentanyl", "opioid"),
    ("carfentanil", "fentanyl", "opioid"),
    ("acetylfentanyl", "fentanyl", "opioid"),
    ("apache", "fentanyl", "opioid"),
    ("tnt", "fentanyl", "opioid"),
    ("jackpot", "fentanyl", "opioid"),
    ("goodfella", "fentanyl", "opioid"),
    ("murder 8", "fentanyl", "opioid"),
    ("china girl", "fentanyl", "opioid"),
    ("dance fever", "fentanyl", "opioid"),
    ("friend", "fentanyl", "opioid"),
    # oxycodone
    ("oxycodone", "oxycodone", "opioid"),
    ("oxy", "oxycodone", "opioid"),
    ("oxys", "oxycodone", "opioid"),
    ("oxycontin", "oxycodone", "opioid"),
    ("percocet", "oxycodone", "opioid"),
    ("percs", "oxycodone", "opioid"),
    ("perc", "oxycodone", "opioid"),
    ("roxicodone", "oxycodone", "opioid"),
    ("roxys", "oxycodone", "opioid"),
    ("roxy", "oxycodone", "opioid"),
    ("hillbilly heroin", "oxycodone", "opioid"),
    ("kickers", "oxycodone", "opioid"),
    ("oc", "oxycodone", "opioid"),
    ("512s", "oxycodone", "opioid"),
    ("cotton", "oxycodone", "opioid"),
    # hydrocodone
    ("hydrocodone", "hydrocodone", "opioid"),
    ("vicodin", "hydrocodone", "opioid"),
    ("vics", "hydrocodone", "opioid"),
    ("norco", "hydrocodone", "opioid"),
    ("hydros", "hydrocodone", "opioid"),
    ("lortab", "hydrocodone", "opioid"),
    ("tabs", "hydrocodone", "opioid"),
    ("watsons", "hydrocodone", "opioid"),
    ("dro", "hydrocodone", "opioid"),
    ("bananas", "hydrocodone", "opioid"),
    ("357s", "hydrocodone", "opioid"),
    # heroin
    ("heroin", "heroin", "opioid"),
    ("dope", "heroin", "opioid"),
    ("smack", "heroin", "opioid"),
    ("horse", "heroin", "opioid"),
    ("boy", "heroin", "opioid"),
    ("tar", "heroin", "opioid"),
    ("black tar", "heroin", "opioid"),
    ("junk", "heroin", "opioid"),
    ("skag", "heroin", "opioid"),
    ("h bomb", "heroin", "opioid"),
    ("brown sugar", "heroin", "opioid"),
    ("dragon", "heroin", "opioid"),
    ("big h", "heroin", "opioid"),
    ("mud", "heroin", "opioid"),
    ("thunder", "heroin", "opioid"),
    ("white lady", "heroin", "opioid"),
    ("chasing the dragon", "heroin", "opioid"),
    ("fix", "heroin", "opioid"),
    ("mexican brown", "heroin", "opioid"),
    ("skunk", "heroin", "opioid"),
    # morphine
    ("morphine", "morphine", "opioid"),
    ("ms contin", "morphine", "opioid"),
    ("morph", "morphine", "opioid"),
    ("miss emma", "morphine", "opioid"),
    ("morf", "morphine", "opioid"),
    ("dreamer", "morphine", "opioid"),
    ("monkey", "morphine", "opioid"),
    # buprenorphine
    ("buprenorphine", "buprenorphine", "opioid"),
    ("suboxone", "buprenorphine", "opioid"),
    ("subutex", "buprenorphine", "opioid"),
    ("subs", "buprenorphine", "opioid"),
    ("strips", "buprenorphine", "opioid"),
    ("bupe", "buprenorphine", "opioid"),
    ("boxes", "buprenorphine", "opioid"),
    ("oranges", "buprenorphine", "opioid"),
    ("bupes", "buprenorphine", "opioid"),
    ("saboxins", "buprenorphine", "opioid"),
    ("sobos", "buprenorphine", "opioid"),
    # methadone
    ("methadone", "methadone", "opioid"),
    ("done", "methadone", "opioid"),
    ("methadose", "methadone", "opioid"),
    ("dollies", "methadone", "opioid"),
    ("phy", "methadone", "opioid"),
    ("fizzies", "methadone", "opioid"),
    ("metho", "methadone", "opioid"),
    # codeine
    ("codeine", "codeine", "opioid"),
    ("lean", "codeine", "opioid"),
    ("purple drank", "codeine", "opioid"),
    ("sizzurp", "codeine", "opioid"),
    ("dirty sprite", "codeine", "opioid"),
    ("syrup", "codeine", "opioid"),
    ("schoolboy", "codeine", "opioid"),
    ("cody", "codeine", "opioid"),
    ("captain cody", "codeine", "opioid"),
    # tramadol
    ("tramadol", "tramadol", "opioid"),
    ("ultram", "tramadol", "opioid"),
    ("trammies", "tramadol", "opioid"),
    # tapentadol
    ("tapentadol", "tapentadol", "opioid"),
    ("nucynta", "tapentadol", "opioid"),
    # meperidine
    ("meperidine", "meperidine", "opioid"),
    ("demerol", "meperidine", "opioid"),
    # hydromorphone
    ("hydromorphone", "hydromorphone", "opioid"),
    ("dilaudid", "hydromorphone", "opioid"),
    ("dillies", "hydromorphone", "opioid"),
    # oxymorphone
    ("oxymorphone", "oxymorphone", "opioid"),
    ("opana", "oxymorphone", "opioid"),
    # naloxone
    ("naloxone", "naloxone", "opioid"),
    ("narcan", "naloxone", "opioid"),
    # naltrexone
    ("naltrexone", "naltrexone", "opioid"),
    ("vivitrol", "naltrexone", "opioid"),
    ("revia", "naltrexone", "opioid"),
    # generic opioid terms
    ("opioid", "opioid", "opioid"),
    ("opioids", "opioid", "opioid"),
    ("opiate", "opioid", "opioid"),
    ("opiates", "opioid", "opioid"),
    ("painkillers", "opioid", "opioid"),
    ("pain pills", "opioid", "opioid"),
    ("kratom", "kratom", "opioid"),

    # ── BENZODIAZEPINES ───────────────────────────────────────────────────────
    ("alprazolam", "alprazolam", "benzo"),
    ("xanax", "alprazolam", "benzo"),
    ("xannies", "alprazolam", "benzo"),
    ("xans", "alprazolam", "benzo"),
    ("bars", "alprazolam", "benzo"),
    ("zans", "alprazolam", "benzo"),
    ("zannies", "alprazolam", "benzo"),
    ("footballs", "alprazolam", "benzo"),
    ("ladders", "alprazolam", "benzo"),
    ("planks", "alprazolam", "benzo"),
    ("school bus", "alprazolam", "benzo"),
    ("yellow boys", "alprazolam", "benzo"),
    ("blue footballs", "alprazolam", "benzo"),
    ("z-bars", "alprazolam", "benzo"),
    ("xanbars", "alprazolam", "benzo"),
    ("white girls", "alprazolam", "benzo"),
    ("bicycle parts", "alprazolam", "benzo"),
    ("totem poles", "alprazolam", "benzo"),
    ("upjohn", "alprazolam", "benzo"),
    ("clonazepam", "clonazepam", "benzo"),
    ("klonopin", "clonazepam", "benzo"),
    ("k-pins", "clonazepam", "benzo"),
    ("klons", "clonazepam", "benzo"),
    ("diazepam", "diazepam", "benzo"),
    ("valium", "diazepam", "benzo"),
    ("vals", "diazepam", "benzo"),
    ("vallies", "diazepam", "benzo"),
    ("tranks", "diazepam", "benzo"),
    ("lorazepam", "lorazepam", "benzo"),
    ("ativan", "lorazepam", "benzo"),
    ("temazepam", "temazepam", "benzo"),
    ("restoril", "temazepam", "benzo"),
    ("flunitrazepam", "flunitrazepam", "benzo"),
    ("rohypnol", "flunitrazepam", "benzo"),
    ("roofies", "flunitrazepam", "benzo"),
    ("etizolam", "etizolam", "benzo"),
    ("etiz", "etizolam", "benzo"),
    ("pregabalin", "pregabalin", "benzo"),
    ("lyrica", "pregabalin", "benzo"),
    ("benzodiazepine", "benzodiazepine", "benzo"),
    ("benzos", "benzodiazepine", "benzo"),
    ("benzo", "benzodiazepine", "benzo"),
    ("downers", "benzodiazepine", "benzo"),
    ("gabapentin", "gabapentin", "benzo"),
    ("gabbies", "gabapentin", "benzo"),
    ("neurontin", "gabapentin", "benzo"),

    # ── STIMULANTS ───────────────────────────────────────────────────────────
    ("cocaine", "cocaine", "stimulant"),
    ("coke", "cocaine", "stimulant"),
    ("blow", "cocaine", "stimulant"),
    ("snow", "cocaine", "stimulant"),
    ("yayo", "cocaine", "stimulant"),
    ("nose candy", "cocaine", "stimulant"),
    ("crack", "cocaine", "stimulant"),
    ("crack cocaine", "cocaine", "stimulant"),
    ("rock", "cocaine", "stimulant"),
    ("freebase", "cocaine", "stimulant"),
    ("toot", "cocaine", "stimulant"),
    ("bump", "cocaine", "stimulant"),
    ("rail", "cocaine", "stimulant"),
    ("charlie", "cocaine", "stimulant"),
    ("fishscale", "cocaine", "stimulant"),
    ("eightball", "cocaine", "stimulant"),
    ("pearl", "cocaine", "stimulant"),
    ("stash", "cocaine", "stimulant"),
    ("base", "cocaine", "stimulant"),
    ("nuggets", "cocaine", "stimulant"),
    ("methamphetamine", "methamphetamine", "stimulant"),
    ("meth", "methamphetamine", "stimulant"),
    ("crystal meth", "methamphetamine", "stimulant"),
    ("crystal", "methamphetamine", "stimulant"),
    ("ice", "methamphetamine", "stimulant"),
    ("tina", "methamphetamine", "stimulant"),
    ("crank", "methamphetamine", "stimulant"),
    ("glass", "methamphetamine", "stimulant"),
    ("shards", "methamphetamine", "stimulant"),
    ("tweek", "methamphetamine", "stimulant"),
    ("go fast", "methamphetamine", "stimulant"),
    ("geek", "methamphetamine", "stimulant"),
    ("speed", "amphetamine", "stimulant"),
    ("amphetamine", "amphetamine", "stimulant"),
    ("adderall", "amphetamine", "stimulant"),
    ("addys", "amphetamine", "stimulant"),
    ("dexedrine", "amphetamine", "stimulant"),
    ("dexies", "amphetamine", "stimulant"),
    ("uppers", "amphetamine", "stimulant"),
    ("pep pills", "amphetamine", "stimulant"),
    ("christmas trees", "amphetamine", "stimulant"),
    ("black beauties", "amphetamine", "stimulant"),
    ("bennies", "amphetamine", "stimulant"),
    ("mdma", "mdma", "stimulant"),
    ("molly", "mdma", "stimulant"),
    ("ecstasy", "mdma", "stimulant"),
    ("rolls", "mdma", "stimulant"),
    ("mandy", "mdma", "stimulant"),
    ("adam", "mdma", "stimulant"),
    ("pingers", "mdma", "stimulant"),
    ("caps", "mdma", "stimulant"),
    ("dove", "mdma", "stimulant"),
    ("methylphenidate", "methylphenidate", "stimulant"),
    ("ritalin", "methylphenidate", "stimulant"),
    ("concerta", "methylphenidate", "stimulant"),
    ("vitamin r", "methylphenidate", "stimulant"),
    ("r-ball", "methylphenidate", "stimulant"),
    ("kiddie cocaine", "methylphenidate", "stimulant"),
    ("skippy", "methylphenidate", "stimulant"),

    # ── ALCOHOL ───────────────────────────────────────────────────────────────
    ("alcohol", "alcohol", "alcohol"),
    ("ethanol", "alcohol", "alcohol"),
    ("booze", "alcohol", "alcohol"),
    ("liquor", "alcohol", "alcohol"),
    ("vodka", "alcohol", "alcohol"),
    ("whiskey", "alcohol", "alcohol"),
    ("beer", "alcohol", "alcohol"),
    ("wine", "alcohol", "alcohol"),
    ("drinking", "alcohol", "alcohol"),
    ("drunk", "alcohol", "alcohol"),
    ("alcoholism", "alcohol", "alcohol"),
    ("alcoholic", "alcohol", "alcohol"),
    ("hooch", "alcohol", "alcohol"),
    ("sauce", "alcohol", "alcohol"),
    ("suds", "alcohol", "alcohol"),
    ("hard stuff", "alcohol", "alcohol"),
    ("spirits", "alcohol", "alcohol"),
    ("giggle juice", "alcohol", "alcohol"),
    ("bender", "alcohol", "alcohol"),
    ("wasted", "alcohol", "alcohol"),
    ("hammered", "alcohol", "alcohol"),

    # ── CANNABIS ──────────────────────────────────────────────────────────────
    ("cannabis", "cannabis", "cannabis"),
    ("marijuana", "cannabis", "cannabis"),
    ("weed", "cannabis", "cannabis"),
    ("pot", "cannabis", "cannabis"),
    ("mary jane", "cannabis", "cannabis"),
    ("reefer", "cannabis", "cannabis"),
    ("bud", "cannabis", "cannabis"),
    ("flower", "cannabis", "cannabis"),
    ("dabs", "cannabis", "cannabis"),
    ("wax", "cannabis", "cannabis"),
    ("shatter", "cannabis", "cannabis"),
    ("edibles", "cannabis", "cannabis"),
    ("grass", "cannabis", "cannabis"),
    ("thc", "cannabis", "cannabis"),
    ("cbd", "cannabis", "cannabis"),
    ("ganja", "cannabis", "cannabis"),
    ("herb", "cannabis", "cannabis"),
    ("trees", "cannabis", "cannabis"),
    ("chronic", "cannabis", "cannabis"),
    ("dank", "cannabis", "cannabis"),
    ("cheeba", "cannabis", "cannabis"),
    ("devil's lettuce", "cannabis", "cannabis"),
    ("420", "cannabis", "cannabis"),
    ("joint", "cannabis", "cannabis"),
    ("blunt", "cannabis", "cannabis"),
    ("spliff", "cannabis", "cannabis"),
    ("hashish", "cannabis", "cannabis"),
    ("hash", "cannabis", "cannabis"),
    ("kief", "cannabis", "cannabis"),
    ("rosin", "cannabis", "cannabis"),
    ("nugs", "cannabis", "cannabis"),
    ("sticky icky", "cannabis", "cannabis"),
    ("spice", "synthetic_cannabinoid", "cannabis"),
    ("k2", "synthetic_cannabinoid", "cannabis"),
    ("synthetic weed", "synthetic_cannabinoid", "cannabis"),

    # ── OTHER ─────────────────────────────────────────────────────────────────
    ("pcp", "pcp", "other"),
    ("angel dust", "pcp", "other"),
    ("wet", "pcp", "other"),
    ("wack", "pcp", "other"),
    ("love boat", "pcp", "other"),
    ("hog", "pcp", "other"),
    ("embalming fluid", "pcp", "other"),
    ("peace pill", "pcp", "other"),
    ("ketamine", "ketamine", "other"),
    ("special k", "ketamine", "other"),
    ("k-hole", "ketamine", "other"),
    ("ket", "ketamine", "other"),
    ("vitamin k", "ketamine", "other"),
    ("kit kat", "ketamine", "other"),
    ("cat valium", "ketamine", "other"),
    ("horse tranquilizer", "ketamine", "other"),
    ("lsd", "lsd", "other"),
    ("acid", "lsd", "other"),
    ("blotter", "lsd", "other"),
    ("tab", "lsd", "other"),
    ("lucy", "lsd", "other"),
    ("dose", "lsd", "other"),
    ("golden dragon", "lsd", "other"),
    ("mushrooms", "psilocybin", "other"),
    ("shrooms", "psilocybin", "other"),
    ("psilocybin", "psilocybin", "other"),
    ("magic mushrooms", "psilocybin", "other"),
    ("golden teachers", "psilocybin", "other"),
    ("liberty caps", "psilocybin", "other"),
    ("ghb", "ghb", "other"),
    ("liquid ecstasy", "ghb", "other"),
    ("liquid x", "ghb", "other"),
    ("fantasy", "ghb", "other"),
    ("dxm", "dextromethorphan", "other"),
    ("robo", "dextromethorphan", "other"),
    ("robo tripping", "dextromethorphan", "other"),
    ("triple c", "dextromethorphan", "other"),
    ("tussin", "dextromethorphan", "other"),
    ("velvet", "dextromethorphan", "other"),
    ("whippets", "nitrous_oxide", "other"),
    ("nangs", "nitrous_oxide", "other"),
    ("laughing gas", "nitrous_oxide", "other"),
    ("hippie crack", "nitrous_oxide", "other"),
    ("nos", "nitrous_oxide", "other"),
    ("balloons", "nitrous_oxide", "other"),
    ("poppers", "amyl_nitrite", "other"),
    ("inhalants", "inhalant", "other"),
)

# ── Build Lexicon ────────────────────────────────────────────────────────────

SLANG_LEXICON: tuple[LexiconEntry, ...] = tuple(
    LexiconEntry(slang=s.lower(), clinical_name=c.lower(), drug_class=d)
    for s, c, d in _RAW_ENTRIES
)

# O(1) slang → entry lookup (lowercase keys)
_LOOKUP_INDEX: dict[str, LexiconEntry] = {entry.slang: entry for entry in SLANG_LEXICON}

# Clinical name → drug class mapping (used by embedding/llm detectors)
CLINICAL_TO_CLASS: dict[str, str] = {
    entry.clinical_name: entry.drug_class for entry in SLANG_LEXICON
}

# All unique clinical names in the lexicon
ALL_CLINICAL_NAMES: tuple[str, ...] = tuple(sorted(set(
    entry.clinical_name for entry in SLANG_LEXICON
)))


def get_clinical_name(term: str) -> LexiconEntry | None:
    """Look up a slang/brand term → LexiconEntry. Case-insensitive."""
    return _LOOKUP_INDEX.get(term.lower().strip())


# ── Compiled Regex Patterns ──────────────────────────────────────────────────
# Sorted longest-first to prevent partial matches ("xanax" before "xan").

_SORTED_TERMS: list[str] = sorted(
    (entry.slang for entry in SLANG_LEXICON),
    key=len,
    reverse=True,
)

# Single compiled regex with alternation — word boundaries, case-insensitive
SUBSTANCE_PATTERN: re.Pattern = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in _SORTED_TERMS) + r")s?\b",
    re.IGNORECASE,
)

# Individual patterns for per-term matching with entry lookup
_TERM_PATTERNS: tuple[tuple[re.Pattern, LexiconEntry], ...] = tuple(
    (re.compile(r"\b" + re.escape(entry.slang) + r"s?\b", re.IGNORECASE), entry)
    for entry in sorted(SLANG_LEXICON, key=lambda e: len(e.slang), reverse=True)
)


def find_all_matches(text: str) -> list[tuple[re.Match, LexiconEntry]]:
    """Find all substance matches in text, longest-first, non-overlapping."""
    matches: list[tuple[re.Match, LexiconEntry]] = []
    used_spans: list[tuple[int, int]] = []

    for pattern, entry in _TERM_PATTERNS:
        for m in pattern.finditer(text):
            span = (m.start(), m.end())
            # Skip if overlapping with an already-matched span
            if any(s <= span[0] < e or s < span[1] <= e for s, e in used_spans):
                continue
            matches.append((m, entry))
            used_spans.append(span)

    return matches


# ── Validation ───────────────────────────────────────────────────────────────

def validate_coverage() -> list[str]:
    """Check that all MUST_INCLUDE_OPIOIDS appear as clinical targets.
    Returns list of missing opioid names (empty = all covered).
    """
    covered = {entry.clinical_name for entry in SLANG_LEXICON}
    return [name for name in MUST_INCLUDE_OPIOIDS if name not in covered]
