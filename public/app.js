const componentSelector = document.getElementById("componentOptions");
const chosenComponent = localStorage.getItem("chosenComponent");
componentSelector.value = chosenComponent;

function updateComponent() {
  let currentSelection = document.getElementById("componentOptions").value;

  if (currentSelection !== chosenComponent) {
    localStorage.setItem("chosenComponent", currentSelection);
    location.reload();
  }
}

/* global CheckoutWebComponents */
(async () => {
  // Fetch the publicKey from the server
  const configResponse = await fetch("/config");
  const { publicKey } = await configResponse.json();
  
  const response = await fetch("/create-payment-sessions", { method: "POST" }); // Order
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
      console.log("Create Payment with PaymentId: ", paymentResponse.id);
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

  if (chosenComponent === "address") {
    const authenticationContainer = document.getElementById("authentication-container");
    const addressContainer = document.getElementById("address-container");
    
    const authenticationComponent = checkout.create("authentication", {
      onChange: (_self, data) => {
        console.log(data.email);
      },
    });
    const addressComponent = checkout.create("shipping_address", {
      onChange: (_self, data) => {
        console.log(data.shippingAddress);
      },
    });
    const cardComponent = checkout.create("card");
    if (
      (await authenticationComponent.isAvailable()) &&
      (await cardComponent.isAvailable()) &&
      (await addressComponent.isAvailable())
    ) {
      authenticationComponent.mount(authenticationContainer);
      cardComponent.mount(flowContainer);
      addressComponent.mount(addressContainer);
    }
  } else {
    const flowComponent = checkout.create("flow");
    if (await flowComponent.isAvailable()) {
      flowComponent.mount(flowContainer);
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
