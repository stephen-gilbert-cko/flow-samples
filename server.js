const fetch = require("node-fetch");
const express = require("express");
const CryptoJS = require("crypto-js");
const app = express();
app.use(express.static("public"));
app.use(express.json());
const {
  baseUrl,
  publicKey,
  secretKey,
  accessKeyId,
  accessKeySecret,
  processingChannelId,
  customerId,
  adyenApiKey,
  adyenMerchantAccount,
  stripeSecretKey,
  globalPaymentsAppId,
  globalPaymentsAppKey,
} = require("./config");
const port = process.env.PORT || 3000;

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

// Store surcharge amounts per payment session - simplified for demonstration purposes; use a database in production
const paymentSessionSurcharges = new Map();

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
    const response = await fetch(
      "https://access.sandbox.checkout.com/connect/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: accessKeyId,
          client_secret: accessKeySecret,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get access token: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    accessToken = data.access_token;

    // Default expiry = 4 hours
    const expiresIn = (data.expires_in || 14400) * 1000; // Convert to milliseconds
    tokenExpiry = Date.now() + expiresIn - 60000; // Subtract 1 minute for safety

    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

async function getGlobalPaymentsAccessToken() {
  if (!globalPaymentsAppId || !globalPaymentsAppKey) {
    throw new Error(
      "GLOBAL_PAYMENTS_APP_ID and GLOBAL_PAYMENTS_APP_KEY required in .env file."
    );
  }

  const nonce = new Date().toISOString();
  const secret = CryptoJS.SHA512(nonce + "" + globalPaymentsAppKey).toString(
    CryptoJS.enc.Hex
  );

  try {
    const response = await fetch(
      "https://apis.sandbox.globalpay.com/ucp/accesstoken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GP-Version": "2021-03-22",
        },
        body: JSON.stringify({
          app_id: globalPaymentsAppId,
          secret: secret,
          grant_type: "client_credentials",
          nonce: nonce,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get Global Payments access token: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Error getting Global Payments access token:", error);
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
        error:
          "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    const request = await fetch(
      `${baseUrl}/payment-sessions`,
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
              country_code: "44",
            },
          },
          success_url:
            success_url || `http://localhost:${port}?status=succeeded`,
          failure_url: failure_url || `http://localhost:${port}?status=failed`,
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
              country_code: "44",
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
              country_code: "44",
            },
          },
          recipient: recipient,
          processing: processing,
          instruction: instruction,
          processing_channel_id: processing_channel_id || processingChannelId,
          payment_method_configuration: payment_method_configuration,
          items: items,
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

    // Store base amount for this payment session if creation was successful
    if (request.status === 201) {
      const baseAmount = amount || 3000;
      paymentSessionSurcharges.set(parsedPayload.id, {
        baseAmount: baseAmount,
        surchargeAmount: 0,
      });
    }

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).json({
      error: "Internal server error while creating payment session",
    });
  }
});

app.post("/calculate-surcharge/:paymentSessionId", async (req, res) => {
  try {
    const { paymentSessionId } = req.params;
    const { card_category } = req.body;

    // Get base amount for this payment session
    const sessionData = paymentSessionSurcharges.get(paymentSessionId);
    if (!sessionData) {
      return res.status(404).json({
        error: "Payment session not found",
      });
    }

    // Calculate surcharge based on card category
    let surchargeAmount = 0;
    if (card_category === "commercial") {
      surchargeAmount = 100;
    }

    // Update stored surcharge amount
    sessionData.surchargeAmount = surchargeAmount;
    paymentSessionSurcharges.set(paymentSessionId, sessionData);

    res.json({
      surchargeAmount: surchargeAmount,
      baseAmount: sessionData.baseAmount,
      totalAmount: sessionData.baseAmount + surchargeAmount,
    });
  } catch (error) {
    console.error("Error calculating surcharge:", error);
    res.status(500).json({
      error: "Internal server error while calculating surcharge",
    });
  }
});

