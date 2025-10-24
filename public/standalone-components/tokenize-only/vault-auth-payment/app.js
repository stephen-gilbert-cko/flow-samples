/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey } = await config.json();

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
        number: "7987654321",
        country_code: "+44",
      },
    },
    success_url:
      "http://localhost:3000/standalone-components/tokenize-only/auth-payment?status=succeeded",
    failure_url:
      "http://localhost:3000/standalone-components/tokenize-only/auth-payment?status=failed",
  };

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
    const { data } = await cardComponent.tokenize();
    console.log("Card tokenized: ", data);
    await handleToken(data.token);
  });
})();

async function handleToken(token) {
  console.log("Token: ", token);
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

if (paymentStatus === "succeeded") {
  triggerToast("successToast");
}

if (paymentStatus === "failed") {
  triggerToast("failedToast");
}

if (paymentId) {
  console.log("Create Payment with PaymentId: ", paymentId);
}
