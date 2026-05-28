import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = fileURLToPath(new URL(".", import.meta.url));

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function classBox({ name, attrs, x, y, w = 320 }) {
  const lineHeight = 20;
  const headerHeight = 34;
  const pad = 14;
  const h = headerHeight + pad + attrs.length * lineHeight + pad;
  const rows = attrs
    .map((attr, index) => {
      const yy = y + headerHeight + pad + 15 + index * lineHeight;
      return `<text x="${x + 14}" y="${yy}" class="attr">${esc(attr)}</text>`;
    })
    .join("\n");
  return {
    name,
    x,
    y,
    w,
    h,
    svg: `
      <g id="class-${name}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="class-box"/>
        <rect x="${x}" y="${y}" width="${w}" height="${headerHeight}" rx="8" class="class-head"/>
        <path d="M ${x} ${y + headerHeight - 8} H ${x + w} V ${y + headerHeight} H ${x} Z" class="class-head"/>
        <text x="${x + w / 2}" y="${y + 23}" class="class-name">${esc(name)}</text>
        ${rows}
      </g>`,
  };
}

function packageBox(title, x, y, w, h, fill = "#f8fafc") {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="#cbd5e1" stroke-width="2"/>
      <text x="${x + 18}" y="${y + 30}" class="package-title">${esc(title)}</text>
    </g>`;
}

function relation(from, to, boxes, label, cls = "rel") {
  const a = boxes[from];
  const b = boxes[to];
  if (!a || !b) return "";
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mid = (x1 + x2) / 2;
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 8;
  return `
    <path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" class="${cls}"/>
    <text x="${labelX}" y="${labelY}" class="rel-label">${esc(label)}</text>`;
}

function verticalRelation(from, to, boxes, label, cls = "rel") {
  const a = boxes[from];
  const b = boxes[to];
  if (!a || !b) return "";
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y;
  const midY = (y1 + y2) / 2;
  return `
    <path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" class="${cls}"/>
    <text x="${(x1 + x2) / 2}" y="${midY - 8}" class="rel-label">${esc(label)}</text>`;
}

function buildClassDiagram() {
  const boxes = {};
  const items = [
    classBox({
      name: "Utilisateur",
      x: 70,
      y: 120,
      attrs: ["+ id: int", "+ nom, prenom: String", "+ email: String", "+ motDePasse: String", "+ role: RoleEnum", "+ actif, emailVerifie: Boolean", "+ dernierLogin: DateTime"],
    }),
    classBox({
      name: "Encadreur",
      x: 70,
      y: 360,
      attrs: ["+ matricule: String", "+ grade: GradeEnum", "+ departement: DepartementEnum", "+ actif_encadrement: Boolean", "+ max_stagiaires: int", "+ peut_prendre_stagiaire(): bool"],
    }),
    classBox({
      name: "Stagiaire",
      x: 70,
      y: 590,
      attrs: ["+ matricule: String", "+ type_stage: TypeStageEnum", "+ statut_stage: StatutStageEnum", "+ dates stage: Date", "+ etablissement: String", "+ note_finale: int"],
    }),
    classBox({
      name: "ResetMotDePasse",
      x: 70,
      y: 820,
      attrs: ["+ token: String", "+ date_creation: DateTime", "+ date_expiration: Date", "+ utilisee: Boolean"],
    }),

    classBox({
      name: "DemandeStage",
      x: 500,
      y: 100,
      attrs: ["+ identite candidat", "+ email, telephone", "+ etablissement", "+ departement_souhaite", "+ dates souhaitees", "+ competences, tags: JSON", "+ statut: StatutDemandeEnum"],
    }),
    classBox({
      name: "Document",
      x: 500,
      y: 370,
      attrs: ["+ demande_id: int", "+ user_id: int", "+ type: DocumentTypeEnum", "+ file_path: String", "+ created_at: DateTime"],
    }),
    classBox({
      name: "DocumentReview",
      x: 500,
      y: 585,
      attrs: ["+ document_id: int", "+ status: String", "+ comment: Text", "+ reviewed_by: int", "+ reviewed_at: DateTime"],
    }),
    classBox({
      name: "DemandeStageStatusHistory",
      x: 500,
      y: 800,
      attrs: ["+ demande_id: int", "+ previous_status: String", "+ new_status: String", "+ reason: Text", "+ changed_by: int"],
    }),

    classBox({
      name: "Projet",
      x: 930,
      y: 95,
      attrs: ["+ code_projet: String", "+ intitule: String", "+ departement: DepartementEnum", "+ type_stage: TypeStageEnum", "+ objectifs, livrables: Text", "+ competences, tags: JSON", "+ status: ProjetStatusEnum"],
    }),
    classBox({
      name: "PropositionProjet",
      x: 930,
      y: 370,
      attrs: ["+ demande_id: int", "+ projet_id: int", "+ token: String", "+ date_expiration: DateTime", "+ statut: StatutPropositionEnum"],
    }),
    classBox({
      name: "ChoixProjet",
      x: 930,
      y: 585,
      attrs: ["+ demande_id: int", "+ projet_id: int", "+ date_choix: DateTime", "+ created_at: DateTime"],
    }),
    classBox({
      name: "Affectation",
      x: 930,
      y: 780,
      attrs: ["+ demande_id: int", "+ projet_id: int", "+ encadreur_id: int", "+ stagiaire_id: int?", "+ statut: StatutAffectationEnum", "+ dates prevues: DateTime"],
    }),

    classBox({
      name: "Stage",
      x: 1360,
      y: 115,
      attrs: ["+ demandestage_id: int", "+ stagiaire_id: int", "+ encadreur_id: int", "+ projet_id: int", "+ date_debut, date_fin: Date", "+ statut_stage: StatutStageEnum", "+ texte_objectif: String"],
    }),
    classBox({
      name: "Task",
      x: 1360,
      y: 390,
      attrs: ["+ stage_id: int", "+ projet_id: int", "+ created_by: int", "+ title: String", "+ status: taskStatusEnum", "+ priority: taskPriorityEnum", "+ deadline: DateTime"],
    }),
    classBox({
      name: "Task_submission",
      x: 1360,
      y: 665,
      attrs: ["+ task_id: int", "+ stagiaire_id: int", "+ content: Text", "+ file_url: String", "+ submitted_at: DateTime"],
    }),
    classBox({
      name: "Evaluation",
      x: 1360,
      y: 880,
      attrs: ["+ stagiaire_id: int", "+ projet_id: int", "+ encadreur_id: int", "+ note: int (0..20)", "+ commentaire: Text"],
    }),

    classBox({
      name: "PlanningEvent",
      x: 1790,
      y: 145,
      attrs: ["+ encadreur_id: int", "+ stagiaire_id: int?", "+ title: String", "+ event_type: planningEventTypeEnum", "+ priority: taskPriorityEnum", "+ start_at, end_at: DateTime"],
    }),
    classBox({
      name: "Attestation",
      x: 1790,
      y: 410,
      attrs: ["+ stagiaire_id: int", "+ stage_id: int", "+ created_by: int", "+ numero_attestation: String", "+ file_path: String", "+ dates stage: DateTime"],
    }),
    classBox({
      name: "MessageInterne",
      x: 1790,
      y: 675,
      attrs: ["+ id_expediteur: int", "+ id_destinataire: int", "+ sujet: String", "+ contenu: String", "+ lu: Boolean"],
    }),
    classBox({
      name: "Notification",
      x: 1790,
      y: 890,
      attrs: ["+ user_id: int", "+ title: String", "+ message: Text", "+ category: String", "+ payload: Text", "+ read_at: DateTime"],
    }),
    classBox({
      name: "Statistiques",
      x: 1790,
      y: 1130,
      attrs: ["+ periode: String", "+ nombreDemandes: int", "+ nbrStagesvalides: int", "+ nbrStagesencours: int", "+ taxeReussite: float"],
    }),
  ];

  for (const item of items) boxes[item.name] = item;

  const packages = [
    packageBox("Utilisateurs", 40, 70, 380, 940, "#f8fafc"),
    packageBox("Candidatures et documents", 470, 70, 380, 940, "#f7fee7"),
    packageBox("Propositions et affectations", 900, 70, 380, 940, "#eff6ff"),
    packageBox("Suivi stage", 1330, 70, 380, 990, "#fff7ed"),
    packageBox("Communication, planning, reporting", 1760, 70, 380, 1250, "#fdf2f8"),
  ].join("\n");

  const relations = [
    verticalRelation("Utilisateur", "Encadreur", boxes, "heritage", "inherit"),
    verticalRelation("Utilisateur", "Stagiaire", boxes, "heritage", "inherit"),
    verticalRelation("Utilisateur", "ResetMotDePasse", boxes, "1 -> 0..*", "rel"),
    relation("Utilisateur", "Document", boxes, "possede"),
    relation("Utilisateur", "MessageInterne", boxes, "envoie/recoit"),
    relation("Utilisateur", "Notification", boxes, "recoit"),
    relation("Utilisateur", "Attestation", boxes, "cree"),

    relation("Encadreur", "DemandeStage", boxes, "traite"),
    relation("Encadreur", "Projet", boxes, "propose"),
    relation("Encadreur", "Stage", boxes, "supervise"),
    relation("Encadreur", "Task", boxes, "cree"),
    relation("Stagiaire", "Stage", boxes, "realise"),
    relation("Stagiaire", "Task_submission", boxes, "soumet"),
    relation("Stagiaire", "Evaluation", boxes, "est evalue"),

    relation("DemandeStage", "Document", boxes, "1 -> 0..*"),
    relation("Document", "DocumentReview", boxes, "1 -> 0..*"),
    verticalRelation("DemandeStage", "DemandeStageStatusHistory", boxes, "historique"),
    relation("DemandeStage", "PropositionProjet", boxes, "genere"),
    relation("DemandeStage", "ChoixProjet", boxes, "choix"),
    relation("DemandeStage", "Affectation", boxes, "affecte"),
    relation("DemandeStage", "Stage", boxes, "devient"),

    relation("Projet", "PropositionProjet", boxes, "propose"),
    relation("PropositionProjet", "ChoixProjet", boxes, "token choisi"),
    relation("ChoixProjet", "Affectation", boxes, "declenche"),
    relation("Affectation", "Stage", boxes, "cree stage"),
    relation("Projet", "Task", boxes, "contient"),
    relation("Projet", "Evaluation", boxes, "evalue"),

    verticalRelation("Stage", "Task", boxes, "1 -> 0..*"),
    verticalRelation("Task", "Task_submission", boxes, "1 -> 0..*"),
    relation("Stage", "Attestation", boxes, "genere"),
    relation("Encadreur", "PlanningEvent", boxes, "planifie"),
    relation("Stagiaire", "PlanningEvent", boxes, "participe"),
  ].join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="1380" viewBox="0 0 2200 1380">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#475569"/>
    </marker>
    <marker id="triangle" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
      <path d="M0,0 L10,6 L0,12 z" fill="#ffffff" stroke="#2563eb" stroke-width="1.8"/>
    </marker>
    <style>
      .bg { fill: #ffffff; }
      .title { font: 700 30px Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 400 15px Arial, sans-serif; fill: #475569; }
      .package-title { font: 700 18px Arial, sans-serif; fill: #334155; }
      .class-box { fill: #ffffff; stroke: #94a3b8; stroke-width: 1.5; filter: drop-shadow(0 2px 3px rgb(15 23 42 / 0.12)); }
      .class-head { fill: #0f766e; }
      .class-name { font: 700 16px Arial, sans-serif; fill: #ffffff; text-anchor: middle; }
      .attr { font: 13px Consolas, "Courier New", monospace; fill: #0f172a; }
      .rel { fill: none; stroke: #475569; stroke-width: 1.6; marker-end: url(#arrow); }
      .inherit { fill: none; stroke: #2563eb; stroke-width: 2; marker-end: url(#triangle); }
      .rel-label { font: 12px Arial, sans-serif; fill: #334155; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 4px; stroke-linejoin: round; }
    </style>
  </defs>
  <rect width="2200" height="1380" class="bg"/>
  <text x="40" y="40" class="title">Diagramme de classes detaille</text>
  <text x="40" y="62" class="subtitle">Plateforme de Gestion des Stages - entites SQLAlchemy principales et relations metier</text>
  ${packages}
  <g opacity="0.96">${relations}</g>
  ${items.map((item) => item.svg).join("\n")}
</svg>`;

  writeFileSync(join(outDir, "diagramme_classes_detaille.svg"), svg, "utf8");
}

