#!/usr/bin/env node
// Validation d'un marketplace Claude — sans dependance, sans le CLI claude.
//
//   node scripts/valider.mjs            structure, manifestes, skills locales
//   node scripts/valider.mjs --remote   verifie en plus que chaque depot source repond
//
// Sortie : code 0 si tout est bon, 1 sinon. Meme fichier dans les deux marketplaces
// Xileades ; toute correction se reporte dans l'autre.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DISTANT = process.argv.includes("--remote");
const erreurs = [];
const alertes = [];
const err = (m) => erreurs.push(m);
const avert = (m) => alertes.push(m);

function lireTexte(chemin) {
  const brut = readFileSync(chemin);
  const bom = brut.length >= 3 && brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf;
  return { texte: brut.toString("utf8").replace(/^﻿/, ""), bom };
}

function lireJson(chemin) {
  try {
    const { texte, bom } = lireTexte(chemin);
    if (bom) avert(`${chemin} : commence par un BOM UTF-8 — JSON.parse le refuse dans la plupart des runtimes.`);
    return JSON.parse(texte);
  } catch (e) {
    err(`${chemin} : JSON illisible — ${e.message}`);
    return null;
  }
}

// --- 1. Le manifeste du marketplace -----------------------------------------
const cheminMarket = join(RACINE, ".claude-plugin", "marketplace.json");
if (!existsSync(cheminMarket)) {
  err(".claude-plugin/marketplace.json est absent.");
  rendreCompte(null);
}
const market = lireJson(cheminMarket);
if (!market) rendreCompte(null);

for (const champ of ["name", "owner", "plugins"]) {
  if (market[champ] === undefined) err(`marketplace.json : champ obligatoire « ${champ} » absent.`);
}
if (market.owner && !market.owner.name) err("marketplace.json : owner.name est obligatoire.");
if (market.name && !/^[a-z0-9][a-z0-9-]*$/.test(market.name))
  err(`marketplace.json : « ${market.name} » n'est pas en kebab-case.`);
if (!Array.isArray(market.plugins)) err("marketplace.json : « plugins » doit être un tableau.");
// Piege : description et version sont des champs de premier niveau. Rangees sous
// metadata, elles ne sont simplement jamais lues, sans le moindre message.
if (market.metadata && (market.metadata.description || market.metadata.version))
  err("marketplace.json : « description » et « version » se placent au premier niveau, pas sous « metadata » — sous metadata elles sont ignorées en silence.");
if (!market.description) avert("marketplace.json : pas de description au premier niveau.");

