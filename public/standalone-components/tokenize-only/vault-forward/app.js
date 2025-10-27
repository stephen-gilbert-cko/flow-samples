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
    disabled_payment_methods: ["remember_me"],
    success_url: `${window.location.origin}/standalone-components/tokenize-only/vault-forward?status=succeeded`,
    failure_url: `${window.location.origin}/standalone-components/tokenize-only/vault-forward?status=failed`,
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
    const response = await cardComponent.tokenize();
    if (!response?.data) {
      return;
    }
    console.log("Card tokenized: ", response.data);
    
    await handleToken(response.data.token);
  });
})();

async function handleToken(token) {
  const shouldSaveCard = document.getElementById("shouldSaveCard").checked;
  
  if (shouldSaveCard) {
    await forwardCredentials(await createInstrument(token));
  } else {
    // If not saving card, proceed to forward the token
    await forwardCredentials(token);
  }
}

async function forwardCredentials(vaultId) {
  try {    
    // Determine type based on prefix
    const isInstrument = vaultId.startsWith('src_');
    const isToken = vaultId.startsWith('tok_');
    
    if (!isToken && !isInstrument) {
      console.error("Invalid vaultId prefix. Expected 'tok_' or 'src_'", vaultId);
      triggerToast("failedToast");
      return null;
    }
    
    // Get selected destination from dropdown
    const selectedDestination = document.querySelector(".dropdown-item.selected")?.textContent?.trim();
    console.log(`Forwarding ${isInstrument ? 'instrument' : 'token'} credentials to ${selectedDestination}`);
    
    const response = await fetch("/forward-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination: selectedDestination,
        token: isToken ? vaultId : null,
        instrumentId: isInstrument ? vaultId : null,
        amount: requestPayload.amount,
        currency: requestPayload.currency,
        reference: `forward_${Date.now()}`,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error forwarding credentials:", result);
      triggerToast("failedToast");
      return null;
    }

    console.log("Forward API response:", result);
    const responseBody = JSON.parse(result.destination_response.body);
    console.log(`${selectedDestination} response:`, responseBody);
    triggerToast("successToast");
    
    return result;
  } catch (error) {
    console.error("Error forwarding credentials:", error);
    triggerToast("failedToast");
    return null;
  }
}

async function createInstrument(token) {
  try {
    const response = await fetch("/create-instrument", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        billing_address: requestPayload.billing.address,
        customer: requestPayload.customer,
      }),
    });

    const instrumentResponse = await response.json();

    if (!response.ok) {
      console.error("Error creating instrument:", instrumentResponse);
      return null;
    }

    console.log("Instrument created:", instrumentResponse);
    return instrumentResponse.id;
  } catch (error) {
    console.error("Error creating instrument:", error);
    return null;
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

if (paymentStatus === "succeeded") {
  triggerToast("successToast");
}

if (paymentStatus === "failed") {
  triggerToast("failedToast");
}

if (paymentId) {
  console.log("Create Payment with PaymentId: ", paymentId);
}

// Dropdown selection logic
document.addEventListener("DOMContentLoaded", function () {
  const dropdownItems = document.querySelectorAll(".dropdown-item");

  dropdownItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remove selected class from all items
      dropdownItems.forEach((dropdownItem) => {
        dropdownItem.classList.remove("selected");
      });

      // Add selected class to clicked item
      this.classList.add("selected");

      // Reorder items - move selected item to top
      const dropdownMenu = document.querySelector(".dropdown-menu");
      const dropdownArrow = document.querySelector(".dropdown-arrow");
      dropdownItems.forEach((dropdownItem) => {
        dropdownItem.remove();
      });
      const selectedItem = this;
      const otherItems = Array.from(dropdownItems).filter(
        (item) => item !== selectedItem
      );
      dropdownMenu.insertBefore(selectedItem, dropdownArrow);
      otherItems.forEach((item) => {
        dropdownMenu.insertBefore(item, dropdownArrow);
      });
    });
  });
});
