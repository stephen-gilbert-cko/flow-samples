/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey, customerId } = await config.json();

  const requestPayload = {
    amount: 15000,
    currency: "AED",
    reference: "ORD-" + Date.now(),
    description: "Payment",
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
        country_code: "971",
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
      },
    },
    disabled_payment_methods: ["remember_me"],
    success_url: `${window.location.origin}/standalone-components/payment/stored-card?status=succeeded`,
    failure_url: `${window.location.origin}/standalone-components/payment/stored-card?status=failed`,
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

  // Payment methods to display
  const componentTypes = [
    "applepay",
    "googlepay",
    "paypal",
    "stored_card",
    "alipay_cn",
    "alipay_hk",
    "alma",
    "bancontact",
    "benefit",
    "bizum",
    "dana",
    "eps",
    "gcash",
    "ideal",
    "kakaopay",
    "klarna",
    "knet",
    "mbway",
    "mobilepay",
    "multibanco",
    "p24",
    "plaid",
    "qpay",
    "sepa",
    "stcpay",
    "tabby",
    "tamara",
    "tng",
    "truemoney",
    "twint",
    "vipps",
  ];
  const readyComponents = new Set();

  const hideLoaderWhenAllReady = () => {
    if (readyComponents.size === componentTypes.length) {
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
    }
  };

  const checkout = await CheckoutWebComponents({
    publicKey: publicKey,
    environment: "sandbox",
    locale: "en-GB",
    paymentSession,
    onReady: (component) => {
      console.log(`onReady for "${component.type}"`);
      readyComponents.add(component.type);
      hideLoaderWhenAllReady();
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
    } else {
      console.log(`"${type}" is not available`);
      readyComponents.add(type); // Mark as "ready" to avoid blocking the loader
      hideLoaderWhenAllReady();
    }
  };

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
