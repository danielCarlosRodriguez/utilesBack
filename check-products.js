const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://danielcarlosrodriguez_db_user:OqEnDTXbryeUnlya@cluster0.x7yyhc9.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=Cluster0';

const refIds = ["001", "002", "003", "004", "005", "006", "007", "008", "009", "0010", "0011", "0012"];

async function checkProducts() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Conectado a MongoDB');

    const db = client.db('utiles');
    const collection = db.collection('products');

    // Listar todas las colecciones
    console.log('\n--- Colecciones disponibles ---');
    const collections = await db.listCollections().toArray();
    console.log(collections.map(c => c.name));

    // Ver todos los productos para encontrar los que tienen los refIds
    console.log('\n--- Buscando productos con valores 001-0012 en cualquier campo ---');
    const allProducts = await collection.find({}).toArray();
    console.log(`Total de productos: ${allProducts.length}`);

    // Mostrar un documento completo para ver la estructura
    console.log('\n--- Estructura de un producto (sku 001) ---');
    const sample = allProducts.find(p => p.sku === '001');
    if (sample) {
      console.log('Campos:', Object.keys(sample));
      console.log('\nDocumento completo:');
      console.log(JSON.stringify(sample, null, 2));
    }

    // Mostrar los productos 001-012 con activo y destacado
    console.log('\n--- Productos 001-012 ---');
    const targetSkus = ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012"];
    allProducts
      .filter(p => targetSkus.includes(p.sku))
      .forEach(p => {
        console.log(`sku: ${p.sku}, activo: ${p.activo} (${typeof p.activo}), destacado: ${p.destacado} (${typeof p.destacado})`);
      });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkProducts();
