/* global CheckoutWebComponents */
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
  disabled_payment_methods: ["remember_me"],
  success_url: `${window.location.origin}/standalone-components/tokenize-only/vault-auth-forward?status=succeeded`,
  failure_url: `${window.location.origin}/standalone-components/tokenize-only/vault-auth-forward?status=failed`,
};

(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const authenticationStatus = urlParams.get("authentication-status");

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

  console.log("Payment session created:", paymentSession);

  if (!response.ok) {
    console.error("Error creating payment session", paymentSession);
    return;
  }

  // Track previous isValid state for each component
  const componentValidityState = new Map();

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
      const currentIsValid = component.isValid();
      const previousIsValid = componentValidityState.get(component.type);
      
      // Only log if validity state has changed
      if (previousIsValid !== currentIsValid) {
        console.log(
          `onChange() -> isValid: "${currentIsValid}" for "${
            component.type
          }"`
        );
        componentValidityState.set(component.type, currentIsValid);
      }
    },
    onCardBinChanged: (_self, cardMetadata) => {
      console.log("onCardBinChanged:", cardMetadata);
    },
    onSubmit: (component) => {
      console.log(`onSubmit for "${component.type}"`);
    },
    onAuthorized: (_self, authorizeResult) => {
      console.log("onAuthorized:", authorizeResult);
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
    const authTokenResponse = await cardComponent.tokenize();
    if (!authTokenResponse?.data) {
      return;
    }
    console.log("Card tokenized:", authTokenResponse.data);

    const paymentTokenResponse = await cardComponent.tokenize();
    if (!paymentTokenResponse?.data) {
      return;
    }
    console.log("Card tokenized:", paymentTokenResponse.data);

    await handleTokens(
      authTokenResponse.data.token,
      paymentTokenResponse.data.token
    );
  });
})();

async function handleTokens(authToken, paymentToken) {
  // Store payment token and shouldSaveCard choice for after authentication completes
  const shouldSaveCard = document.getElementById("shouldSaveCard").checked;
  const selectedDestination = document
    .querySelector(".dropdown-item.selected")
    ?.textContent?.trim();

  sessionStorage.setItem("paymentToken", paymentToken);
  sessionStorage.setItem("shouldSaveCard", shouldSaveCard.toString());
  if (selectedDestination) {
    sessionStorage.setItem(
      "vault-auth-forward-destination",
      selectedDestination
    );
  }

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
          success_url: `${window.location.origin}/standalone-components/tokenize-only/vault-auth-forward?authentication-status=succeeded`,
          failure_url: `${window.location.origin}/standalone-components/tokenize-only/vault-auth-forward?authentication-status=failed`,
        },
      }),
    });
    const sessionResponse = await response.json();

    if (!response.ok) {
      console.error("Error creating authentication session:", sessionResponse);
      triggerToast("failedToast");
      return;
    }

    console.log("Authentication session created:", sessionResponse);

    // Store session ID for after authentication completes
    sessionStorage.setItem("authSessionId", sessionResponse.id);

    // Redirect to the authentication URL
    if (
      sessionResponse._links &&
      sessionResponse._links.redirect_url &&
      sessionResponse._links.redirect_url.href
    ) {
      window.location.href = sessionResponse._links.redirect_url.href;
    } else {
      console.error("No redirect URL returned from authentication session");
      triggerToast("failedToast");
    }
  } catch (error) {
    console.error("Error creating authentication session:", error);
    triggerToast("failedToast");
  }
}

