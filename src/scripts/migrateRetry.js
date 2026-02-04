/**
 * Reintento de migración para imágenes que fallaron
 * Uso: node src/scripts/migrateRetry.js
 */

require('dotenv').config();

const https = require('https');
const { Readable } = require('stream');
const { connectToDatabase, getCollection, closeConnection } = require('../config/database');
const cloudinary = require('../config/cloudinary');
const path = require('path');

const DATABASE = 'utiles';
const COLLECTION = 'products';
const BASE_URL = 'https://utiles-ya.netlify.app/imagenes/productos';
const CLOUDINARY_FOLDER = 'utilesya/products';

// Imágenes a reintentar: { refid, filename }
const RETRY_LIST = [
  { refid: '014', filename: '076-01.png' },
  { refid: '031', filename: '031-01.png' }
];

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const nameWithoutExt = path.parse(filename).name;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: nameWithoutExt,
        resource_type: 'image',
        overwrite: true,
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

async function main() {
  console.log('=== Reintento de imágenes fallidas ===\n');

  try {
    await connectToDatabase();
    const col = getCollection(DATABASE, COLLECTION);

    for (const { refid, filename } of RETRY_LIST) {
      const url = `${BASE_URL}/${filename}`;
      console.log(`[${refid}] Descargando ${filename}...`);

      try {
        const buffer = await downloadImage(url);
        console.log(`[${refid}] Tamaño: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
        console.log(`[${refid}] Subiendo a Cloudinary...`);

        const result = await uploadToCloudinary(buffer, filename);
        console.log(`[${refid}] OK -> ${result.secure_url}`);

        // Actualizar MongoDB: agregar la URL al array imagenCloudinary
        const product = await col.findOne({ refid });
        if (product) {
          const currentUrls = product.imagenCloudinary || [];
          // Insertar al inicio (es la imagen principal 076-01 / 031-01)
          currentUrls.unshift(result.secure_url);
          await col.updateOne({ refid }, { $set: { imagenCloudinary: currentUrls } });
          console.log(`[${refid}] MongoDB actualizado (${currentUrls.length} URLs)\n`);
        }
      } catch (err) {
        console.error(`[${refid}] ERROR: ${err.message}\n`);
      }
    }

    console.log('=== Reintento completado ===');
  } catch (err) {
    console.error('Error fatal:', err);
  } finally {
    await closeConnection();
  }
}

main();