app.post("/submit-payment-session/:paymentSessionId", async (req, res) => {
  try {
    const { paymentSessionId } = req.params;
    const { session_data, amount } = req.body;

    // Validate amount matches expected base + surcharge
    const sessionData = paymentSessionSurcharges.get(paymentSessionId);
    if (!sessionData) {
      return res.status(404).json({
        error: "Payment session not found",
      });
    }

    const expectedAmount = sessionData.baseAmount + sessionData.surchargeAmount;
    if (amount !== expectedAmount) {
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} but received ${amount}`,
        expectedAmount: expectedAmount,
        receivedAmount: amount,
      });
    }

    // Try to get access token; fallback to secret key
    const token = await getAccessToken();
    const authToken = token || secretKey;

    if (!authToken) {
      return res.status(500).json({
        error:
          "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    const request = await fetch(
      `${baseUrl}/payment-sessions/${paymentSessionId}/submit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_data: session_data,
          amount: amount,
        }),
      }
    );

    const parsedPayload = await request.json();

    // Clean up stored surcharge data after successful submission
    if (request.status === 201 || request.status === 202) {
      paymentSessionSurcharges.delete(paymentSessionId);
    }

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error submitting payment session:", error);
    res.status(500).json({
      error: "Internal server error while submitting payment session",
    });
  }
});

app.post("/create-instrument", async (req, res) => {
  try {
    const { token, billing_address, customer } = req.body;

    // Try to get access token; fallback to secret key
    const authToken = (await getAccessToken()) || secretKey;

    if (!authToken) {
      return res.status(500).json({
        error:
          "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    const request = await fetch(
      `${baseUrl}/instruments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "token",
          token: token,
          account_holder: {
            billing_address: billing_address || {
              address_line1: "123 High St.",
              address_line2: "Flat 456",
              city: "London",
              zip: "SW1A 1AA",
              country: "GB",
            },
          },
          customer: customer || {
            email: "john.smith@mail.com",
            name: "John Smith",
            phone: {
              country_code: "44",
              number: "7987654321",
            },
          },
        }),
      }
    );

    const parsedPayload = await request.json();

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error creating instrument:", error);
    res.status(500).json({
      error: "Internal server error while creating instrument",
    });
  }
});

app.post("/create-authentication-session", async (req, res) => {
  try {
    const {
      token,
      instrumentId,
      amount,
      currency,
      billing_address,
      mobile_phone,
      email,
      processing_channel_id: requestProcessingChannelId,
      billing_descriptor,
      reference,
      shipping_address,
      completion,
    } = req.body;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(500).json({
        error:
          "Access key credentials required for standalone authentication. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET in .env file.",
      });
    }

    let source;
    if (instrumentId) {
      source = {
        type: "id",
        id: instrumentId,
        billing_address: billing_address || {
          address_line1: "123 High St.",
          address_line2: "Flat 456",
          city: "London",
          zip: "SW1A 1AA",
          country: "GB",
        },
        mobile_phone: mobile_phone || {
          country_code: "44",
          number: "7987654321",
        },
        email: email || "john.smith@mail.com",
      };
    } else {
      source = {
        type: "token",
        token: token,
        billing_address: billing_address || {
          address_line1: "123 High St.",
          address_line2: "Flat 456",
          city: "London",
          zip: "SW1A 1AA",
          country: "GB",
        },
        mobile_phone: mobile_phone || {
          country_code: "44",
          number: "7987654321",
        },
        email: email || "john.smith@mail.com",
      };
    }

    const request = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: source,
        amount: amount || 3000,
        currency: currency || "GBP",
        processing_channel_id:
          requestProcessingChannelId || processingChannelId,
        billing_descriptor: billing_descriptor || {
          name: "Checkout.com",
          city: "London",
        },
        reference: reference || "1234567890",
        shipping_address: shipping_address || {
          address_line1: "123 High St.",
          address_line2: "Flat 456",
          city: "London",
          zip: "SW1A 1AA",
          country: "GB",
        },
        completion: completion || {
          type: "hosted",
          success_url:
            success_url ||
            `http://localhost:${port}?authentication-status=succeeded`,
          failure_url:
            failure_url ||
            `http://localhost:${port}?authentication-status=failed`,
        },
      }),
    });

    const parsedPayload = await request.json();

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error creating authentication session:", error);
    res.status(500).json({
      error: "Internal server error while creating authentication session",
    });
  }
});