function actor(x, y, label) {
  return `
    <g>
      <circle cx="${x}" cy="${y}" r="16" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
      <path d="M ${x} ${y + 16} V ${y + 68} M ${x - 30} ${y + 35} H ${x + 30} M ${x} ${y + 68} L ${x - 26} ${y + 110} M ${x} ${y + 68} L ${x + 26} ${y + 110}" stroke="#0f172a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <text x="${x}" y="${y + 142}" class="actor-label">${esc(label)}</text>
    </g>`;
}

function useCase(x, y, text, w = 260) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="48" rx="24" class="uc"/>
      <text x="${x + w / 2}" y="${y + 29}" class="uc-text">${esc(text)}</text>
    </g>`;
}

function group(title, x, y, w, h, fill) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="#cbd5e1" stroke-width="2"/>
      <text x="${x + 18}" y="${y + 30}" class="package-title">${esc(title)}</text>
    </g>`;
}

function link(x1, y1, x2, y2, label = "", dashed = false) {
  const mid = (x1 + x2) / 2;
  return `
    <path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" class="${dashed ? "uc-rel dashed" : "uc-rel"}"/>
    ${label ? `<text x="${mid}" y="${(y1 + y2) / 2 - 8}" class="rel-label">${esc(label)}</text>` : ""}`;
}

