/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey, customerId } = await config.json();

  const requestPayload = {
    amount: 15000,
    currency: "AED",
    reference: "ORDER-12345",
    description: "Payment for order 12345",
    items: [
      {
        name: "T-shirt",
        quantity: 1,
        unit_price: 15000,
      },
    ],
    billing: {
      address: {
        address_line1: "123 Main Street",
        address_line2: "Apt 1",
        city: "Dubai",
        zip: "12345",
        country: "AE",
      },
      phone: {
        number: "7987654321",
        country_code: "+971",
      },
    },
    shipping: {
      address: {
        address_line1: "123 Main Street",
        address_line2: "Apt 1",
        city: "Dubai",
        zip: "12345",
        country: "AE",
      },
    },
    payment_method_configuration: {
      card: {
        store_payment_details: "collect_consent",
      },
      stored_card: {
        customer_id: customerId,
      }
    },
    success_url:
      "http://localhost:3000/standalone-components/payment/stored-card?status=succeeded",
    failure_url:
      "http://localhost:3000/standalone-components/payment/stored-card?status=failed",
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

  const createPaymentComponent = async (type) => {
    const container = document.createElement("div");
    container.id = `${type}-container`;
    container.className = "payment-method-container";
    flowContainer.appendChild(container);

    const component = checkout.create(type);
    if (await component.isAvailable()) {
      component.mount(container);
    }
    // Mount standard card component if customer has no stored cards
    else if (type === "stored_card") {
      const cardComponent = checkout.create("card");
      if (await cardComponent.isAvailable()) {
        cardComponent.mount(container);
      }
    }
  };

  const componentTypes = ["applepay", "googlepay", "stored_card", "tamara"];
  await Promise.all(componentTypes.map(createPaymentComponent));
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
