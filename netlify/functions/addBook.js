// netlify/functions/addBook.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed, use POST.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON in request body' }) };
  }

  const { secretPassword, newBook = {}, coverFile, defaultsFromAPI = {}, source } = body;

  if (secretPassword !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Unauthorized: incorrect password' }) };
  }

  const host = process.env.URL || `http://localhost:${process.env.PORT || 8888}`;
  let coverUrl;
  if (coverFile) {
    try {
      const boundary = '----codex' + Date.now();
      const parts = [];
      parts.push(`--${boundary}\r\n` +
        `Content-Disposition: form-data; name="cover"; filename="${coverFile.fileName || 'cover.jpg'}"\r\n` +
        `Content-Type: ${coverFile.mimeType || 'image/jpeg'}\r\n\r\n`);
      parts.push(Buffer.from(coverFile.data, 'base64'));
      parts.push(`\r\n--${boundary}--\r\n`);
      const bodyBuf = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));
      const res = await fetch(`${host}/.netlify/functions/uploadCover`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: bodyBuf,
      });
      if (!res.ok) {
        throw new Error(`uploadCover status ${res.status}`);
      }
      const data = await res.json();
      coverUrl = data.url;
    } catch (err) {
      console.error('Cover upload failed:', err);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
    }
  }

  const book = { ...defaultsFromAPI, ...newBook };
  if (coverUrl) {
    book.cover = coverUrl;
  }
  if (!book.id) book.id = Date.now();

  if (!book.title || !book.authors || !book.authors.length) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing required fields title/authors' }) };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const owner = 'RasmusKoRiis';
  const repo = 'book';
  const branch = 'main';
  const fileName = source || 'books.json';

  async function getBooksJson(fileNameParam) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileNameParam}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${fileNameParam} from GitHub (status ${res.status})`);
    }
    const data = await res.json();
    const decoded = Buffer.from(data.content, 'base64').toString();
    return { books: JSON.parse(decoded), sha: data.sha };
  }

  async function updateBooksJson(updatedBooks, sha, fileNameParam) {
    const newContent = Buffer.from(JSON.stringify(updatedBooks, null, 2)).toString('base64');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileNameParam}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add new book: ${book.title}`,
        content: newContent,
        sha,
        branch
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed to update ${fileNameParam}: ${txt}`);
    }
    return res.json();
  }

  try {
    const { books, sha } = await getBooksJson(fileName);
    books.push(book);
    await updateBooksJson(books, sha, fileName);
    return { statusCode: 200, body: JSON.stringify({ success: true, id: book.id }) };
  } catch (err) {
    console.error('Error in addBook:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
