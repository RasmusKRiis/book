// netlify/functions/uploadCover.js
const Busboy = require('busboy');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const user = context.clientContext && context.clientContext.user;
  const roles = user && user.app_metadata && user.app_metadata.roles || [];
  if (!roles.includes('admin')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Parse multipart form-data
  return await new Promise((resolve, reject) => {
    const bb = Busboy({ headers: event.headers });
    let fileBuffer = Buffer.alloc(0);
    let fileName = 'cover';
    let mimeType = 'application/octet-stream';

    bb.on('file', (name, file, info) => {
      fileName = info.filename;
      mimeType = info.mimeType;
      file.on('data', data => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    bb.on('finish', async () => {
      try {
        let url;
        if (process.env.CLOUDINARY_URL) {
          cloudinary.uploader.upload_stream({
            folder: 'book-covers',
            public_id: `book_${Date.now()}`
          }, (error, res) => {
            if (error) {
              reject(error);
            } else {
              resolve({ statusCode: 201, body: JSON.stringify({ url: res.secure_url }) });
            }
          }).end(fileBuffer);
          return;
        } else {
          const content = fileBuffer.toString('base64');
          const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
          const owner = 'RasmusKoRiis';
          const repo = 'book';
          const branch = 'main';
          const path = `public/covers/book_${Date.now()}_${fileName}`;
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: `Add cover ${fileName}`,
              content,
              branch
            })
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`GitHub upload failed: ${txt}`);
          }
          url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        }
        resolve({ statusCode: 201, body: JSON.stringify({ url }) });
      } catch(err) {
        reject(err);
      }
    });

    const enc = event.isBase64Encoded ? 'base64' : 'binary';
    bb.end(event.body, enc);
  }).catch(err => ({ statusCode: 500, body: err.message }));
};
