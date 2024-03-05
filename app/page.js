import Runscraper from "./components/run-scraper";
const fs = require('fs');
const puppeteer = require('puppeteer')
const cheerio = require('cheerio');
let gigzArr = [];
const endpoint = 'https://www.wonderville.nyc/events';

export default function Home({ searchParams }) {
  if (searchParams.runScraperButton) {
    
    runScraper();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Runscraper />
    </main>
  );
}

const runScraper = async () => {
  gigzArr = []; // Reset array
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Scraping data...');

  await page.setViewport({ width: 1300, height: 600 });

  // Go to URL
  await page.goto(endpoint, { waitUntil: 'domcontentloaded' });

  // set this to null to scrape all events
  const numberOfEventsToScrape = null;
  await scrapeData(page, numberOfEventsToScrape);

  await browser.close();
  console.log('Browser closed');

  fs.writeFileSync('data.json', JSON.stringify(gigzArr, null, 2), 'utf-8');
  console.log('Data written to data.json');
  console.log(`Finished scraping data. You have ${gigzArr.length} events saved in data.json`);
};

const scrapeData = async (page, limit) => {
  const content = await page.content();
  const $ = cheerio.load(content);

  // Limit to first 5 items directly
  let selection = $('.eventlist-column-info')
  selection = limit ? selection.slice(0, limit) : selection;
  selection.each(async (i, el) => {
    const title = $(el).find('h1.eventlist-title').text().trim();
    const dateElement = $(el).find('time.event-date').first().attr('datetime');
    const formattedDate = formatDateForMongoDB(dateElement);
    const photoUrl = $(el).find('img').attr('src') || "default_image_url";
    let excerptHtml = $(el).find('.eventlist-description').html() || "";
    excerptHtml = excerptHtml.replace(/<br\s*\/?>/gi, '\n');
    const excerpt = processExcerpt(excerptHtml.replace(/<[^>]*>?/gm, '').trim());
    // Attempt to find the time using the first selector
    let timeElement = $(el).find('time.event-time-12hr').first().text().trim();

    // If the first selector doesn't find the time, try the second selector
    if (!timeElement) {
      timeElement = $(el).find('time.event-time-12hr-start').first().text().trim();
    }

    let processedExcerpt = processExcerpt(excerpt);
    const expiresAt = calculateExpiresAt(dateElement);

    const isDuplicate = gigzArr.some(event => event.title === title && event.date === formattedDate);
    if (!isDuplicate) {
      gigzArr.push({
      title,
      date: formattedDate,
      genre: "¯\\_(ツ)_/¯",
      location: "wonderville",
      time: timeElement || "¯\\_(ツ)_/¯",
      price: "¯\\_(ツ)_/¯",
      isFeatured: false,
      image: photoUrl,
      excerpt: processedExcerpt,
      rating: 0,
      expiresAt
    });
    console.log(`Scraped event: ${title}`);
  } else {
    console.log(`Duplicate event skipped: ${title}`);
  }
});
};

const processExcerpt = (text) => {
  // Pattern to find more than four consecutive newline characters
  const excessiveNewlinesPattern = /(\n{4,})/;
  const parts = text.split(excessiveNewlinesPattern);

  // If no excessive newlines found, return the original text
  if (parts.length === 1) {
    return text;
  }

  // Find the index of the first excessive newline occurrence
  const index = parts.findIndex(part => excessiveNewlinesPattern.test(part));
  
  // Join the text up to the index of excessive newlines, excluding the part with excessive newlines
  let trimmedText = parts.slice(0, index).join('');

  // Trim to the last word before the excessive newlines
  trimmedText = trimmedText.replace(/\s+\S*$/, '');

  return trimmedText;
};

const formatDateForMongoDB = (dateElement) => {
  if (!dateElement) return '';

  const date = new Date(dateElement);
  return date.toISOString().replace('.000Z', '.000+00:00');
};

const calculateExpiresAt = (eventDate) => {
  const date = new Date(eventDate);

  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(2, 0, 0, 0); 

  let isoString = date.toISOString(); 
  return isoString;
};


