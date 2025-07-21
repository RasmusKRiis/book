#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const root = process.cwd();
const files = fs.readdirSync(root).filter(f => f.endsWith('.json'))
  .filter(f => ['books.json','rasmus.json','henry.json','andre.json'].includes(f));

const schema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    author: { type: 'string' },
    cover: { type: 'string' },
    releaseDate: { type: 'integer' },
    length: { type: 'integer' },
    genre: { type: 'string' },
    realism_value: { type: 'integer', minimum: 1, maximum: 10 },
    country: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    readDate: { type: 'string' },
    quotes: { type: 'object' }
  },
  required: ['id','title','author','cover','releaseDate','length','genre','realism_value','country','latitude','longitude','readDate','quotes'],
  additionalProperties: true
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

let all = [];
let errors = [];

files.forEach(file => {
  const filePath = path.join(root, file);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    errors.push(`Failed to parse ${file}: ${err.message}`);
    return;
  }
  json.forEach((entry, idx) => {
    if ('realeaseDate' in entry && !('releaseDate' in entry)) {
      entry.releaseDate = entry.realeaseDate;
      delete entry.realeaseDate;
      console.log(`Fixed realeaseDate -> releaseDate in ${file} at index ${idx}`);
    }
    if ('lenght' in entry && !('length' in entry)) {
      entry.length = entry.lenght;
      delete entry.lenght;
      console.log(`Fixed lenght -> length in ${file} at index ${idx}`);
    }
    if (!validate(entry)) {
      errors.push(`Validation error in ${file} (id ${entry.id ?? 'unknown'}): ${ajv.errorsText(validate.errors)}`);
    } else {
      all.push(entry);
    }
  });
});

if (errors.length) {
  errors.forEach(e => console.error(e));
  process.exitCode = 1;
} else {
  all.sort((a,b) => a.id - b.id);
  if (!fs.existsSync(path.join(root,'data'))) {
    fs.mkdirSync(path.join(root,'data'));
  }
  fs.writeFileSync(path.join(root,'data','allBooks.json'), JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} books to data/allBooks.json`);
}
