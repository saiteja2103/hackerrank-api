const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

async function scrapeTrackScore(username, track) {
  const url = `https://www.hackerrank.com/leaderboard?filter=${username}&filter_on=hacker&page=1&track=${track}&type=practice`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote"
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : undefined
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.ui-table.ui-leaderboard-table', { timeout: 20000 });

    const userData = await page.evaluate((username) => {
      const rows = document.querySelectorAll('.ui-table .table-row-wrapper');
      for (const row of rows) {
        const hacker = row.querySelector('.table-row-column.ellipsis.hacker')?.innerText.trim();
        const rank = row.querySelector('.table-row-column.ellipsis.rank span')?.getAttribute('data-balloon')?.trim();
        const score = row.querySelector('.table-row-column.ellipsis.score')?.innerText.trim();

        if (hacker && hacker.toLowerCase() === username.toLowerCase()) {
          return { username: hacker, rank, score };
        }
      }
      return null;
    }, username);

    await browser.close();
    return userData;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

app.get('/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const algorithmsData = await scrapeTrackScore(username, 'algorithms');
    const dataStructuresData = await scrapeTrackScore(username, 'data-structures');

    if (!algorithmsData && !dataStructuresData) {
      return res.status(404).json({ error: 'User not found on both tracks' });
    }

    return res.json({
      username,
      algorithm_score: algorithmsData?.score || 'N/A',
      algorithm_rank: algorithmsData?.rank || 'N/A',
      data_structures_score: dataStructuresData?.score || 'N/A',
      data_structures_rank: dataStructuresData?.rank || 'N/A'
    });
  } catch (err) {
    console.error('Scraping error:', err.message);
    return res.status(500).json({ error: 'Scraping failed', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
