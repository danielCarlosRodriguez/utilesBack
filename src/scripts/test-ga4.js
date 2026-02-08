import { BetaAnalyticsDataClient } from "@google-analytics/data";

// ===============================
// Validaciones de entorno
// ===============================
if (!process.env.GA4_PROPERTY_ID) {
  throw new Error("❌ Falta GA4_PROPERTY_ID en las variables de entorno");
}

if (!process.env.GA4_CREDENTIALS_JSON) {
  throw new Error("❌ Falta GA4_CREDENTIALS_JSON en las variables de entorno");
}

// ===============================
// Credenciales (fix private_key)
// ===============================
let rawCredentials;

try {
  rawCredentials = JSON.parse(process.env.GA4_CREDENTIALS_JSON);
} catch (err) {
  throw new Error("❌ GA4_CREDENTIALS_JSON no es un JSON válido");
}

const credentials = {
  ...rawCredentials,
  private_key: rawCredentials.private_key.replace(/\\n/g, "\n"),
};

// ===============================
// Cliente GA4
// ===============================
const analyticsClient = new BetaAnalyticsDataClient({
  credentials,
});

const propertyId = process.env.GA4_PROPERTY_ID;

// ===============================
// Test
// ===============================
async function testGA4() {
  console.log("🔍 Probando conexión con Google Analytics GA4...");
  console.log("📊 Property ID:", propertyId);

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
  });

  const sessions = response.rows?.[0]?.metricValues?.[0]?.value ?? "0";
  const users = response.rows?.[0]?.metricValues?.[1]?.value ?? "0";

  console.log("✅ Conexión exitosa");
  console.log("📈 Últimos 7 días:");
  console.log("   - Sesiones:", sessions);
  console.log("   - Usuarios:", users);
}

// ===============================
// Ejecutar
// ===============================
testGA4()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error al consultar GA4");
    console.error(err);
    process.exit(1);
  });
