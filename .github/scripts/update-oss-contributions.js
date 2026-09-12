const fs = require("fs");
const path = require("path");

const README_PATH = path.join(process.cwd(), "README.md");
const START_MARKER = "<!-- OSS_CONTRIBUTIONS:START -->";
const END_MARKER = "<!-- OSS_CONTRIBUTIONS:END -->";

// 每条记录都会自动从 GitHub API 拉取最新 star 数与 PR 合并状态。
// 想加新贡献：在数组末尾追加一条 { repo, pr, scope } 即可。
// 想让某条在顶部显示为徽章：加上 highlight: true。
const contributions = [
  {
    repo: "harry0703/MoneyPrinterTurbo",
    pr: 1246,
    scope: "Add Fish Audio to EN/JA TTS provider lists",
    highlight: true,
  },
  {
    repo: "CherryHQ/cherry-studio",
    pr: 20418,
    scope: "Fix dead heading anchors in the reference docs",
    highlight: true,
  },
  {
    repo: "zhayujie/CowAgent",
    pr: 3133,
    scope: "Ignore empty b64_json/url when saving generated images",
    highlight: true,
  },
  {
    repo: "volcengine/OpenViking",
    pr: 4213,
    scope: "Render fields without init_value as empty on init",
    highlight: true,
  },
  {
    repo: "agentscope-ai/QwenPaw",
    pr: 7269,
    scope: "Fix PluginAPI casing to PluginApi",
  },
  {
    repo: "HKUDS/Vibe-Trading",
    pr: 1178,
    scope: "Point official read-only MCP seed at /mcp-public endpoint",
  },
  {
    repo: "langchain-ai/openwiki",
    pr: 712,
    scope: "Correct the built cli entrypoint path in DEVELOPMENT.md",
  },
  {
    repo: "NanmiCoder/cc-haha",
    pr: 1313,
    scope: "List WeCom, QQ and Slack IM platforms",
  },
  {
    repo: "EKKOLearnAI/hermes-studio",
    pr: 2704,
    scope: "Document hermes-web-ui-mcp command in README tables",
  },
  {
    repo: "Q00/ouroboros",
    pr: 2227,
    scope: "Fix broken link to removed operational_task module",
  },
  {
    repo: "kirodotdev/KiroCrew",
    pr: 4472,
    scope: "Refuse unknown-slot approval-mode requests before any global mutation",
  },
  {
    repo: "rlaope/oh-my-hermes",
    pr: 1044,
    scope: "Refresh stale lintlang snapshot entry",
  },
  {
    repo: "TencentCloud/Octop",
    pr: 348,
    scope: "Force utf-8 stdio so octop init does not crash on GBK consoles",
  },
  {
    repo: "xuzhougeng/wisp-science",
    pr: 932,
    scope: "Support MCP Apps App→Server tool calls (serverTools / tools/call, #773)",
  },
  {
    repo: "Algorineko/AgenticArXiv-RL",
    pr: 12,
    scope: "Add English translation of README",
  },
];

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const GH_USER = process.env.GH_USER || "c020627";
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "c020627-profile-readme",
  "X-GitHub-Api-Version": "2022-11-28",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function githubJson(endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${endpoint} failed: ${response.status} ${body}`);
  }
  return response.json();
}

function formatStars(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

async function getPrStatus(repo, prNumber, pr) {
  if (pr.merged_at) {
    return "Merged";
  }
  if (pr.state !== "open") {
    return "Closed";
  }

  const reviews = await githubJson(`/repos/${repo}/pulls/${prNumber}/reviews`);
  const hasApproval = reviews.some((review) => review.state === "APPROVED");
  return hasApproval ? "Approved" : "In review";
}

// 该仓库里由本人合并的 PR 总数，用于显示 "(+N more)"。搜索接口失败时返回 null。
async function countMergedInRepo(repo) {
  try {
    const q = encodeURIComponent(
      `repo:${repo} type:pr is:merged author:${GH_USER}`,
    ).replace(/%20/g, "+");
    const result = await githubJson(`/search/issues?q=${q}&per_page=1`);
    return typeof result.total_count === "number" ? result.total_count : null;
  } catch (error) {
    console.warn(`countMergedInRepo(${repo}) skipped: ${error.message}`);
    return null;
  }
}

function badgeUrl(item) {
  const params = new URLSearchParams({
    label: item.status,
    message: `${item.repo} \u2b50 ${item.stars}`,
    color: item.status === "Merged" ? "2ea44f" : "6f42c1",
    style: "for-the-badge",
    logo: "github",
  });
  return `https://img.shields.io/static/v1?${params.toString()}`;
}

function render(items) {
  const highlighted = items.filter((item) => item.highlight);
  const badges = highlighted
    .map(
      (item) =>
        `  <a href="${item.prUrl}"><img alt="${item.repo} ${item.status} PR" src="${badgeUrl(item)}" /></a>`,
    )
    .join("\n");

  const rows = items
    .map((item) => {
      const more =
        item.status === "Merged" && item.prCount > 1
          ? ` (+${item.prCount - 1})`
          : "";
      return `| ${item.status} | \`${item.repo}\` (${item.stars} stars) | [#${item.pr}](${item.prUrl})${more} | ${item.scope} |`;
    })
    .join("\n");

  return [
    START_MARKER,
    "",
    '<p align="center">',
    badges,
    "</p>",
    "",
    "| Status | Project | PR | Scope |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    END_MARKER,
  ].join("\n");
}

async function main() {
  const items = [];

  for (const contribution of contributions) {
    const [repoInfo, prInfo] = await Promise.all([
      githubJson(`/repos/${contribution.repo}`),
      githubJson(`/repos/${contribution.repo}/pulls/${contribution.pr}`),
    ]);

    const status = await getPrStatus(
      contribution.repo,
      contribution.pr,
      prInfo,
    );

    const prCount =
      status === "Merged" ? await countMergedInRepo(contribution.repo) : null;

    items.push({
      ...contribution,
      status,
      stars: formatStars(repoInfo.stargazers_count),
      prUrl: prInfo.html_url,
      prCount,
    });
  }

  // 徽章只给 Merged 的条目，避免给未合并的 PR 加高亮
  items.forEach((item) => {
    if (item.highlight && item.status !== "Merged") {
      item.highlight = false;
    }
  });

  const readme = fs.readFileSync(README_PATH, "utf8");
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error("README contribution markers were not found.");
  }

  const before = readme.slice(0, start);
  const after = readme.slice(end + END_MARKER.length);
  fs.writeFileSync(README_PATH, `${before}${render(items)}${after}`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