async function forwardCredentials(vaultId, authDetails = null) {
  try {
    // Determine type based on prefix
    const isInstrument = vaultId.startsWith("src_");
    const isToken = vaultId.startsWith("tok_");

    if (!isToken && !isInstrument) {
      console.error(
        "Invalid vaultId prefix. Expected 'tok_' or 'src_'",
        vaultId
      );
      triggerToast("failedToast");
      return null;
    }

    // Get selected destination from dropdown
    const selectedDestination = document
      .querySelector(".dropdown-item.selected")
      ?.textContent?.trim();
    console.log(
      `Forwarding ${
        isInstrument ? "instrument" : "token"
      } credentials to ${selectedDestination}`
    );

    const requestBody = {
      destination: selectedDestination,
      token: isToken ? vaultId : null,
      instrumentId: isInstrument ? vaultId : null,
      amount: requestPayload.amount,
      currency: requestPayload.currency,
      reference: `forward_${Date.now()}`,
    };

    // Add authentication details if available
    if (authDetails) {
      requestBody.authDetails = authDetails;
    }

    const response = await fetch("/forward-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
const authenticationStatus = urlParams.get("authentication-status");
const authSessionId = sessionStorage.getItem("authSessionId");
const storedPaymentToken = sessionStorage.getItem("paymentToken");
const storedShouldSaveCard = sessionStorage.getItem("shouldSaveCard");

if (
  authenticationStatus === "succeeded" &&
  authSessionId &&
  storedPaymentToken
) {
  // Authentication succeeded, now forward credentials
  handleAuthenticatedForward(
    storedPaymentToken,
    storedShouldSaveCard === "true",
    authSessionId
  );
  // Clean up stored values
  sessionStorage.removeItem("authSessionId");
  sessionStorage.removeItem("paymentToken");
  sessionStorage.removeItem("shouldSaveCard");
}

async function handleAuthenticatedForward(
  paymentToken,
  shouldSaveCard,
  authSessionId
) {
  // Fetch authentication details first
  let authDetails = null;
  try {
    const authDetailsResponse = await fetch(
      `/get-authentication-details?authSessionId=${authSessionId}`
    );
    if (authDetailsResponse.ok) {
      authDetails = await authDetailsResponse.json();
      console.log("Authentication details:", authDetails);
    } else {
      console.warn(
        "Failed to retrieve authentication details, proceeding without them"
      );
    }
  } catch (error) {
    console.error("Error fetching authentication details:", error);
    // Continue without auth details
  }

  if (shouldSaveCard) {
    // Create instrument and forward
    const instrumentId = await createInstrument(paymentToken);
    if (instrumentId) {
      await forwardCredentials(instrumentId, authDetails);
    } else {
      triggerToast("failedToast");
    }
  } else {
    // Forward payment token directly
    await forwardCredentials(paymentToken, authDetails);
  }
}

if (paymentStatus === "succeeded") {
  triggerToast("successToast");
}

if (paymentStatus === "failed" || authenticationStatus === "failed") {
  triggerToast("failedToast");
  // Clean up on failure
  sessionStorage.removeItem("authSessionId");
  sessionStorage.removeItem("paymentToken");
  sessionStorage.removeItem("shouldSaveCard");
}

if (paymentId) {
  console.log("Create Payment with PaymentId: ", paymentId);
}

// Dropdown selection logic with state persistence
document.addEventListener("DOMContentLoaded", function () {
  const dropdownItems = document.querySelectorAll(".dropdown-item");
  const storageKey = "vault-auth-forward-destination";

  // Restore saved selection if available (either from sessionStorage or saved before auth redirect)
  const savedDestination = sessionStorage.getItem(storageKey);
  if (savedDestination) {
    const itemToSelect = Array.from(dropdownItems).find(
      (item) => item.textContent.trim() === savedDestination
    );
    if (itemToSelect) {
      // Remove selected class from all items
      dropdownItems.forEach((dropdownItem) => {
        dropdownItem.classList.remove("selected");
      });
      // Add selected class to saved item
      itemToSelect.classList.add("selected");
      // Reorder items - move selected item to top
      const dropdownMenu = document.querySelector(".dropdown-menu");
      const dropdownArrow = document.querySelector(".dropdown-arrow");
      dropdownItems.forEach((dropdownItem) => {
        dropdownItem.remove();
      });
      const otherItems = Array.from(dropdownItems).filter(
        (item) => item !== itemToSelect
      );
      dropdownMenu.insertBefore(itemToSelect, dropdownArrow);
      otherItems.forEach((item) => {
        dropdownMenu.insertBefore(item, dropdownArrow);
      });
    }
  }

  dropdownItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remove selected class from all items
      dropdownItems.forEach((dropdownItem) => {
        dropdownItem.classList.remove("selected");
      });

      // Add selected class to clicked item
      this.classList.add("selected");

      // Save selection to sessionStorage
      sessionStorage.setItem(storageKey, this.textContent.trim());

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
