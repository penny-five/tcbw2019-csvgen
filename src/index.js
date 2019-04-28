import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { escape } from 'querystring';
import { promisify } from 'util';

import axios from 'axios';
import csv from 'csv-stringify';
import _ from 'lodash';
import Xray from 'x-ray';

const x = new Xray({
  filters: {
    unwrapRating: rating => +rating.slice(1, rating.length - 1)
  }
});

const fetchBeers = async () => {
  const res = await axios.get('https://www.tcbw.ee/2019/a/data/data.json');

  return _.flatMap(res.data.brewer, brewer =>
    brewer.beer.map(beer => ({
      brewery: brewer.name,
      name: beer.name,
      abv: beer.abv,
      style: beer.style,
      day: beer.stage[0]
    }))
  );
};

const fetchUntappdRating = async beer => {
  const q = escape(`${beer.brewery} ${beer.name}`);
  const url = `https://untappd.com/search?q=${q}&type=beer&sort=all`;
  const res = await x(url, '.results-container .beer-item', [
    {
      untappd_href: '.name a@href',
      untappd_rating: '.rating .num | unwrapRating'
    }
  ]);

  return res.length > 0 ? res[0] : null;
};

const sleep = millis =>
  new Promise(resolve => {
    setTimeout(resolve, millis);
  });

const generateCsv = beers =>
  promisify(csv)(beers, {
    header: true,
    columns: [
      'brewery',
      'name',
      'day',
      'abv',
      'style',
      'untappd_rating',
      'untappd_href'
    ]
  });

const generateRandomOutputFilename = () =>
  `output-${randomBytes(12).toString('hex')}.csv`;

const start = async () => {
  console.log('Fetching beers...');

  const beers = await fetchBeers();

  console.log(`Found ${beers.length} beers.`);

  console.log(`Fetching untappd ratings...`);

  const beersWithRatings = [];

  for (let [index, beer] of beers.entries()) {
    console.log(`${index + 1} / ${beers.length}`);

    const untappdRating = await fetchUntappdRating(beer);
    beersWithRatings.push({ ...beer, ...untappdRating });

    await sleep(2000); // avoid rate limiting
  }

  console.log('Generating .csv...');

  const csv = await generateCsv(beersWithRatings);
  const outputFilename = generateRandomOutputFilename();
  writeFileSync(outputFilename, csv, { encoding: 'UTF-8' });

  console.log(`Output written to ${outputFilename}`);
};

const runScript = false; // change to "true" to enable the script

if (runScript) start();
