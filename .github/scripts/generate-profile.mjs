import fs from "node:fs";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_REPOSITORY_OWNER || "Dagi-D-Flash";

if (!token) throw new Error("GITHUB_TOKEN is required.");

const query = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(privacy: PUBLIC, first: 1) { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed: ${response.status}`);
}

const payload = await response.json();
if (payload.errors?.length) {
  throw new Error(payload.errors.map(error => error.message).join("; "));
}

const user = payload.data?.user;
if (!user) throw new Error(`GitHub user not found: ${username}`);

const calendar = user.contributionsCollection.contributionCalendar;
const contributions = calendar.totalContributions;
const publicRepos = user.repositories.totalCount;
const followers = user.followers.totalCount;
const weeks = calendar.weeks.slice(-53);
const weekly = weeks.map(week =>
  week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0)
);

// IMPORTANT: Do not write to "dist". The snake action may create that
// directory with different ownership/permissions.
const outputDirectory = "profile-dist";
fs.mkdirSync(outputDirectory, { recursive: true });

const stats = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="190" viewBox="0 0 960 190">
<title>${username} GitHub profile statistics</title>
<defs><linearGradient id="g"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
<rect x="1" y="1" width="958" height="188" rx="18" fill="#0b1220" stroke="#263449"/>
<text x="34" y="43" fill="#e2e8f0" font-family="Arial,sans-serif" font-size="20" font-weight="700">GITHUB / OVERVIEW</text>
<text x="925" y="42" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">LIVE PROFILE DATA</text>
<rect x="34" y="58" width="892" height="2" rx="1" fill="url(#g)"/>
<g font-family="Arial,sans-serif">
<text x="48" y="112" fill="#94a3b8" font-size="13">CONTRIBUTIONS · LAST 12 MONTHS</text>
<text x="48" y="157" fill="#f8fafc" font-size="34" font-weight="700">${contributions.toLocaleString("en-US")}</text>
<text x="365" y="112" fill="#94a3b8" font-size="13">PUBLIC REPOSITORIES</text>
<text x="365" y="157" fill="#f8fafc" font-size="34" font-weight="700">${publicRepos.toLocaleString("en-US")}</text>
<text x="680" y="112" fill="#94a3b8" font-size="13">FOLLOWERS</text>
<text x="680" y="157" fill="#f8fafc" font-size="34" font-weight="700">${followers.toLocaleString("en-US")}</text>
</g></svg>`;

const max = Math.max(1, ...weekly);
const left = 48, top = 65, chartWidth = 864, chartHeight = 170;
const points = weekly.map((value, index) => {
  const x = left + (index / Math.max(1, weekly.length - 1)) * chartWidth;
  const y = top + chartHeight - (value / max) * chartHeight;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");
const area = `${left},${top + chartHeight} ${points} ${left + chartWidth},${top + chartHeight}`;

const activity = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="310" viewBox="0 0 960 310">
<title>${username} contribution activity</title>
<defs>
<linearGradient id="line"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8b5cf6" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
</defs>
<rect x="1" y="1" width="958" height="308" rx="18" fill="#0b1220" stroke="#263449"/>
<text x="34" y="39" fill="#e2e8f0" font-family="Arial,sans-serif" font-size="20" font-weight="700">CONTRIBUTION RHYTHM</text>
<text x="925" y="39" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">WEEKLY · LAST 12 MONTHS</text>
<g stroke="#263449">
<line x1="48" y1="65" x2="912" y2="65"/>
<line x1="48" y1="150" x2="912" y2="150"/>
<line x1="48" y1="235" x2="912" y2="235"/>
</g>
<polygon points="${area}" fill="url(#fill)"/>
<polyline points="${points}" fill="none" stroke="url(#line)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<text x="48" y="277" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">12 MONTHS AGO</text>
<text x="912" y="277" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">RECENT</text>
<text x="48" y="294" fill="#64748b" font-family="Arial,sans-serif" font-size="10">GitHub contribution calendar · ${contributions.toLocaleString("en-US")} contributions</text>
</svg>`;

fs.writeFileSync(path.join(outputDirectory, "profile-stats.svg"), stats);
fs.writeFileSync(path.join(outputDirectory, "contribution-activity.svg"), activity);
console.log(`Generated profile visuals for ${username}.`);