app.get("/get-authentication-details", async (req, res) => {
  try {
    const { authSessionId } = req.query;

    if (!authSessionId) {
      return res.status(400).json({
        error: "authSessionId query parameter is required",
      });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(500).json({
        error:
          "Access key credentials required. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET in .env file.",
      });
    }

    const request = await fetch(
      `${baseUrl}/sessions/${authSessionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const parsedPayload = await request.json();

    if (!request.ok) {
      return res.status(request.status).json(parsedPayload);
    }

    const authDetails = {
      protocol_version: parsedPayload.protocol_version,
      eci: parsedPayload.eci,
      cryptogram: parsedPayload.cryptogram,
      xid: parsedPayload.xid,
      acs_reference_number: parsedPayload.acs?.reference_number,
      ds_reference_number: parsedPayload.ds?.reference_number,
      response_code: parsedPayload.response_code,
      ds_transaction_id: parsedPayload.ds?.transaction_id,
    };

    res.status(request.status).json(authDetails);
  } catch (error) {
    console.error("Error getting authentication details:", error);
    res.status(500).json({
      error: "Internal server error while getting authentication details",
    });
  }
});

app.post("/create-payment", async (req, res) => {
  try {
    const {
      token,
      instrumentId,
      authentication_id,
      amount,
      currency,
      billing_address,
      customer,
      billing_descriptor,
      reference,
      description,
      shipping,
      capture,
      capture_on,
      risk,
      success_url,
      failure_url,
      recipient,
      metadata,
      payment_type,
      processing_channel_id: requestProcessingChannelId,
    } = req.body;

    // Try to get access token; fallback to secret key
    const authToken = (await getAccessToken()) || secretKey;

    if (!authToken) {
      return res.status(500).json({
        error:
          "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    // Extract billing address from billing object if provided
    let sourceBillingAddress = billing_address;
    if (!sourceBillingAddress && req.body.billing) {
      const billing = req.body.billing;
      sourceBillingAddress = {
        address_line1: billing.address?.address_line1 || "123 High St.",
        address_line2: billing.address?.address_line2 || "Flat 456",
        city: billing.address?.city || "London",
        zip: billing.address?.zip || "SW1A 1AA",
        country: billing.address?.country || "GB",
      };
    }

    // Use instrument ID if provided, otherwise fallback to token
    let source;
    if (instrumentId) {
      source = {
        type: "id",
        id: instrumentId,
        billing_address: sourceBillingAddress || {
          address_line1: "123 High St.",
          address_line2: "Flat 456",
          city: "London",
          zip: "SW1A 1AA",
          country: "GB",
        },
      };
    } else {
      source = {
        type: "token",
        token: token,
        billing_address: sourceBillingAddress || {
          address_line1: "123 High St.",
          address_line2: "Flat 456",
          city: "London",
          zip: "SW1A 1AA",
          country: "GB",
        },
      };
    }

    const request = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: source,
        amount: amount || 3000,
        currency: currency || "GBP",
        payment_type: payment_type || "Regular",
        reference: reference || "1234567890",
        description: description || "Payment",
        capture: capture,
        capture_on: capture_on,
        customer: customer || {
          email: "john.smith@mail.com",
          name: "John Smith",
          phone: {
            country_code: "44",
            number: "7987654321",
          },
        },
        billing_descriptor: billing_descriptor || {
          name: "Checkout.com",
          city: "London",
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
            country_code: "44",
            number: "7987654321",
          },
        },
        "3ds": authentication_id
          ? {
              enabled: true,
              authentication_id: authentication_id,
            }
          : undefined,
        risk: risk,
        processing_channel_id:
          requestProcessingChannelId || processingChannelId,
        success_url: success_url || `http://localhost:${port}?status=succeeded`,
        failure_url: failure_url || `http://localhost:${port}?status=failed`,
        recipient: recipient,
        metadata: metadata,
      }),
    });

    const parsedPayload = await request.json();

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      error: "Internal server error while creating payment",
    });
  }
});

