/**
 * Script de migración de imágenes a Cloudinary
 *
 * Descarga imágenes desde Netlify, las sube a Cloudinary,
 * y actualiza MongoDB con las URLs nuevas.
 *
 * Uso: node src/scripts/migrateImages.js
 */

require('dotenv').config();

const https = require('https');
const { Readable } = require('stream');
const { connectToDatabase, getCollection, closeConnection } = require('../config/database');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

const DATABASE = 'utiles';
const COLLECTION = 'products';
const BASE_URL = 'https://utiles-ya.netlify.app/imagenes/productos';
const CLOUDINARY_FOLDER = 'utilesya/products';

// Reporte de migración
const report = {
  total: 0,
  success: 0,
  errors: 0,
  skipped: 0,
  rows: []
};

/**
 * Descarga una imagen por URL y retorna el buffer
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Sube un buffer a Cloudinary
 */
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

    const bufferStream = Readable.from(buffer);
    bufferStream.pipe(stream);
  });
}

/**
 * Procesa un producto: descarga y sube todas sus imágenes
 */
async function processProduct(product) {
  const refid = product.refid;
  const images = product.imagen || [];

  if (!images.length) {
    console.log(`  [${refid}] Sin imágenes, se omite`);
    report.skipped++;
    return null;
  }

  const cloudinaryUrls = [];

  for (const filename of images) {
    const url = `${BASE_URL}/${filename}`;
    report.total++;

    try {
      console.log(`  [${refid}] Descargando ${filename}...`);
      const buffer = await downloadImage(url);

      console.log(`  [${refid}] Subiendo ${filename} a Cloudinary...`);
      const result = await uploadToCloudinary(buffer, filename);

      cloudinaryUrls.push(result.secure_url);
      report.success++;
      report.rows.push({ refid, filename, url: result.secure_url, status: 'OK' });
      console.log(`  [${refid}] ${filename} -> OK`);
    } catch (err) {
      report.errors++;
      report.rows.push({ refid, filename, url: '-', status: `ERROR: ${err.message}` });
      console.error(`  [${refid}] ${filename} -> ERROR: ${err.message}`);
    }
  }

  return cloudinaryUrls.length > 0 ? cloudinaryUrls : null;
}

/**
 * Genera el archivo de reporte
 */
function generateReport() {
  const lines = [
    '# Reporte de Migración de Imágenes a Cloudinary',
    '',
    `Fecha: ${new Date().toISOString().split('T')[0]}`,
    '',
    '## Resumen',
    '',
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| Total de imágenes | ${report.total} |`,
    `| Exitosas | ${report.success} |`,
    `| Errores | ${report.errors} |`,
    `| Productos sin imágenes | ${report.skipped} |`,
    '',
    '## Detalle',
    '',
    '| RefID | Filename | URL Cloudinary | Estado |',
    '|-------|----------|----------------|--------|',
    ...report.rows.map(r => `| ${r.refid} | ${r.filename} | ${r.url} | ${r.status} |`),
    ''
  ];

  const reportPath = path.join(__dirname, '..', '..', 'borrador', 'documentación', 'migracion-imagenes.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`\nReporte guardado en: ${reportPath}`);
}

/**
 * Main
 */
async function main() {
  console.log('=== Migración de imágenes a Cloudinary ===\n');

  try {
    await connectToDatabase();
    const col = getCollection(DATABASE, COLLECTION);

    const products = await col.find({}).toArray();
    console.log(`Encontrados ${products.length} productos\n`);

    for (const product of products) {
      console.log(`Procesando producto ${product.refid} - ${product.descripción || ''}...`);
      const cloudinaryUrls = await processProduct(product);

      if (cloudinaryUrls) {
        await col.updateOne(
          { _id: product._id },
          { $set: { imagenCloudinary: cloudinaryUrls } }
        );
        console.log(`  [${product.refid}] MongoDB actualizado (${cloudinaryUrls.length} URLs)\n`);
      } else {
        console.log('');
      }
    }

    generateReport();

    console.log('\n=== Migración completada ===');
    console.log(`Total: ${report.total} | OK: ${report.success} | Errores: ${report.errors} | Sin imágenes: ${report.skipped}`);
  } catch (err) {
    console.error('Error fatal:', err);
  } finally {
    await closeConnection();
  }
}

main();
