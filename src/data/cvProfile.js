// Perfil profesional de Andrés Mora para el generador de CV del radar.
// OJO: este archivo se sirve en el bundle público de la página /empleo —
// cualquier visitante puede generar el PDF. No agregar datos que no irían
// en un CV que entregas a un empleador (cédula, dirección exacta, etc.).
// Los `tags` alimentan el matching contra la oferta: solo skills/experiencia
// REALES; el generador reordena y destaca, nunca inventa.

export const profile = {
  name: "Andrés Mora",
  location: "Medellín, Colombia · 100% remoto",
  email: "andreshcp@gmail.com",
  phone: "+57 300 842 7074",
  github: "github.com/andresmdevs",
  languages: [
    { name: "Español", level: "Nativo" },
    { name: "Inglés", level: "B2 escrito / lectura técnica" },
  ],

  // Tres "pistas" de perfil: el generador elige según las keywords de la oferta.
  tracks: {
    sre: {
      headline: "Ingeniero SRE · Monitoreo y Observabilidad",
      summary:
        "Ingeniero SRE / administrador de monitoreo y observabilidad en entornos MSP ({skills}). Opero OpManager MSP, VSA X, IT Glue y ConnectWise PSA, gestiono servicios en Azure y ejecuto despliegues CI/CD velando por el ciclo de vida del software. Base como desarrollador y en automatización de pruebas. Trabajo 100% remoto.",
    },
    qa: {
      headline: "QA Automation Engineer · Playwright & Python",
      summary:
        "Ingeniero QA con experiencia diseñando y manteniendo pruebas E2E automatizadas y automatización de procesos ({skills}). Base previa como desarrollador full stack que me permite leer el código bajo prueba, integrarme con CI/CD y automatizar de punta a punta. Trabajo 100% remoto.",
    },
    dev: {
      headline: "Full Stack Developer · Angular / Ionic / Node.js",
      summary:
        "Desarrollador full stack con experiencia construyendo aplicaciones web y móviles ({skills}). Integro servicios REST, bases de datos SQL/NoSQL y automatización de pruebas con Playwright, con enfoque en soluciones que resuelven necesidades reales del cliente. Trabajo 100% remoto.",
    },
  },

  skills: [
    { name: "Playwright (E2E)", tags: ["playwright", "qa", "test", "automation", "e2e", "sdet", "automatiza"], weight: 10 },
    { name: "Python (automatización y datos)", tags: ["python", "scripting", "data", "automation"], weight: 9 },
    { name: "Monitoreo y Observabilidad (OpManager MSP, VSA X)", tags: ["monitoring", "observability", "observabilidad", "monitoreo", "opmanager", "vsa", "vsax", "rmm", "sre", "site reliability", "reliability", "alerting", "uptime", "noc", "msp"], weight: 9 },
    { name: "Azure · servicios cloud", tags: ["azure", "cloud", "portal", "iaas", "paas", "sre", "devops"], weight: 7 },
    { name: "ConnectWise PSA · IT Glue (MSP)", tags: ["connectwise", "psa", "itglue", "it glue", "msp", "documentation", "ticketing", "itsm"], weight: 6 },
    { name: "QA manual · casos y reportes de prueba", tags: ["qa", "manual", "testing", "test", "reporte", "user stories", "analista", "quality"], weight: 8 },
    { name: "Google Apps Script (ETL)", tags: ["apps script", "google", "etl", "data"], weight: 7 },
    { name: "Angular", tags: ["angular", "frontend", "spa", "typescript"], weight: 8 },
    { name: "Ionic (apps híbridas)", tags: ["ionic", "mobile", "movil", "hibrida"], weight: 7 },
    { name: "Node.js · APIs REST", tags: ["node", "nodejs", "api", "rest", "backend", "express"], weight: 8 },
    { name: "TypeScript / JavaScript", tags: ["typescript", "javascript", "js", "ts"], weight: 8 },
    { name: "SQL Server · MongoDB · Firebase", tags: ["sql", "sql server", "mongodb", "firebase", "database", "nosql", "postgres"], weight: 6 },
    { name: "Java (Android nativo)", tags: ["java", "android", "mobile", "movil"], weight: 6 },
    { name: "Git · CI/CD · Azure DevOps", tags: ["git", "ci", "cd", "ci-cd", "ci/cd", "azure", "devops", "pipeline", "github", "deployment", "despliegue", "sre", "reliability"], weight: 7 },
    { name: "Scrum / metodologías ágiles", tags: ["scrum", "agile", "ágil", "agil", "kanban", "jira"], weight: 5 },
  ],

  experience: [
    {
      role: "Consultor de TI (SRE / Observabilidad)",
      company: "Intwo",
      period: "Oct 2025 – Actualidad",
      bullets: [
        { text: "Administro el monitoreo y la observabilidad de plataformas MSP con OpManager MSP y VSA X, con visibilidad de disponibilidad y alertas.", tags: ["monitoring", "observability", "observabilidad", "monitoreo", "opmanager", "vsa", "rmm", "sre", "alerting", "msp", "reliability"] },
        { text: "Opero la documentación y gestión de clientes con IT Glue y ConnectWise PSA.", tags: ["itglue", "connectwise", "psa", "documentation", "msp", "ticketing"] },
        { text: "Opero servicios en el portal de Azure y ejecuto despliegues mediante CI/CD, velando por el cumplimiento del ciclo de vida del software en el área de monitoreo.", tags: ["azure", "cloud", "ci", "cd", "ci-cd", "devops", "deployment", "sdlc", "sre"] },
        { text: "Automatizo procesos internos con Python y Playwright para reducir tareas repetitivas.", tags: ["python", "playwright", "automation", "scripting"] },
      ],
    },
    {
      role: "QA Testing Analyst",
      company: "Sistema Sentry",
      period: "May 2025 – Sep 2025",
      bullets: [
        { text: "Redacté historias de usuario y reportes de pruebas manuales para el equipo de producto.", tags: ["qa", "manual", "user stories", "reporte", "testing"] },
        { text: "Automaticé procesos y casos de prueba creando scripts con Playwright.", tags: ["playwright", "automation", "qa", "e2e", "test"] },
        { text: "Ejecuté extracción de datos con Python y Google Apps Script.", tags: ["python", "data", "apps script", "etl"] },
      ],
    },
    {
      role: "Junior Mobile/Backend Developer",
      company: "Moov",
      period: "May 2022 – Sep 2022",
      bullets: [
        { text: "Integré backend y frontend móvil para movilidad y transporte: pagos QR, geolocalización y búsqueda con autocompletado.", tags: ["mobile", "android", "java", "backend", "api", "geolocation"] },
        { text: "Desarrollé en Java para Android con pruebas unitarias por módulo.", tags: ["java", "android", "unit", "test", "testing"] },
        { text: "Gestioné el ciclo con CI/CD y seguimiento en Azure DevOps.", tags: ["ci", "cd", "azure", "devops", "pipeline"] },
      ],
    },
    {
      role: "Full Stack Developer",
      company: "Inversiones Agropradera",
      period: "Dic 2021 – Abr 2022",
      bullets: [
        { text: "Construí interfaces web/móviles con Angular e Ionic a partir de diseños UI/UX.", tags: ["angular", "ionic", "frontend", "ui", "typescript"] },
        { text: "Integré servicios REST con Node.js y SQL Server, y dashboards de datos con Chart.js.", tags: ["node", "api", "rest", "sql", "dashboard", "backend", "data"] },
      ],
    },
    {
      role: "Freelance Full Stack / Mobile Developer",
      company: "GetSoftware",
      period: "2020 – 2023 (intermitente)",
      bullets: [
        { text: "Plataforma educativa con Ionic, Angular y Firebase Realtime DB: agenda, calendario y seguimiento de progreso.", tags: ["ionic", "angular", "firebase", "mobile", "frontend"] },
        { text: "MathLabApp: app Android nativa de educación matemática para niños, en Java.", tags: ["android", "java", "mobile"] },
        { text: "E-commerce con Angular/Ionic, Node.js, SQL Server y AWS; mantenimiento WordPress.", tags: ["angular", "node", "sql", "aws", "ecommerce", "wordpress"] },
      ],
    },
  ],

  education: [
    { title: "Tecnólogo en Análisis y Desarrollo de Software", school: "SENA", period: "2016 – 2020" },
    { title: "Técnico Laboral, Asistente en Desarrollo de Software", school: "CESDE", period: "2018 – 2019" },
  ],
};
