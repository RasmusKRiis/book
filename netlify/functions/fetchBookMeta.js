// netlify/functions/fetchBookMeta.js
const GoogleBooks = require('google-books-node');
const openlib = require('openlibrary-meta');
const fetch = require('node-fetch');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { isbn, title } = event.queryStringParameters || {};
  if (!isbn && !title) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, message:'Missing isbn or title' }) };
  }

  let book;
  // Primary source: google-books-node
  try {
    const query = isbn || title;
    const res = await GoogleBooks.search(query);
    if (res && res.length) {
      book = res[0];
    }
  } catch (err) {
    console.error('Google Books lookup failed:', err);
  }

  // Fallback: Open Library
  if (!book) {
    try {
      if (isbn) {
        book = await openlib.isbn(isbn);
      } else {
        const s = await openlib.search({ title });
        book = s && s.docs && s.docs[0];
      }
    } catch (err) {
      console.error('Open Library lookup failed:', err);
    }
  }

  if (!book) {
    return { statusCode: 404, body: JSON.stringify({ ok:false, message:'Book not found' }) };
  }

  // Normalize fields
  const findIsbn13 = (ids = []) => {
    const obj = ids.find(i => i.type === 'ISBN_13');
    return obj ? obj.identifier : undefined;
  };

  const normalized = {
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors || book.author_name || [],
    description: book.description || (book.volumeInfo && book.volumeInfo.description),
    publishedDate: book.publishedDate || book.publish_date,
    pageCount: book.pageCount || book.number_of_pages,
    categories: book.categories || book.subjects,
    imageLinks: { thumbnail: book.imageLinks?.thumbnail || (book.cover && book.cover.medium) },
    language: book.language,
    identifiers: {
      ISBN_13: book.identifiers?.ISBN_13 || findIsbn13(book.industryIdentifiers)
    },
    industryIdentifiers: book.industryIdentifiers || [],
    publisher: book.publisher
  };

  return {
    statusCode: 200,
    body: JSON.stringify({ ok:true, data: normalized })
  };
};
