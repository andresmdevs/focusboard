// Generador de CV en PDF adaptado a una oferta del radar.
// Corre 100% en el navegador (pdfmake). Reordena y destaca skills/experiencia
// reales según las keywords de la oferta; nunca agrega contenido inventado.
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { profile } from "../data/cvProfile.js";

if (typeof pdfMake.addVirtualFileSystem === "function") {
  pdfMake.addVirtualFileSystem(pdfFonts);
} else {
  pdfMake.vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
}

const ACCENT = "#1d6e5b";
const MUTED = "#5c665f";

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Texto de la oferta contra el que se hace matching. */
function jobHaystack(job) {
  return norm([job.title, (job.skills || []).join(" ")].join(" "));
}

function matchCount(tags, haystack) {
  return tags.reduce((acc, tag) => acc + (haystack.includes(norm(tag)) ? 1 : 0), 0);
}

/** Elige la pista (QA vs Dev) según las señales del título de la oferta. */
function pickTrack(haystack) {
  const qa = ["qa", "test", "sdet", "quality", "automation", "playwright", "automatiza"];
  const dev = ["developer", "desarrollador", "full stack", "fullstack", "frontend", "backend", "angular", "react", "node", "mobile", "movil", "software engineer", "ingeniero de software"];
  const qaScore = matchCount(qa, haystack);
  const devScore = matchCount(dev, haystack);
  return devScore > qaScore ? "dev" : "qa";
}

/** Skills ordenadas por relevancia para la oferta (las que matchean, primero). */
function rankSkills(haystack) {
  return profile.skills
    .map((s) => ({ ...s, hits: matchCount(s.tags, haystack) }))
    .sort((a, b) => b.hits * 10 + b.weight - (a.hits * 10 + a.weight));
}

/** Bullets de cada rol ordenados por relevancia (estable si empatan). */
function rankBullets(bullets, haystack) {
  return bullets
    .map((b, i) => ({ ...b, hits: matchCount(b.tags, haystack), i }))
    .sort((a, b) => b.hits - a.hits || a.i - b.i);
}

const slug = (s) =>
  norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "oferta";

export function buildDocDefinition(job) {
  const haystack = jobHaystack(job);
  const track = profile.tracks[pickTrack(haystack)];
  const skills = rankSkills(haystack);
  const topMatched = skills.filter((s) => s.hits > 0).slice(0, 3).map((s) => s.name);
  const summarySkills = (topMatched.length ? topMatched : skills.slice(0, 3).map((s) => s.name)).join(", ");

  const experience = profile.experience.flatMap((exp) => [
    {
      columns: [
        { text: [{ text: exp.role, bold: true }, { text: `  ·  ${exp.company}`, color: MUTED }], width: "*" },
        { text: exp.period, color: MUTED, fontSize: 8.5, alignment: "right", width: "auto" },
      ],
      margin: [0, 7, 0, 2],
    },
    {
      ul: rankBullets(exp.bullets, haystack).map((b) => ({ text: b.text, margin: [0, 0, 0, 1] })),
      fontSize: 9.2,
      color: "#26302a",
    },
  ]);

  return {
    pageSize: "A4",
    pageMargins: [42, 40, 42, 36],
    defaultStyle: { fontSize: 9.6, lineHeight: 1.22, color: "#17221e" },
    info: { title: `CV Andrés Mora — ${job.title}`, author: profile.name },
    footer: {
      text: `CV generado para la vacante "${job.title}" — ${job.company}`,
      alignment: "center", fontSize: 7.5, color: MUTED,
    },
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: profile.name, fontSize: 22, bold: true },
              { text: track.headline, fontSize: 11, color: ACCENT, bold: true, margin: [0, 2, 0, 0] },
              { text: profile.location, fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: "auto",
            stack: [profile.email, profile.phone, profile.github],
            fontSize: 8.5, color: MUTED, alignment: "right", lineHeight: 1.35,
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 6, x2: 511, y2: 6, lineWidth: 1.2, lineColor: ACCENT }], margin: [0, 2, 0, 8] },
      { text: track.summary.replace("{skills}", summarySkills), fontSize: 9.4, color: "#26302a", margin: [0, 0, 0, 10] },
      {
        columns: [
          {
            width: "64%",
            stack: [
              { text: "EXPERIENCIA", style: "section" },
              ...experience,
              { text: "EDUCACIÓN", style: "section", margin: [0, 14, 0, 0] },
              ...profile.education.map((ed) => ({
                columns: [
                  { text: [{ text: ed.title, bold: true }, { text: `  ·  ${ed.school}`, color: MUTED }], width: "*", fontSize: 9.2 },
                  { text: ed.period, color: MUTED, fontSize: 8.5, alignment: "right", width: "auto" },
                ],
                margin: [0, 5, 0, 0],
              })),
            ],
          },
          {
            width: "36%",
            margin: [16, 0, 0, 0],
            stack: [
              { text: "SKILLS DESTACADAS", style: "section" },
              {
                ul: skills.slice(0, 10).map((s) => ({
                  text: s.hits > 0 ? { text: s.name, bold: true } : { text: s.name },
                  margin: [0, 1.5, 0, 0],
                })),
                fontSize: 9.2, margin: [0, 4, 0, 0],
              },
              { text: "IDIOMAS", style: "section", margin: [0, 14, 0, 6] },
              ...profile.languages.map((l) => ({
                text: [{ text: l.name, bold: true }, { text: ` — ${l.level}`, color: MUTED }],
                fontSize: 9.2, margin: [0, 1.5, 0, 0],
              })),
              { text: "VACANTE OBJETIVO", style: "section", margin: [0, 14, 0, 6] },
              { text: job.title, fontSize: 9, bold: true },
              { text: job.company, fontSize: 8.5, color: MUTED },
            ],
          },
        ],
      },
    ],
    styles: {
      section: { fontSize: 9, bold: true, color: ACCENT, characterSpacing: 1, margin: [0, 0, 0, 2] },
    },
  };
}

export function generateCv(job) {
  const dd = buildDocDefinition(job);
  const filename = `CV_AndresMora_${slug(job.company)}.pdf`;
  pdfMake.createPdf(dd).download(filename);
  return filename;
}

/** Devuelve el PDF como Blob (para previews o verificación).
 * pdfmake 0.3 retorna una Promise; 0.2 usaba callback — se soportan ambas. */
export function getCvBlob(job) {
  const pdf = pdfMake.createPdf(buildDocDefinition(job));
  const result = pdf.getBlob();
  if (result && typeof result.then === "function") return result;
  return new Promise((resolve) => pdf.getBlob(resolve));
}