// --- 2. Chaque entree de plugin ---------------------------------------------
const vus = new Set();
for (const entree of market.plugins ?? []) {
  const nom = entree.name ?? "(sans nom)";
  for (const champ of ["name", "source", "description"]) {
    if (!entree[champ]) err(`plugin « ${nom} » : champ obligatoire « ${champ} » absent.`);
  }
  if (entree.name) {
    if (vus.has(entree.name)) err(`plugin « ${nom} » : nom en double dans le marketplace.`);
    vus.add(entree.name);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entree.name)) err(`plugin « ${nom} » : le nom n'est pas en kebab-case.`);
  }

  const src = entree.source;

  // --- Source distante : on ne peut verifier que l'adresse. -------------------
  if (src && typeof src === "object") {
    const adresse =
      src.source === "github" ? (src.repo ? `https://github.com/${src.repo}.git` : null)
      : src.source === "url" || src.source === "git-subdir" ? src.url
      : null;
    if (!adresse) {
      avert(`plugin « ${nom} » : source de type « ${src.source} » non vérifiable ici.`);
    } else if (entree.version) {
      // Le plugin.json du depot fait autorite en mode strict ; figer une version
      // ici, c'est se condamner a la desynchroniser au prochain bump.
      avert(`plugin « ${nom} » : version figée dans le marketplace alors que la source est distante — le plugin.json du dépôt fait autorité.`);
    }
    if (adresse && DISTANT) {
      try {
        execFileSync("git", ["ls-remote", adresse, "HEAD"], { stdio: "pipe", timeout: 30000 });
      } catch {
        err(`plugin « ${nom} » : ${adresse} ne répond pas (dépôt absent, privé, ou identifiants manquants).`);
      }
    }
    continue;
  }

  // --- Source locale : on verifie tout sur disque. ----------------------------
  if (typeof src !== "string" || !src.startsWith(".")) {
    err(`plugin « ${nom} » : source de forme inattendue.`);
    continue;
  }
  if (!entree.version) avert(`plugin « ${nom} » : pas de version — les postes suivront le SHA du commit.`);
  const dossier = join(RACINE, src);
  if (!existsSync(dossier)) {
    err(`plugin « ${nom} » : le dossier ${src} n'existe pas.`);
    continue;
  }

  const cheminPlugin = join(dossier, ".claude-plugin", "plugin.json");
  if (!existsSync(cheminPlugin)) {
    if (entree.strict !== false) err(`plugin « ${nom} » : strict est actif mais .claude-plugin/plugin.json est absent.`);
  } else {
    const pj = lireJson(cheminPlugin);
    if (pj) {
      if (!pj.name) err(`plugin « ${nom} » : plugin.json sans champ « name ».`);
      else if (pj.name !== entree.name)
        err(`plugin « ${nom} » : plugin.json annonce « ${pj.name} », le marketplace « ${entree.name} ».`);
      if (pj.version && entree.version && pj.version !== entree.version)
        err(`plugin « ${nom} » : version ${pj.version} dans plugin.json, ${entree.version} dans le marketplace.`);
    }
  }

  const dossierSkills = join(dossier, "skills");
  if (!existsSync(dossierSkills)) {
    avert(`plugin « ${nom} » : pas de dossier skills/.`);
    continue;
  }
  const skills = readdirSync(dossierSkills).filter((d) => statSync(join(dossierSkills, d)).isDirectory());
  if (skills.length === 0) err(`plugin « ${nom} » : skills/ est vide.`);
  for (const s of skills) verifierSkill(join(dossierSkills, s), s, nom);
}

function verifierSkill(dossier, s, plugin) {
  const chemin = join(dossier, "SKILL.md");
  if (!existsSync(chemin)) {
    err(`plugin « ${plugin} » : la skill « ${s} » n'a pas de SKILL.md.`);
    return;
  }
  const { texte, bom } = lireTexte(chemin);
  // Un BOM avant le --- d'ouverture : certains lecteurs de frontmatter ne voient
  // plus le delimiteur et chargent la skill sans nom ni description.
  if (bom) err(`skill « ${s} » : SKILL.md commence par un BOM UTF-8, avant le « --- » du frontmatter.`);
  if (!texte.startsWith("---")) {
    err(`skill « ${s} » : pas de frontmatter YAML en tête de SKILL.md.`);
    return;
  }
  const fin = texte.indexOf("\n---", 3);
  const fm = fin === -1 ? "" : texte.slice(3, fin);
  const mNom = fm.match(/^name:\s*["']?([^"'\n]+?)["']?\s*$/m);
  if (!mNom) err(`skill « ${s} » : le frontmatter n'a pas de champ « name ».`);
  else if (mNom[1].trim() !== s)
    err(`skill « ${s} » : le frontmatter annonce « ${mNom[1].trim()} », le dossier s'appelle « ${s} ».`);
  const desc = fm.match(/^description:\s*(>-|\|-?)?\s*([\s\S]*?)(?=^\w+:|$)/m);
  if (!desc || !desc[2].trim()) err(`skill « ${s} » : le frontmatter n'a pas de champ « description ».`);
  else if (desc[2].replace(/\s+/g, " ").trim().length < 40)
    avert(`skill « ${s} » : description très courte — c'est elle qui décide du déclenchement.`);
}

rendreCompte(market);

function rendreCompte(m) {
  const n = (m?.plugins ?? []).length;
  if (alertes.length) {
    console.log("Avertissements :");
    for (const a of alertes) console.log("  ~ " + a);
  }
  if (erreurs.length) {
    console.error("\nErreurs :");
    for (const e of erreurs) console.error("  ✗ " + e);
    console.error(`\n${erreurs.length} erreur(s). Validation en échec.`);
    process.exit(1);
  }
  console.log(`\n✓ Marketplace « ${m?.name} » valide — ${n} plugin(s), aucune erreur.${DISTANT ? " Sources distantes joignables." : ""}`);
  process.exit(0);
}
