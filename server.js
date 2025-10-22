
const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.static("public"));
app.use(express.json());

const { secretKey, publicKey } = require("./config");

app.get("/config", (_req, res) => {
  res.json({ publicKey });
});

app.post("/create-payment-sessions", async (_req, res) => {
  // Create a PaymentSession
  const request = await fetch(
    "https://api.sandbox.checkout.com/payment-sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 2000,
        currency: "GBP",
        reference: "ORD-123A",
        display_name: "Online Shop",
        payment_type: "Regular",
        description: "Payment for Guitars and Amps",
        capture: false,
        // "processing_channel_id": "pc_62zqlrkat65e5epwbh7jo53z5i",
        payment_method_configuration: {
          applepay: {
            store_payment_details: "enabled",
          },
          card: {
            store_payment_details: "collect_consent",
          },
          stored_card: {
            customer_id: "cus_cvgrhbyexukubc46yuv6uittla",
          },
          googlepay: {
            store_payment_details: "enabled",
          },
        },
        enabled_payment_methods: ["card", "stored_card", "applepay", "googlepay", "paypal"],
        billing_descriptor: {
          name: "Jia Tsang",
          city: "London",
        },
        customer: {
          id: "cus_cvgrhbyexukubc46yuv6uittla",
          email: "nagpal.mukesh@gmail.com",
          name: "nagpal.mukesh@gmail.com",
          phone: {
            country_code: "+1",
            number: "415 555 2671",
          },
        },
        billing: {
          address: {
            address_line1: "123 High St.",
            address_line2: "Flat 456",
            city: "London",
            zip: "SW1A 1AA",
            country: "GB",
          },
          phone: {
            number: "1234567890",
            country_code: "+44",
          },
        },
        risk: {
          enabled: true,
        },
        "3ds": {
          enabled: true,
        },
        success_url:
          "http://localhost:3000?status=succeeded",
        failure_url:
          "http://localhost:3000?status=failed",
        metadata: {},
      }),
    }
  );

  const parsedPayload = await request.json();

  res.status(request.status).send(parsedPayload);
});

app.listen(3000, () =>
  console.log("Node server listening on port 3000: http://localhost:3000/")
);
