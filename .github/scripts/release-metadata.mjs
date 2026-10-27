import { readFile, writeFile } from 'node:fs/promises';

const [action, version, target, currentLatest] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function readChangelogSection(releaseVersion) {
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const lines = changelog.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => {
    const heading = line.match(/^## \[([^\]]+)\]/);
    return heading?.[1] === releaseVersion;
  });

  if (headingIndex < 0) fail(`CHANGELOG.md has no section for ${releaseVersion}.`);

  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^## \[/.test(line),
  );
  const endIndex = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex;
  const body = lines.slice(headingIndex + 1, endIndex).join('\n').trim();
  if (!body) fail(`CHANGELOG.md section ${releaseVersion} is empty.`);
  return body;
}

function compareStableVersions(left, right) {
  const parse = (value) => {
    const match = value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    if (!match) fail(`Release versions must use stable semver (major.minor.patch): ${value}.`);
    return match.slice(1).map(Number);
  };

  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

if (action === 'notes') {
  if (!version || !target) {
    fail('Usage: release-metadata.mjs notes <version> <output-file> [current-latest]');
  }
  const manifest = JSON.parse(await readFile('packages/cli/package.json', 'utf8'));
  if (manifest.version !== version) {
    fail(`Tag version ${version} does not match packages/cli/package.json (${manifest.version}).`);
  }
  compareStableVersions(version, version);
  if (currentLatest && compareStableVersions(version, currentLatest) < 0) {
    fail(`Refusing to release ${version}; npm latest is already newer (${currentLatest}).`);
  }
  const body = await readChangelogSection(version);
  await writeFile(target, `${body}\n`, 'utf8');
} else if (action === 'mark-published') {
  if (!version || !target) {
    fail('Usage: release-metadata.mjs mark-published <version> <source-commit>');
  }
  if (!/^[0-9a-f]{40}$/i.test(target)) fail('Source commit must be a full 40-character Git SHA.');
  await readChangelogSection(version);

  const roadmapPath = 'ROADMAP.md';
  let roadmap = await readFile(roadmapPath, 'utf8');
  const lines = roadmap.split(/\r?\n/);
  const rowIndexes = lines.flatMap((line, index) => {
    const cells = line.split('|');
    return cells[1]?.trim() === `v${version}` ? [index] : [];
  });
  if (rowIndexes.length !== 1) {
    fail(`Expected exactly one ROADMAP.md row for v${version}; found ${rowIndexes.length}.`);
  }

  const rowIndex = rowIndexes[0];
  const cells = lines[rowIndex].split('|');
  if (cells.length !== 6) fail(`ROADMAP.md row for v${version} does not have four columns.`);
  cells[3] = ' ✅ published ';
  lines[rowIndex] = cells.join('|');
  roadmap = lines.join('\n');

  const introLinePattern = /^> \*\*Versioning model:\*\*.*$/m;
  if (!introLinePattern.test(roadmap)) fail('ROADMAP.md versioning model line was not found.');
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const shortSha = target.slice(0, 7);
  const intro = `> **Versioning model:** \`v1.0.0\` is the first stable release. As checked on ${date}, npm \`latest\` is \`${version}\`, published from Git commit \`${shortSha}\`, and GitHub tag \`v${version}\` points to that same commit. Future releases follow semver; release versions do not mean every selectable stack combination is fully verified.`;
  roadmap = roadmap.replace(introLinePattern, intro);

  const overviewPath = 'docs/architecture/system-overview.md';
  let overview = await readFile(overviewPath, 'utf8');
  const overviewSnapshotPattern =
    /The source package and npm `latest` were both checked\s+at `[^`]+` on \d{4}-\d{2}-\d{2}/;
  if (!overviewSnapshotPattern.test(overview)) {
    fail(`${overviewPath} release snapshot was not found.`);
  }
  overview = overview.replace(
    overviewSnapshotPattern,
    `The source package and npm \`latest\` were both checked\nat \`${version}\` on ${date}`,
  );

  await writeFile(roadmapPath, roadmap, 'utf8');
  await writeFile(overviewPath, overview, 'utf8');
} else {
  fail('Usage: release-metadata.mjs <notes|mark-published> ...');
}