function buildUseCaseDiagram() {
  const publicCases = [
    ["Consulter accueil", 420, 145],
    ["Consulter options candidature", 420, 210],
    ["Soumettre candidature", 420, 275],
    ["Joindre CV et lettre", 710, 275],
    ["Ouvrir lien tokenise", 420, 340],
    ["Choisir projet propose", 710, 340],
  ];
  const authCases = [
    ["Se connecter", 420, 520],
    ["Consulter session", 710, 520],
    ["Renouveler token", 1000, 520],
    ["Se deconnecter", 420, 585],
    ["Reset mot de passe", 710, 585],
    ["Changer mot de passe", 1000, 585],
  ];
  const adminCases = [
    ["Dashboard global", 420, 765],
    ["Gerer utilisateurs", 710, 765],
    ["Gerer candidatures", 1000, 765],
    ["Changer statut demande", 1290, 765],
    ["Historique demande", 1580, 765],
    ["Gerer encadreurs", 420, 830],
    ["Gerer projets", 710, 830],
    ["Gerer fiche PDF projet", 1000, 830],
    ["Proposer top projets", 1290, 830],
    ["Gerer affectations", 1580, 830],
    ["Assigner encadreur", 420, 895],
    ["Gerer stages", 710, 895],
    ["Gerer stagiaires", 1000, 895],
    ["Valider documents", 1290, 895],
    ["Generer attestations", 1580, 895],
    ["Consulter statistiques", 710, 960],
  ];
  const encCases = [
    ["Overview encadreur", 420, 1150],
    ["Voir stagiaires encadres", 710, 1150],
    ["Voir stages encadres", 1000, 1150],
    ["Creer tache", 1290, 1150],
    ["Suivre taches", 1580, 1150],
    ["Reviser soumission", 420, 1215],
    ["Valider tache", 710, 1215],
    ["Gerer planning", 1000, 1215],
    ["Evaluer stagiaire", 1290, 1215],
    ["Messagerie", 1580, 1215],
  ];
  const stagCases = [
    ["Profil", 420, 1380],
    ["Consulter stage/projet", 710, 1380],
    ["Voir mes taches", 1000, 1380],
    ["Statut tache", 1290, 1380],
    ["Soumettre travail", 1580, 1380],
    ["Mes documents", 420, 1445],
    ["Deposer rapport final", 710, 1445],
    ["Planning", 1000, 1445],
    ["Evaluations", 1290, 1445],
    ["Attestations", 1580, 1445],
    ["Messagerie", 1000, 1510],
  ];
  const transCases = [
    ["Notifications", 420, 1650],
    ["Marquer comme lues", 710, 1650],
    ["Telecharger fichiers", 1000, 1650],
  ];

  const casesSvg = [
    ...publicCases,
    ...authCases,
    ...adminCases,
    ...encCases,
    ...stagCases,
    ...transCases,
  ]
    .map(([text, x, y]) => useCase(x, y, text))
    .join("\n");

  const links = [
    link(170, 250, 420, 170),
    link(170, 250, 420, 300),
    link(170, 250, 420, 365),
    link(680, 299, 710, 299, "<<include>>", true),
    link(680, 364, 710, 364, "<<extend>>", true),

    link(170, 815, 420, 545),
    link(170, 815, 420, 790),
    link(170, 815, 420, 855),
    link(170, 815, 420, 920),
    link(170, 815, 710, 985),

    link(170, 1175, 420, 1175),
    link(170, 1175, 710, 1175),
    link(170, 1175, 1290, 1175),
    link(170, 1175, 1000, 1240),
    link(170, 1175, 1580, 1240),

    link(170, 1405, 420, 1405),
    link(170, 1405, 710, 1405),
    link(170, 1405, 1000, 1405),
    link(170, 1405, 420, 1470),
    link(170, 1405, 1580, 1470),

    link(420 + 260, 1674, 710, 1674, "<<include>>", true),
    link(1970, 250, 1730, 855),
    link(1970, 250, 1730, 790),
    link(1970, 250, 1730, 610),
    link(1970, 1200, 1730, 1175),
    link(1970, 1200, 1730, 1240),
    link(1970, 1200, 1730, 364),
    link(1970, 1200, 680, 1674),
  ].join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="1770" viewBox="0 0 2200 1770">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#475569"/>
    </marker>
    <style>
      .bg { fill: #ffffff; }
      .title { font: 700 30px Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 400 15px Arial, sans-serif; fill: #475569; }
      .package-title { font: 700 18px Arial, sans-serif; fill: #334155; }
      .uc { fill: #ffffff; stroke: #0f766e; stroke-width: 1.8; filter: drop-shadow(0 2px 3px rgb(15 23 42 / 0.10)); }
      .uc-text { font: 14px Arial, sans-serif; fill: #0f172a; text-anchor: middle; dominant-baseline: middle; }
      .actor-label { font: 700 15px Arial, sans-serif; fill: #0f172a; text-anchor: middle; }
      .uc-rel { fill: none; stroke: #475569; stroke-width: 1.55; marker-end: url(#arrow); opacity: 0.8; }
      .dashed { stroke-dasharray: 7 5; }
      .rel-label { font: 12px Arial, sans-serif; fill: #334155; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 4px; stroke-linejoin: round; }
    </style>
  </defs>
  <rect width="2200" height="1770" class="bg"/>
  <text x="40" y="40" class="title">Diagramme de cas d'utilisation detaille</text>
  <text x="40" y="62" class="subtitle">Plateforme de Gestion des Stages - acteurs, espaces fonctionnels et services transverses</text>

  ${actor(130, 170, "Candidat externe")}
  ${actor(130, 735, "Administrateur")}
  ${actor(130, 1095, "Encadreur")}
  ${actor(130, 1325, "Stagiaire")}
  ${actor(1970, 170, "Service email")}
  ${actor(1970, 1120, "Notifications internes")}

  ${group("Espace public", 380, 105, 610, 305, "#f7fee7")}
  ${group("Authentification", 380, 480, 910, 170, "#eff6ff")}
  ${group("Back-office administrateur", 380, 725, 1480, 300, "#fff7ed")}
  ${group("Espace encadreur", 380, 1110, 1480, 170, "#fdf2f8")}
  ${group("Espace stagiaire", 380, 1340, 1480, 230, "#f8fafc")}
  ${group("Transverse", 380, 1610, 910, 100, "#eef2ff")}

  <g opacity="0.95">${links}</g>
  ${casesSvg}
</svg>`;

  writeFileSync(join(outDir, "diagramme_cas_utilisation_detaille.svg"), svg, "utf8");
}

function buildIndex() {
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diagrammes UML visuels - Plateforme de Gestion des Stages</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    header { padding: 28px 36px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
    h1 { margin: 0 0 6px; font-size: 26px; }
    p { margin: 0; color: #475569; }
    main { padding: 28px 36px 48px; display: grid; gap: 28px; }
    section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    h2 { margin: 0; padding: 16px 20px; font-size: 18px; border-bottom: 1px solid #e2e8f0; }
    .frame { overflow: auto; padding: 16px; }
    img { display: block; max-width: none; width: 1800px; height: auto; }
    a { color: #0f766e; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>Diagrammes UML visuels</h1>
    <p>Ouvrez ce fichier dans le navigateur pour consulter les deux diagrammes organises.</p>
  </header>
  <main>
    <section>
      <h2>Diagramme de classes - <a href="./diagramme_classes_detaille.svg">ouvrir SVG</a></h2>
      <div class="frame"><img src="./diagramme_classes_detaille.svg" alt="Diagramme de classes detaille"></div>
    </section>
    <section>
      <h2>Diagramme de cas d'utilisation - <a href="./diagramme_cas_utilisation_detaille.svg">ouvrir SVG</a></h2>
      <div class="frame"><img src="./diagramme_cas_utilisation_detaille.svg" alt="Diagramme de cas d'utilisation detaille"></div>
    </section>
  </main>
</body>
</html>`;
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

buildClassDiagram();
buildUseCaseDiagram();
buildIndex();