const DESTINATION_CONFIGS = {
  Adyen: {
    url: "https://checkout-test.adyen.com/v71/payments",
    method: "POST",
    headers: {
      raw: {
        "Content-Type": "application/json",
        "X-API-KEY": adyenApiKey,
      },
    },
    body: `{"amount":{"currency":"GBP","value":3000},"paymentMethod":{"type":"scheme","encryptedCardNumber":"test_{{card_number}}","encryptedExpiryMonth":"test_{{card_expiry_month}}","encryptedExpiryYear":"test_{{card_expiry_year_yyyy}}","encryptedSecurityCode":"test_{{card_cvv}}"},"reference":"my_reference","merchantAccount":"MyMerchantAccount","returnUrl":"https://example.com"}`,
  },
  Stripe: {
    url: "https://api.stripe.com/v1/payment_intents",
    method: "POST",
    headers: {
      raw: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          (stripeSecretKey || "") + ":"
        ).toString("base64")}`,
      },
    },
    body: `amount=3000&currency=gbp&payment_method_types[]=card&payment_method_data[type]=card&payment_method_data[card][number]={{card_number}}&payment_method_data[card][exp_month]={{card_expiry_month}}&payment_method_data[card][exp_year]={{card_expiry_year_yyyy}}&payment_method_data[card][cvc]={{card_cvv}}&confirm=true&error_on_requires_action=true`,
  },
  "Global Payments": {
    url: "https://apis.sandbox.globalpay.com/ucp/transactions",
    method: "POST",
    headers: {
      raw: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-GP-Version": "2021-03-22",
        "Accept-Encoding": "identity",
      },
    },
    body: `{"account_name":"transaction_processing","channel":"CP","type":"SALE","capture_mode":"AUTO","amount":"3000","currency":"GBP","reference":"21450331","country":"GB","payment_method":{"first_name":"Jane","last_name":"Doe","entry_mode":"MANUAL","card":{"number":"{{card_number}}","expiry_month":"{{card_expiry_month}}","expiry_year":"{{card_expiry_year_yy}}"}}}`,
  },
};

app.post("/forward-credentials", async (req, res) => {
  try {
    const {
      destination,
      token,
      instrumentId,
      amount,
      currency,
      reference,
      authDetails,
    } = req.body;

    // Try to get access token; fallback to secret key
    const authToken = (await getAccessToken()) || secretKey;

    if (!authToken) {
      return res.status(500).json({
        error:
          "No authentication credentials provided. Please set ACCESS_KEY_ID + ACCESS_KEY_SECRET or SECRET_KEY in .env file.",
      });
    }

    if (!destination || !DESTINATION_CONFIGS[destination]) {
      return res.status(400).json({
        error: `Invalid destination. Supported destinations: ${Object.keys(
          DESTINATION_CONFIGS
        ).join(", ")}`,
      });
    }

    const destConfig = DESTINATION_CONFIGS[destination];

    if (destination === "Adyen") {
      const missing = [];
      if (!adyenApiKey) {
        missing.push("ADYEN_API_KEY");
      }
      if (!adyenMerchantAccount) {
        missing.push("ADYEN_MERCHANT_ACCOUNT");
      }

      if (missing.length > 0) {
        const message =
          missing.length === 2
            ? `${missing[0]} and ${missing[1]} required in .env`
            : `${missing[0]} required in .env`;
        return res.status(400).json({ error: message });
      }
    }
    if (destination === "Stripe") {
      if (!stripeSecretKey) {
        return res.status(400).json({
          error: "STRIPE_SECRET_KEY required in .env",
        });
      }
    }
    if (destination === "Global Payments") {
      const missing = [];
      if (!globalPaymentsAppId) {
        missing.push("GLOBAL_PAYMENTS_APP_ID");
      }
      if (!globalPaymentsAppKey) {
        missing.push("GLOBAL_PAYMENTS_APP_KEY");
      }

      if (missing.length > 0) {
        const message =
          missing.length === 2
            ? `${missing[0]} and ${missing[1]} required in .env`
            : `${missing[0]} required in .env`;
        return res.status(400).json({ error: message });
      }
    }

    const source = instrumentId
      ? { type: "id", id: instrumentId }
      : { type: "token", token: token };

    // Build request body based on destination
    let destinationBody = destConfig.body;
    let destinationHeaders = JSON.parse(JSON.stringify(destConfig.headers));

    if (destination === "Adyen") {
      const adyenBody = JSON.parse(destConfig.body);
      adyenBody.amount = {
        value: amount || 3000,
        currency: (currency || "GBP").toUpperCase(),
      };
      if (reference) {
        adyenBody.reference = reference;
      }
      adyenBody.merchantAccount = adyenMerchantAccount;

      // CVV not included in request with instrument
      if (instrumentId && adyenBody.paymentMethod) {
        delete adyenBody.paymentMethod.encryptedSecurityCode;
      }

      // Add authentication details if provided
      if (authDetails) {
        if (!adyenBody.mpiData) {
          adyenBody.mpiData = {};
        }
        if (authDetails.response_code) {
          adyenBody.mpiData.authenticationResponse = authDetails.response_code;
          adyenBody.mpiData.directoryResponse = authDetails.response_code;
        }
        if (authDetails.cryptogram) {
          adyenBody.mpiData.cavv = authDetails.cryptogram;
        }
        if (authDetails.eci) {
          adyenBody.mpiData.eci = authDetails.eci;
        }
        if (authDetails.protocol_version) {
          adyenBody.mpiData.threeDSVersion = authDetails.protocol_version;
        }
        if (authDetails.ds_transaction_id) {
          adyenBody.mpiData.dsTransID = authDetails.ds_transaction_id;
        }
      }

      destinationBody = JSON.stringify(adyenBody);
    } else if (destination === "Stripe") {
      destinationBody = destConfig.body
        .replace(/amount=\d+/, `amount=${amount || 3000}`)
        .replace(
          /currency=\w+/,
          `currency=${(currency || "gbp").toLowerCase()}`
        );

      // Add authentication details if provided
      if (authDetails) {
        const authParams = [];
        if (authDetails.protocol_version) {
          authParams.push(
            `payment_method_options[card][three_d_secure][version]=${encodeURIComponent(
              authDetails.protocol_version
            )}`
          );
        }
        if (authDetails.eci) {
          authParams.push(
            `payment_method_options[card][three_d_secure][electronic_commerce_indicator]=${encodeURIComponent(
              authDetails.eci
            )}`
          );
        }
        if (authDetails.cryptogram) {
          authParams.push(
            `payment_method_options[card][three_d_secure][cryptogram]=${encodeURIComponent(
              authDetails.cryptogram
            )}`
          );
        }
        if (authDetails.xid) {
          authParams.push(
            `payment_method_options[card][three_d_secure][transaction_id]=${encodeURIComponent(
              authDetails.xid
            )}`
          );
        }

        if (authParams.length > 0) {
          destinationBody += "&" + authParams.join("&");
        }
      }
    } else if (destination === "Global Payments") {
      // Get Global Payments access token
      let globalPaymentsAuthToken;
      try {
        globalPaymentsAuthToken = await getGlobalPaymentsAccessToken();
      } catch (error) {
        return res.status(500).json({
          error: `Failed to get Global Payments access token: ${error.message}`,
        });
      }
      destinationHeaders.raw = {
        ...destinationHeaders.raw,
        Authorization: `Bearer ${globalPaymentsAuthToken}`,
      };

      // Update body with dynamic values
      const gpBody = JSON.parse(destConfig.body);
      gpBody.amount = String(amount || 3000);
      gpBody.currency = (currency || "GBP").toUpperCase();
      if (reference) {
        gpBody.reference = reference;
      }

      // Add authentication details if provided
      if (authDetails) {
        if (!gpBody.payment_method) {
          gpBody.payment_method = {};
        }
        if (!gpBody.payment_method.authentication) {
          gpBody.payment_method.authentication = {};
        }
        gpBody.payment_method.authentication.three_ds = {
          message_version: authDetails.protocol_version,
          eci: authDetails.eci,
          value: authDetails.cryptogram,
          server_trans_ref: authDetails.acs_reference_number,
          ds_trans_ref: authDetails.ds_reference_number,
        };
      }

      destinationBody = JSON.stringify(gpBody);
    }

    const forwardRequest = {
      source: source,
      reference: reference || "forward_reference_" + Date.now(),
      processing_channel_id: processingChannelId,
      destination_request: {
        url: destConfig.url,
        method: destConfig.method,
        headers: destinationHeaders,
        body: destinationBody,
      },
    };

    const request = await fetch(
      "https://forward.sandbox.checkout.com/forward",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(forwardRequest),
      }
    );

    const parsedPayload = await request.json();

    res.status(request.status).send(parsedPayload);
  } catch (error) {
    console.error("Error forwarding credentials:", error);
    res.status(500).json({
      error: "Internal server error while forwarding credentials",
    });
  }
});

app.listen(port, () =>
  console.log(
    `Node server listening on port ${port}: http://localhost:${port}/`
  )
);
