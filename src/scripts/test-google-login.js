import "dotenv/config";
import { OAuth2Client } from "google-auth-library";

// ===============================
// Validaciones
// ===============================
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("❌ Falta GOOGLE_CLIENT_ID en el .env");
}

// El secret puede existir o no, NO lo usamos aquí
if (process.env.GOOGLE_CLIENT_SECRET) {
  console.log("ℹ️ GOOGLE_CLIENT_SECRET está definido (no se usa en este test)");
}

// ===============================
// Cliente OAuth
// ===============================
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ===============================
// ID TOKEN de prueba
// ===============================
// ⚠️ ESTE TOKEN TIENE QUE VENIR DE GOOGLE LOGIN REAL
// (por ahora lo dejamos vacío para probar estructura)
const ID_TOKEN = ""; // <- luego pegaremos uno real

async function testGoogleLogin() {
  if (!ID_TOKEN) {
    console.log("⚠️ No hay ID Token aún");
    console.log("👉 El script está bien configurado");
    console.log("👉 Falta probarlo con un token real del frontend");
    return;
  }

  const ticket = await client.verifyIdToken({
    idToken: ID_TOKEN,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  console.log("✅ Token válido");
  console.log({
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    email_verified: payload.email_verified,
  });
}

testGoogleLogin().catch((err) => {
  console.error("❌ Error verificando token");
  console.error(err);
  process.exit(1);
});
