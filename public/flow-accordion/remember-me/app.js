/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey } = await config.json();

  const requestPayload = {
    amount: 3000,
    currency: "GBP",
    reference: "ORD-" + Date.now(),
    description: "Payment",
    customer: {
      email: "returning.user@checkout.com",
      name: "Returning User",
    },
    items: [
      {
        name: "T-shirt",
        quantity: 1,
        reference: "0001",
        unit_price: 3000,
        total_amount: 3000,
      },
    ],
    billing: {
      address: {
        address_line1: "123 Main Street",
        address_line2: "Apt 1",
        city: "City",
        zip: "12345",
        country: "GB",
      },
      phone: {
        number: "7987654321",
        country_code: "44",
      },
    },
    shipping: {
      address: {
        address_line1: "123 Main Street",
        address_line2: "Apt 1",
        city: "City",
        zip: "12345",
        country: "GB",
      },
    },
    payment_method_configuration: {
      card: {
        store_payment_details: "disabled",
      },
    },
    success_url: `${window.location.origin}/flow-accordion/remember-me?status=succeeded`,
    failure_url: `${window.location.origin}/flow-accordion/remember-me?status=failed`,
  };

  const response = await fetch("/create-payment-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });
  const paymentSession = await response.json();
  console.log("Payment session created:", paymentSession);

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
  const flowComponent = checkout.create("flow");

  if (await flowComponent.isAvailable()) {
    flowComponent.mount(flowContainer);
  }
})();

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
