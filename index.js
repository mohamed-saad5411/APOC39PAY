// server.js — Plain Node.js, Node 18+ for global fetch

import { createServer } from "http";
import { Buffer } from "buffer";
import { URL } from "url";

const PORT = 4000;
// test
const MERCHANT_ID = "TESTQNBAATEST001"; //CANCERHOSP // username: merchant.CANCERHOSP
const MPGS_API_PASSWORD = "9c6a123857f1ea50830fa023ad8c8d1b"; // b787dc83048361da03682b71078ca05b
const MPGS_BASE_URL = "https://qnbalahli.test.gateway.mastercard.com";
const RETURN_URL = "https://apoc39.com/src/success.html";
// live
// const MERCHANT_ID = "CANCERHOSP";
// const MPGS_API_PASSWORD = "b787dc83048361da03682b71078ca05b"; 
// const MPGS_BASE_URL = "https://qnbalahli.gateway.mastercard.com";

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""; req.on("data", c => data += c);
    req.on("end", () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}
function basicAuthHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}
function uniqueOrderId() {
  return `ORD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/session") {
    try {
      const body = await readBody(req);
      const amount = String(body.amount);           // send as integer string
      const currency = "EGP";
      const description = String(body.description ?? "TEST Order 01");
      const returnUrl = String(body.returnUrl ?? RETURN_URL);

      // ALWAYS unique order id/reference
      const orderId = uniqueOrderId();

      const payload = {
        apiOperation: "INITIATE_CHECKOUT",
        interaction: {
          timeout: "1800",
          returnUrl,
          operation: "PURCHASE",
          merchant: { name: "TEST Merchant" },
          // merchant: { name: "merchant.CANCERHOSP" },
        },
        order: {
          currency,
          id: orderId,
          reference: orderId,
          amount,
          description,
        },
        transaction: { reference: "QNBAA_2023" },
      };

      const apiUrl = `${MPGS_BASE_URL}/api/rest/version/76/merchant/${MERCHANT_ID}/session`;
      console.log("[INITIATE_CHECKOUT] order.id:", orderId, "amount:", amount);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: basicAuthHeader(`merchant.${MERCHANT_ID}`, MPGS_API_PASSWORD),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("[MPGS ERROR]", response.status, data);
        return sendJson(res, response.status, { error: data || { message: "MPGS error" } });
      }

      // Frontend needs only session.id
      return sendJson(res, 200, { session: data.session, orderId });
    } catch (err) {
      console.error("[SERVER ERROR]", err);
      return sendJson(res, 500, { error: { message: err.message } });
    }
  }

  sendJson(res, 404, { error: { message: "Not found" } });
});

server.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));
