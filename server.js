const fetch = require("node-fetch");
const express = require("express");
const app = express();
app.use(express.static("public"));
app.use(express.json());
const { publicKey, secretKey, accessKeyId, accessKeySecret, processingChannelId, customerId} = require("./config");
const port = process.env.PORT || 3000;

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  // Check if access key credentials provided
  if (!accessKeyId || !accessKeySecret) {
    return null;
  }

  // Check for a valid cached token
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch('https://access.sandbox.checkout.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: accessKeyId,
        client_secret: accessKeySecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    
    // Default expiry = 4 hours
    const expiresIn = (data.expires_in || 14400) * 1000; // Convert to milliseconds
    tokenExpiry = Date.now() + expiresIn - 60000; // Subtract 1 minute for safety
    
    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Get public API key and customer ID from config
app.get("/config", (_req, res) => {
  res.json({ publicKey, customerId });
});

app.post("/create-payment-session", async (req, res) => {
  try {
    const {
      amount,
      currency,
      billing,
      success_url,
      failure_url,
      payment_type,
      billing_descriptor,
      reference,
      description,
      customer,
      shipping,
      recipient,
      processing,
      instruction,
      processing_channel_id,
      payment_method_configuration,
      items,
      amount_allocations,
      risk,
      display_name,
      metadata,
      locale,
      "3ds": threeDS,
      sender,
      capture,
      capture_on,
      expires_on,
      enabled_payment_methods,
      disabled_payment_methods,
      customer_retry,
    } = req.body;

    // Try to get access token; fallback to secret key
    const token = await getAccessToken();
    const authToken = token || secretKey;

    if (!authToken) {
      return res.status(500).json({
        error: "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    const request = await fetch(
      "https://api.sandbox.checkout.com/payment-sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount || 3000,
          currency: currency || "GBP",
          billing: billing || {
            address: {
              address_line1: "123 High St.",
              address_line2: "Flat 456",
              city: "London",
              zip: "SW1A 1AA",
              country: "GB",
            },
            phone: {
              number: "7987654321",
              country_code: "+44",
            },
          },
          success_url: success_url || "http://localhost:3000?status=succeeded",
          failure_url: failure_url || "http://localhost:3000?status=failed",
          payment_type: payment_type || "Regular",
          billing_descriptor: billing_descriptor || {
            name: "Checkout.com",
            city: "London",
          },
          reference: reference || "1234567890",
          description: description || "Payment",
          customer: customer || {
            email: "john.smith@mail.com",
            name: "John Smith",
            phone: {
              country_code: "+44",
              number: "7987654321",
            },
          },
          shipping: shipping || {
            address: {
              address_line1: "123 High St.",
              address_line2: "Flat 456",
              city: "London",
              zip: "SW1A 1AA",
              country: "GB",
            },
            phone: {
              number: "7987654321",
              country_code: "+44",
            },
          },
          recipient: recipient,
          processing: processing,
          instruction: instruction,
          processing_channel_id: processing_channel_id || processingChannelId,
          payment_method_configuration: payment_method_configuration,
          items: items || [
            {
              name: "T-shirt",
              quantity: 1,
              unit_price: 3000,
            },
          ],
          amount_allocations: amount_allocations,
          risk: risk,
          display_name: display_name,
          metadata: metadata,
          locale: locale,
          "3ds": threeDS,
          sender: sender,
          capture: capture,
          capture_on: capture_on,
          expires_on: expires_on,
          enabled_payment_methods: enabled_payment_methods,
          disabled_payment_methods: disabled_payment_methods,
          customer_retry: customer_retry,
        }),
      }
    );

    const parsedPayload = await request.json();

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).json({
      error: "Internal server error while creating payment session",
    });
  }
});

app.listen(port, () =>
  console.log(`Node server listening on port ${port}: http://localhost:${port}/`)
);
