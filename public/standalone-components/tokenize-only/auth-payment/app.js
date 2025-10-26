/* global CheckoutWebComponents */
const requestPayload = {
  amount: 3000,
  currency: "GBP",
  billing: {
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
  customer: {
    email: "john.smith@mail.com",
    name: "John Smith",
    phone: {
      country_code: "44",
      number: "7987654321",
    },
  },
  shipping: {
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
  success_url:
    "http://localhost:3000/standalone-components/tokenize-only/auth-payment?status=succeeded",
  failure_url:
    "http://localhost:3000/standalone-components/tokenize-only/auth-payment?status=failed",
};

(async () => {
  const config = await fetch("/config");
  const { publicKey } = await config.json();

  const response = await fetch("/create-payment-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });
  const paymentSession = await response.json();

  if (!response.ok) {
    console.error("Error creating payment session", paymentSession);
    return;
  }

  const checkout = await CheckoutWebComponents({
    publicKey: publicKey,
    environment: "sandbox",
    locale: "en-GB",
    paymentSession,
    onReady: () => {
      console.log("onReady");
      
      const pageLoader = document.getElementById("page-loader");
      const pageContent = document.getElementById("page-content");
      if (pageLoader) {
        pageLoader.classList.add("hidden");
        setTimeout(() => {
          pageLoader.remove();
        }, 300);
      }
      if (pageContent) {
        pageContent.classList.remove("hidden");
      }
    },
    onPaymentCompleted: (_component, paymentResponse) => {
      console.log("Payment completed: ", paymentResponse.id);
    },
    onChange: (component) => {
      console.log(
        `onChange() -> isValid: "${component.isValid()}" for "${
          component.type
        }"`
      );
    },
    onError: (component, error) => {
      console.log("onError", error, "Component", component.type);
    },
  });

  const flowContainer = document.getElementById("flow-container");
  const cardComponent = checkout.create("card", {
    showPayButton: false,
  });
  if (await cardComponent.isAvailable()) {
    cardComponent.mount(flowContainer);
  }

  const cardPayButton = document.getElementById("card-pay-button");
  cardPayButton.addEventListener("click", async () => {
    const { data: authTokenData } = await cardComponent.tokenize();
    console.log("Card tokenized:", authTokenData);
    const { data: paymentTokenData } = await cardComponent.tokenize();
    console.log("Card tokenized:", paymentTokenData);

    await handleTokens(authTokenData.token, paymentTokenData.token);
  });
})();

async function handleTokens(authToken, paymentToken) {
  // Store payment token for after authentication completes
  sessionStorage.setItem("paymentToken", paymentToken);
  
  await processAuthentication(authToken);
}

async function processAuthentication(token) {
  console.log("Authentication token:", token);
  try {
    const response = await fetch("/create-authentication-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
        amount: requestPayload.amount,
        currency: requestPayload.currency,
        billing_address: requestPayload.billing.address,
        mobile_phone: {
          country_code: requestPayload.billing.phone.country_code,
          number: requestPayload.billing.phone.number,
        },
        email: requestPayload.customer.email,
        shipping_address: requestPayload.shipping.address,
        completion: {
          type: "hosted",
          success_url: "http://localhost:3000/standalone-components/tokenize-only/auth-payment?authentication-status=succeeded",
          failure_url: "http://localhost:3000/standalone-components/tokenize-only/auth-payment?authentication-status=failed",
        },
      }),
    });
    const sessionResponse = await response.json();
    
    if (!response.ok) {
      console.error("Error creating authentication session:", sessionResponse);
      return;
    }
    
    console.log("Authentication session created:", sessionResponse);
    
    // Store the session ID for after authentication completes
    sessionStorage.setItem("authSessionId", sessionResponse.id);
    
    // Redirect to the authentication URL
    if (sessionResponse._links && sessionResponse._links.redirect_url && sessionResponse._links.redirect_url.href) {
      window.location.href = sessionResponse._links.redirect_url.href;
    } else {
      console.error("No redirect URL returned from authentication session");
    }
  } catch (error) {
    console.error("Error creating authentication session:", error);
  }
}

async function requestPayment(token, authenticationSessionId) {
  console.log("Payment token:", token);
  
  try {
    const response = await fetch("/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
        authentication_id: authenticationSessionId,
        amount: requestPayload.amount,
        currency: requestPayload.currency,
        billing: requestPayload.billing,
        customer: requestPayload.customer,
        shipping: requestPayload.shipping,
        billing_descriptor: {
          name: "Checkout.com",
          city: "London",
        },
        reference: "ORD-" + Date.now(),
        description: "Authenticated Payment",
        success_url: requestPayload.success_url,
        failure_url: requestPayload.failure_url,
      }),
    });
    
    const paymentResponse = await response.json();
    
    if (!response.ok) {
      console.error("Error creating payment:", paymentResponse);
      triggerToast("failedToast");
      return;
    }
    
    if (paymentResponse.approved === true) {
      console.log("Payment successful:", paymentResponse);
      triggerToast("successToast");
    } else {
      console.log("Payment failed:", paymentResponse);
      triggerToast("failedToast");
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    triggerToast("failedToast");
  }
}

function triggerToast(id) {
  var element = document.getElementById(id);
  element.classList.add("show");

  setTimeout(function () {
    element.classList.remove("show");
  }, 5000);
}

const urlParams = new URLSearchParams(window.location.search);
const paymentStatus = urlParams.get("status");
const paymentId = urlParams.get("cko-payment-id");

const authenticationStatus = urlParams.get("authentication-status");
const authSessionId = sessionStorage.getItem("authSessionId");
const storedPaymentToken = sessionStorage.getItem("paymentToken");

if (authenticationStatus === "succeeded" && authSessionId && storedPaymentToken) {
  requestPayment(storedPaymentToken, authSessionId);
  // Clean up stored values
  sessionStorage.removeItem("authSessionId");
  sessionStorage.removeItem("paymentToken");
}

if (paymentStatus === "succeeded") {
  triggerToast("successToast");
}

if (paymentStatus === "failed" || authenticationStatus === "failed") {
  triggerToast("failedToast");
  // Clean up on failure
  sessionStorage.removeItem("authSessionId");
  sessionStorage.removeItem("paymentToken");
}

if (paymentId) {
  console.log("Create Payment with PaymentId: ", paymentId);
}
