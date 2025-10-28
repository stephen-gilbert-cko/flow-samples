/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey, customerId } = await config.json();

  const requestPayload = {
    amount: 3000,
    currency: "GBP",
    reference: "ORD-" + Date.now(),
    description: "Payment",
    customer: {
      email: "john.smith@mail.com",
      name: "John Smith",
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
  console.log("Payment session created:", paymentSession);

  if (!response.ok) {
    console.error("Error creating payment session", paymentSession);
    return;
  }

  // Payment methods to display
  const componentTypes = [
    "stored_card",
    "applepay",
    "googlepay",
    "paypal",
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
  let firstMountedElement = null;

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
      container.classList.add("is-mounted");

      if (!firstMountedElement) {
        firstMountedElement = container;
        container.classList.add("first-mounted");
      }
    }
    // Mount standard card component if customer has no stored cards
    else if (type === "stored_card") {
      const cardComponent = checkout.create("card");
      if (await cardComponent.isAvailable()) {
        cardComponent.mount(container);
        container.classList.add("is-mounted");

        // Mark first mounted component
        if (!firstMountedElement) {
          firstMountedElement = container;
          container.classList.add("first-mounted");
        }
      }
    } else {
      console.log(`"${type}" is not available`);
      readyComponents.add(type); // Mark as "ready" to avoid blocking the loader
      hideLoaderWhenAllReady();
    }
  };

  await Promise.all(componentTypes.map(createPaymentComponent));

  // Ensure the first mounted container in the DOM gets first-mounted class
  const firstMountedContainer = Array.from(flowContainer.children).find(
    (child) => child.classList.contains("is-mounted")
  );
  if (
    firstMountedContainer &&
    !firstMountedContainer.classList.contains("first-mounted")
  ) {
    // Remove first-mounted from any other element
    document
      .querySelectorAll(".first-mounted")
      .forEach((el) => el.classList.remove("first-mounted"));
    // Add it to the first mounted element
    firstMountedContainer.classList.add("first-mounted");
  }

  // Don't add separator below stored_card component
  const storedCardContainer = document.getElementById("stored_card-container");
  if (storedCardContainer) {
    const children = Array.from(flowContainer.children);
    const storedCardIndex = children.indexOf(storedCardContainer);
    for (let i = storedCardIndex + 1; i < children.length; i++) {
      if (children[i].classList.contains("is-mounted")) {
        children[i].classList.add("after-stored");
        break;
      }
    }
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
