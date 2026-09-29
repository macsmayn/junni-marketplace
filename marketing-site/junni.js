/* Junni — bilingual copy + language switch. No dependencies. */
(function () {
  var DICT = {
    en: {
      "nav.pricing": "Pricing",
      "nav.login": "Log in",
      "nav.launch": "Launch app",

      "hero.h1": "Credit analysis infrastructure for private lenders",
      "hero.sub": "Turn a borrower's financial statements into a scored, benchmarked, memo-ready credit assessment. Minutes, not days.",
      "hero.cta": "Launch app",

      "memo.kicker": "Credit assessment",
      "memo.title": "Credit memo",
      "memo.illus": "Illustrative",
      "memo.grade": "Grade",
      "memo.m1": "Debt service coverage",
      "memo.m2": "Leverage",
      "memo.m3": "Liquidity",
      "memo.v1": "1.85x",
      "memo.v2": "3.1x",
      "memo.v3": "1.42x",
      "memo.bench": "Threshold for this sector",
      "memo.c1": "Sources & uses",
      "memo.c2": "Capitalization",
      "memo.c3": "Collateral",
      "memo.c4": "Narrative",

      "steps.eyebrow": "How it works",
      "steps.1n": "01",
      "steps.1h": "Upload the statements",
      "steps.1b": "Financial statements and tax returns, as they arrive from the borrower. No template to fill in first.",
      "steps.2n": "02",
      "steps.2h": "Figures are spread and confirmed",
      "steps.2b": "Junni extracts the numbers into a structured statement. You review and correct anything it read wrong before it scores.",
      "steps.3n": "03",
      "steps.3h": "Metrics are computed and graded",
      "steps.3b": "Ratios are calculated by formula, then graded against thresholds set for that industry. The score follows arithmetic, not a model's opinion.",
      "steps.4n": "04",
      "steps.4h": "The memo comes out finished",
      "steps.4b": "Executive summary, metric tables, strengths and risks, benchmarks and diligence questions. Export to PDF or Word.",

      "why.eyebrow": "Why it holds up",
      "why.h2": "A score you can defend in front of a credit committee",
      "why.p1": "Most AI credit tools hand you a number and no way to argue with it. Junni computes the score arithmetically. Every ratio has a visible formula, every grade names the threshold it was measured against, and the same file scored twice returns the same answer.",
      "why.p2": "The language model writes the narrative. It does not decide the score. That separation is deliberate, and it is what makes the output something you can put your name on.",
      "why.p3": "Thresholds are set per industry across 21 sectors, because a leverage ratio that is comfortable in professional services is not comfortable in construction.",

      "bench.eyebrow": "Benchmarks",
      "bench.h2": "Every deal sits against real loan outcomes",
      "bench.lead": "A ratio on its own tells you little. Junni places each borrower's sector against historical default and loss data from two public loan programs, so a grade carries context.",
      "bench.ca_t": "Canada",
      "bench.ca_k": "CSBFP",
      "bench.ca_stat": "214,158 loans",
      "bench.ca_b": "Canada Small Business Financing Program, cumulative across the full published history. Loss rates by sector, on both a count and a dollar basis.",
      "bench.us_t": "United States",
      "bench.us_k": "SBA 7(a)",
      "bench.us_stat": "697,558 loans",
      "bench.us_b": "Resolved SBA 7(a) loans across two windows: a normal cycle and a downturn cohort. Segmented by sector, loan size and term, so the comparison is like for like.",
      "bench.note": "Both are public programs, not private credit books, and neither includes borrower financials. Junni presents them as sector context, not as a prediction of any single borrower's outcome.",

      "art.eyebrow": "What comes out",
      "art.h2": "The memo arrives structured, not as a wall of prose",
      "art.lead": "Sources and uses, capitalization, collateral coverage and the questions still open on the file. Every figure traces back to a statement you confirmed.",
      "art.su_t": "Sources & uses",
      "art.su_k": "Illustrative",
      "art.su_c1": "Source",
      "art.su_c2": "Amount",
      "art.us_c1": "Use",
      "art.us_r1": "Equipment purchase",
      "art.us_r2": "Working capital",
      "art.us_r3": "Refinance existing debt",
      "art.us_r4": "Fees and closing costs",
      "art.us_tot": "Total uses",
      "art.su_r1": "Senior term loan",
      "art.su_r2": "Vendor note",
      "art.su_r3": "Sponsor equity",
      "art.su_tot": "Total sources",
      "art.su_note": "Sources and uses are reconciled against each other, and any gap is flagged.",
      "art.q_t": "Diligence questions",
      "art.q_k": "Illustrative",
      "art.q1": "Accounts receivable rose 41% while revenue rose 8%. What is driving the build, and what is the current aging profile?",
      "art.q2": "Gross margin held at 38% but net margin fell 260 basis points. Which operating costs grew, and are they recurring?",
      "art.q_note": "Questions are raised from the confirmed figures, and answers are recorded against the file.",
      "who.eyebrow": "Who it's for",
      "who.h2": "Built for Canadian alternative lenders, private debt funds and MCA originators.",
      "who.p": "The teams underwriting three to fifty files a month, where the analyst is the bottleneck and the deal that waits is the deal that goes elsewhere.",

      "cta.h2": "See it on a real file",
      "cta.p": "Upload a borrower's statements and read the memo it produces. The trial runs for 14 days.",

      "ftr.legal": "Junni Technologies Inc. · Montréal, QC",
      "ftr.rights": "© 2026 · All rights reserved",
      "ftr.privacy": "Privacy",
      "ftr.terms": "Terms",
      "ftr.contact": "Contact",

      /* pricing page */
      "pr.title": "Pricing",
      "pr.h1": "Priced per lending team, by volume",
      "pr.lede": "One subscription covers your whole team. Every plan includes a 14-day trial.",
      "pr.monthly": "Monthly",
      "pr.annual": "Annual",
      "pr.save": "2 months free",
      "pr.solo": "Solo",
      "pr.growth": "Growth",
      "pr.ent": "Enterprise",
      "pr.solo_seats": "Up to 3 people",
      "pr.growth_seats": "Up to 10 people",
      "pr.ent_seats": "Unlimited people",
      "pr.solo_m": "$500",
      "pr.solo_a": "$5,000",
      "pr.growth_m": "$750",
      "pr.growth_a": "$7,500",
      "pr.ent_p": "From $1,500",
      "pr.per_m": "CAD per month",
      "pr.per_a": "CAD per year",
      "pr.ent_a": "CAD per month, billed annually",
      "pr.solo_eq": "about $417 a month",
      "pr.growth_eq": "about $625 a month",
      "pr.solo_d": "<b>20 analyses a month.</b> Additional analyses are $40 each, billed only when you go over.",
      "pr.growth_d": "<b>50 analyses a month.</b> Additional analyses are $20 each, billed only when you go over.",
      "pr.ent_d": "<b>Volume set by contract.</b> Priority support and a shared onboarding session for your team.",
      "pr.start": "Start trial",
      "pr.talk": "Talk to us",

      "inc.eyebrow": "In every plan",
      "inc.1h": "Statement spreading",
      "inc.1b": "Financial statements and tax returns read into a structured statement you can correct before scoring.",
      "inc.2h": "Scoring across 21 industries",
      "inc.2b": "Ratios computed by formula and graded against thresholds set for the borrower's sector.",
      "inc.3h": "Historical benchmarks",
      "inc.3b": "Canadian CSBFP and US SBA 7(a) loan outcomes, shown alongside every assessment.",
      "inc.4h": "Diligence questions",
      "inc.4b": "Gaps and inconsistencies in the file turned into questions to put back to the borrower.",
      "inc.5h": "Memo export",
      "inc.5b": "The full assessment as a PDF or Word document, formatted for a credit file.",
      "inc.6h": "English and French",
      "inc.6b": "Interface, memos and narrative in both languages, switchable at any time.",
      "inc.7h": "Team accounts",
      "inc.7b": "Invite colleagues to a shared workspace. Everyone sees the team's files; billing stays with the owner.",
      "inc.8h": "Canadian hosting",
      "inc.8b": "Borrower data is stored in Canada, in a Montreal-region database.",

      "faq.eyebrow": "Questions",
      "faq.q1": "What counts as an analysis?",
      "faq.a1": "One borrower file, scored once. Re-running the score after correcting a figure does not count again, so fixing a typo costs nothing.",
      "faq.q2": "What happens when we go over the included volume?",
      "faq.a2": "Nothing stops. Additional analyses are billed at the rate for your plan and appear on your next invoice. If you go over regularly, the next plan up is cheaper.",
      "faq.q3": "Do you need a credit card for the trial?",
      "faq.a3": "Yes. The trial runs 14 days and becomes a paid subscription after that unless you cancel, which you can do yourself at any time.",
      "faq.q4": "Does Junni decide whether to lend?",
      "faq.a4": "No. Junni produces the analysis that precedes the decision. The credit judgment stays with your team, and the output is built to be argued with.",
      "faq.q5": "Where is our data held?",
      "faq.a5": "In a Canadian-region database. Billing is processed by Stripe and email by Resend, both outside Canada, and neither receives borrower financial statements.",
      "faq.q6": "Can we cancel?",
      "faq.a6": "Yes, from the billing page, without contacting anyone. Access continues to the end of the period you have paid for.",

      "pr.cta_h": "Start with your own file",
      "pr.cta_p": "The fastest way to judge this is to run a deal you already know the answer to."
    },

    fr: {
      "nav.pricing": "Tarifs",
      "nav.login": "Connexion",
      "nav.launch": "Ouvrir l'application",

      "hero.h1": "L'infrastructure d'analyse de crédit pour les prêteurs privés",
      "hero.sub": "Transformez les états financiers d'un emprunteur en une évaluation de crédit notée, comparée et prête à documenter. En quelques minutes, pas en quelques jours.",
      "hero.cta": "Ouvrir l'application",

      "memo.kicker": "Évaluation de crédit",
      "memo.title": "Mémo de crédit",
      "memo.illus": "Illustration",
      "memo.grade": "Cote",
      "memo.m1": "Couverture du service de la dette",
      "memo.m2": "Levier",
      "memo.m3": "Liquidité",
      "memo.v1": "1,85x",
      "memo.v2": "3,1x",
      "memo.v3": "1,42x",
      "memo.bench": "Seuil du secteur",
      "memo.c1": "Sources et emplois",
      "memo.c2": "Structure de capital",
      "memo.c3": "Garanties",
      "memo.c4": "Analyse",

      "steps.eyebrow": "Comment ça marche",
      "steps.1n": "01",
      "steps.1h": "Déposez les états financiers",
      "steps.1b": "États financiers et déclarations fiscales, tels que reçus de l'emprunteur. Aucun gabarit à remplir au préalable.",
      "steps.2n": "02",
      "steps.2h": "Les chiffres sont extraits et confirmés",
      "steps.2b": "Junni structure les données financières. Vous vérifiez et corrigez toute lecture erronée avant la notation.",
      "steps.3n": "03",
      "steps.3h": "Les ratios sont calculés et cotés",
      "steps.3b": "Les ratios sont calculés par formule, puis cotés selon des seuils propres à l'industrie. Le score suit l'arithmétique, pas l'opinion d'un modèle.",
      "steps.4n": "04",
      "steps.4h": "Le mémo sort terminé",
      "steps.4b": "Sommaire, tableaux de ratios, forces et risques, comparables et questions de vérification diligente. Export PDF ou Word.",

      "why.eyebrow": "Pourquoi ça tient",
      "why.h2": "Un score que vous pouvez défendre devant un comité de crédit",
      "why.p1": "La plupart des outils de crédit propulsés par l'IA vous donnent un chiffre sans moyen de le contester. Junni calcule le score arithmétiquement. Chaque ratio a une formule visible, chaque cote nomme le seuil auquel elle a été comparée, et le même dossier noté deux fois donne le même résultat.",
      "why.p2": "Le modèle de langage rédige l'analyse. Il ne décide pas du score. Cette séparation est délibérée, et c'est ce qui rend le résultat signable de votre nom.",
      "why.p3": "Les seuils sont définis par industrie, sur 21 secteurs, parce qu'un levier confortable en services professionnels ne l'est pas en construction.",

      "bench.eyebrow": "Comparables",
      "bench.h2": "Chaque dossier est situé par rapport à des résultats de prêts réels",
      "bench.lead": "Un ratio seul dit peu de choses. Junni situe le secteur de chaque emprunteur par rapport aux données historiques de défaut et de perte de deux programmes publics de prêt, pour qu'une cote ait du contexte.",
      "bench.ca_t": "Canada",
      "bench.ca_k": "PFPEC",
      "bench.ca_stat": "214 158 prêts",
      "bench.ca_b": "Programme de financement des petites entreprises du Canada, cumulatif sur tout l'historique publié. Taux de perte par secteur, en nombre et en dollars.",
      "bench.us_t": "États-Unis",
      "bench.us_k": "SBA 7(a)",
      "bench.us_stat": "697 558 prêts",
      "bench.us_b": "Prêts SBA 7(a) dénoués sur deux périodes : un cycle normal et une cohorte de récession. Segmentés par secteur, taille et durée, pour une comparaison équivalente.",
      "bench.note": "Ce sont deux programmes publics, pas des portefeuilles de crédit privé, et aucun ne contient les états financiers des emprunteurs. Junni les présente comme un contexte sectoriel, pas comme une prédiction du sort d'un emprunteur donné.",

      "art.eyebrow": "Ce qui en sort",
      "art.h2": "Le mémo arrive structuré, pas en bloc de texte",
      "art.lead": "Sources et emplois, structure de capital, couverture des garanties et les questions encore ouvertes au dossier. Chaque chiffre remonte à un état financier que vous avez confirmé.",
      "art.su_t": "Sources et emplois",
      "art.su_k": "Illustration",
      "art.su_c1": "Source",
      "art.su_c2": "Montant",
      "art.us_c1": "Emploi",
      "art.us_r1": "Achat d'équipement",
      "art.us_r2": "Fonds de roulement",
      "art.us_r3": "Refinancement de dette",
      "art.us_r4": "Frais et coûts de clôture",
      "art.us_tot": "Total des emplois",
      "art.su_r1": "Prêt à terme senior",
      "art.su_r2": "Billet du vendeur",
      "art.su_r3": "Mise de fonds du promoteur",
      "art.su_tot": "Total des sources",
      "art.su_note": "Les sources et les emplois sont rapprochés, et tout écart est signalé.",
      "art.q_t": "Questions de vérification diligente",
      "art.q_k": "Illustration",
      "art.q1": "Les comptes clients ont augmenté de 41 % alors que les revenus ont crû de 8 %. Qu'est-ce qui explique cette hausse, et quel est le profil de vieillissement actuel ?",
      "art.q2": "La marge brute s'est maintenue à 38 % mais la marge nette a reculé de 260 points de base. Quels coûts d'exploitation ont augmenté, et sont-ils récurrents ?",
      "art.q_note": "Les questions sont soulevées à partir des chiffres confirmés, et les réponses sont consignées au dossier.",
      "who.eyebrow": "À qui ça s'adresse",
      "who.h2": "Conçu pour les prêteurs alternatifs canadiens, les fonds de dette privée et les sociétés d'avance de fonds aux commerçants.",
      "who.p": "Les équipes qui analysent de trois à cinquante dossiers par mois, là où l'analyste est le goulot d'étranglement et où le dossier qui attend est le dossier qui part ailleurs.",

      "cta.h2": "Essayez-le sur un vrai dossier",
      "cta.p": "Déposez les états financiers d'un emprunteur et lisez le mémo produit. L'essai dure 14 jours.",

      "ftr.legal": "Junni Technologies Inc. · Montréal, QC",
      "ftr.rights": "© 2026 · Tous droits réservés",
      "ftr.privacy": "Confidentialité",
      "ftr.terms": "Conditions",
      "ftr.contact": "Contact",

      "pr.title": "Tarifs",
      "pr.h1": "Un tarif par équipe de crédit, selon le volume",
      "pr.lede": "Un seul abonnement couvre toute votre équipe. Chaque forfait comprend un essai de 14 jours.",
      "pr.monthly": "Mensuel",
      "pr.annual": "Annuel",
      "pr.save": "2 mois offerts",
      "pr.solo": "Solo",
      "pr.growth": "Growth",
      "pr.ent": "Enterprise",
      "pr.solo_seats": "Jusqu'à 3 personnes",
      "pr.growth_seats": "Jusqu'à 10 personnes",
      "pr.ent_seats": "Personnes illimitées",
      "pr.solo_m": "500 $",
      "pr.solo_a": "5 000 $",
      "pr.growth_m": "750 $",
      "pr.growth_a": "7 500 $",
      "pr.ent_p": "Dès 1 500 $",
      "pr.per_m": "CAD par mois",
      "pr.per_a": "CAD par année",
      "pr.ent_a": "CAD par mois, facturé annuellement",
      "pr.solo_eq": "environ 417 $ par mois",
      "pr.growth_eq": "environ 625 $ par mois",
      "pr.solo_d": "<b>20 analyses par mois.</b> Les analyses supplémentaires sont à 40 $ chacune, facturées seulement au-delà.",
      "pr.growth_d": "<b>50 analyses par mois.</b> Les analyses supplémentaires sont à 20 $ chacune, facturées seulement au-delà.",
      "pr.ent_d": "<b>Volume fixé par contrat.</b> Soutien prioritaire et séance d'intégration pour votre équipe.",
      "pr.start": "Commencer l'essai",
      "pr.talk": "Nous parler",

      "inc.eyebrow": "Dans chaque forfait",
      "inc.1h": "Extraction des états financiers",
      "inc.1b": "États financiers et déclarations fiscales convertis en données structurées que vous pouvez corriger avant la notation.",
      "inc.2h": "Notation sur 21 industries",
      "inc.2b": "Ratios calculés par formule et cotés selon des seuils propres au secteur de l'emprunteur.",
      "inc.3h": "Comparables historiques",
      "inc.3b": "Résultats de prêts du PFPEC canadien et du SBA 7(a) américain, présentés avec chaque évaluation.",
      "inc.4h": "Questions de vérification diligente",
      "inc.4b": "Les lacunes et incohérences du dossier converties en questions à poser à l'emprunteur.",
      "inc.5h": "Export du mémo",
      "inc.5b": "L'évaluation complète en PDF ou en Word, formatée pour un dossier de crédit.",
      "inc.6h": "Français et anglais",
      "inc.6b": "Interface, mémos et analyse dans les deux langues, changeable à tout moment.",
      "inc.7h": "Comptes d'équipe",
      "inc.7b": "Invitez vos collègues dans un espace partagé. Chacun voit les dossiers de l'équipe; la facturation reste au propriétaire.",
      "inc.8h": "Hébergement canadien",
      "inc.8b": "Les données des emprunteurs sont stockées au Canada, dans une base de données de la région de Montréal.",

      "faq.eyebrow": "Questions",
      "faq.q1": "Qu'est-ce qui compte comme une analyse ?",
      "faq.a1": "Un dossier d'emprunteur, noté une fois. Relancer la notation après avoir corrigé un chiffre ne compte pas une seconde fois, donc corriger une erreur de saisie ne coûte rien.",
      "faq.q2": "Que se passe-t-il si nous dépassons le volume inclus ?",
      "faq.a2": "Rien ne s'arrête. Les analyses supplémentaires sont facturées au tarif de votre forfait et apparaissent sur la facture suivante. Si vous dépassez régulièrement, le forfait supérieur revient moins cher.",
      "faq.q3": "Faut-il une carte de crédit pour l'essai ?",
      "faq.a3": "Oui. L'essai dure 14 jours et devient un abonnement payant ensuite, sauf annulation, que vous pouvez faire vous-même à tout moment.",
      "faq.q4": "Est-ce que Junni décide d'accorder le prêt ?",
      "faq.a4": "Non. Junni produit l'analyse qui précède la décision. Le jugement de crédit reste à votre équipe, et le résultat est conçu pour être contesté.",
      "faq.q5": "Où sont conservées nos données ?",
      "faq.a5": "Dans une base de données de région canadienne. La facturation passe par Stripe et les courriels par Resend, tous deux hors Canada, et aucun ne reçoit les états financiers des emprunteurs.",
      "faq.q6": "Peut-on annuler ?",
      "faq.a6": "Oui, depuis la page de facturation, sans contacter personne. L'accès se poursuit jusqu'à la fin de la période payée.",

      "pr.cta_h": "Commencez par un de vos dossiers",
      "pr.cta_p": "Le meilleur moyen de juger, c'est d'analyser un dossier dont vous connaissez déjà la réponse."
    }
  };

  function apply(lang) {
    var d = DICT[lang] || DICT.en;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-t]").forEach(function (el) {
      var v = d[el.getAttribute("data-t")];
      if (v == null) return;
      if (v.indexOf("<b>") !== -1) { el.innerHTML = v; } else { el.textContent = v; }
    });

    document.querySelectorAll("[data-t-aria]").forEach(function (el) {
      var v = d[el.getAttribute("data-t-aria")];
      if (v != null) el.setAttribute("aria-label", v);
    });

    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    try { localStorage.setItem("junni_lang", lang); } catch (e) {}

    if (typeof window.onJunniLang === "function") window.onJunniLang(lang);
  }

  function initial() {
    var stored = null;
    try { stored = localStorage.getItem("junni_lang"); } catch (e) {}
    if (stored === "en" || stored === "fr") return stored;
    return (navigator.language || "en").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () { apply(b.dataset.lang); });
    });
    apply(initial());
  });
})();
