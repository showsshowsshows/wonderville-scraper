import Runscraper from "./components/run-scraper";
const fs = require('fs');
const puppeteer = require('puppeteer');
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
  await page.waitForSelector('.eventlist-column-info'); // Wait for the event list to load
  const content = await page.content();
  const $ = cheerio.load(content);

  let selection = $('.eventlist-column-info');
  selection = limit ? selection.slice(0, limit) : selection;
  selection.each((i, el) => {
    const title = $(el).find('h1.eventlist-title').text().trim();
    const dateElement = $(el).find('time.event-date').first().attr('datetime');
    const formattedDate = formatDateForMongoDB(dateElement);
    const photoUrl = $(el).find('img').attr('src') || "default_image_url";
    let excerptHtml = $(el).find('.eventlist-description').html() || "";
    const excerpt = processExcerpt(excerptHtml);
    let timeElement = $(el).find('time.event-time-12hr').first().text().trim();

    if (!timeElement) {
      timeElement = $(el).find('time.event-time-12hr-start').first().text().trim();
    }

    const link = $(el).find('a.sqs-block-button-element--primary').attr('href') || "";
    console.log(link)
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
        excerpt: excerpt,
      });
      console.log(`Scraped event: ${title}`);
    } else {
      console.log(`Duplicate event skipped: ${title}`);
    }
  });
};

const processExcerpt = (html) => {
  const $ = cheerio.load(html);
  let formattedExcerpt = "";

  // Remove all links except RSVP
  $('a').not('.sqs-block-button-element--primary').remove();

  // Add paragraphs and handle breaks
  const textParts = html.split(/<br\s*\/?>/i);
  textParts.forEach(part => {
    const cleanText = cheerio.load(part).text().trim();
    if (cleanText) {
      formattedExcerpt += `<p>${cleanText}</p>`;
    }
  });

  // Add RSVP link as a list item
  const rsvpLink = $('a.sqs-block-button-element--primary').attr('href');
  if (rsvpLink) {
    formattedExcerpt += `<ul><li><a href='${rsvpLink}'>RSVP</a></li></ul>`;
  }

  return formattedExcerpt;
};

const formatDateForMongoDB = (dateElement) => {
  if (!dateElement) return '';

  const date = new Date(dateElement);
  return date.toISOString().replace('.000Z', '.000+00:00');
};
