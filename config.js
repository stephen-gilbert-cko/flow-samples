require("dotenv").config();

function getBaseUrl() {
  const baseUrl = process.env.BASE_URL;

  // If no BASE_URL provided, use the default
  if (!baseUrl) {
    return "https://api.sandbox.checkout.com";
  }

  // Remove trailing slash if present
  let normalizedUrl = baseUrl.trim().replace(/\/+$/, "");

  // Add https:// if no protocol is specified
  if (!normalizedUrl.match(/^https?:\/\//)) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  return normalizedUrl;
}

// Derive the access (OAuth) URL from the API base URL,
// e.g. https://{prefix}.api.sandbox.checkout.com -> https://{prefix}.access.sandbox.checkout.com
function getAccessUrl(baseUrl) {
  return baseUrl.replace(/(\/\/|\.)api\./, "$1access.");
}

const baseUrl = getBaseUrl();

module.exports = {
  baseUrl,
  accessUrl: getAccessUrl(baseUrl),
  publicKey: process.env.PUBLIC_KEY,
  secretKey: process.env.SECRET_KEY,
  accessKeyId: process.env.ACCESS_KEY_ID,
  accessKeySecret: process.env.ACCESS_KEY_SECRET,
  processingChannelId: process.env.PROCESSING_CHANNEL_ID,
  customerId: process.env.CUSTOMER_ID,
  applePayUrl: process.env.APPLE_PAY_URL,
  adyenApiKey: process.env.ADYEN_API_KEY,
  adyenMerchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  globalPaymentsAppId: process.env.GLOBAL_PAYMENTS_APP_ID,
  globalPaymentsAppKey: process.env.GLOBAL_PAYMENTS_APP_KEY,
};
