/* global CheckoutWebComponents */
(async () => {
  const config = await fetch("/config");
  const { publicKey } = await config.json();
  let surchargeInfo = null; // Store surcharge info from backend
  let paymentSession = null;
  let checkout = null;
  let cardComponent = null;

  const CURRENCY_AMOUNTS = { GBP: 3000, AUD: 5800 };

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
        store_payment_details: "disabled",
      },
    },
    disabled_payment_methods: ["remember_me"],
    success_url: `${window.location.origin}/flow-accordion/dynamic-amount?status=succeeded`,
    failure_url: `${window.location.origin}/flow-accordion/dynamic-amount?status=failed`,
  };

  async function createPaymentSessionWithPayload(payload) {
    const response = await fetch("/create-payment-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const session = await response.json();
    if (!response.ok) {
      console.error("Error creating payment session", session);
      throw new Error(session.error || "Failed to create payment session");
    }
    return session;
  }

  // Calculate surcharge from backend
  async function calculateSurcharge(cardMetadata) {
    if (!paymentSession || !paymentSession.id) {
      throw new Error("Payment session ID not found");
    }

    const paymentSessionId = paymentSession.id;
    const response = await fetch(`/calculate-surcharge/${paymentSessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card_category: cardMetadata.card_category,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error calculating surcharge", result);
      throw new Error(result.error || "Failed to calculate surcharge");
    }

    return result;
  }

  function getCurrencySymbol(currencyCode) {
    const parts = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
    }).formatToParts(1);
    return parts.find((p) => p.type === "currency")?.value ?? currencyCode;
  }

  function updatePaymentTotalDisplay() {
    const totalElement = document.getElementById("payment-total");
    if (!totalElement) return;
    const amountInMinorUnits = surchargeInfo
      ? surchargeInfo.totalAmount
      : requestPayload.amount;
    const formatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: requestPayload.currency,
    }).format(amountInMinorUnits / 100);
    const symbol = getCurrencySymbol(requestPayload.currency);
    const surchargeSuffix = surchargeInfo
      ? ` (including ${symbol}1 surcharge)`
      : "";
    totalElement.textContent = `Total: ${formatted}${surchargeSuffix}`;
  }

  async function submitPaymentSession(submitData) {
    if (!paymentSession || !paymentSession.id) {
      throw new Error("Payment session ID not found");
    }

    if (!submitData || !submitData.session_data) {
      throw new Error("Session data not found in submitData");
    }

    // Calculate amount: base amount + surcharge (if any)
    const paymentAmount = surchargeInfo
      ? surchargeInfo.totalAmount
      : requestPayload.amount;

    const paymentSessionId = paymentSession.id;
    const response = await fetch(`/submit-payment-session/${paymentSessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_data: submitData.session_data,
        amount: paymentAmount,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error submitting payment session", result);
      throw new Error(result.error || "Failed to submit payment session");
    }

    return result;
  }

  // Track previous isValid state for each component
  const componentValidityState = new Map();

  function getCurrentTheme() {
    const dataTheme = document.documentElement.getAttribute('data-theme');
    if (dataTheme === 'dark' || dataTheme === 'light') {
      return dataTheme;
    }
    // Check system preference if no theme is set
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getAppearance() {
    const theme = getCurrentTheme();
    if (theme === 'dark') {
      return {
        colorAction: '#186aff',
        colorBackground: '#181818',
        colorBorder: '#272932',
        colorDisabled: '#777478',
        colorError: '#FF3300',
        colorFormBackground: '#272932',
        colorFormBorder: '#272932',
        colorInverse: '#F9F9FB',
        colorOutline: '#275EC4',
        colorPrimary: '#F9F9FB',
        colorSecondary: '#b0b0b0',
        colorSuccess: '#2ECC71'
      };
    }
    return undefined; // Use defaults for light theme
  }

  function buildCheckoutConfig(session) {
    return {
    publicKey: publicKey,
    environment: "sandbox",
    locale: "en-GB",
    paymentSession: session,
    onReady: () => {
      console.log("onReady");

      const pageLoader = document.getElementById("page-loader");
      const pageContent = document.getElementById("page-content");
      if (pageLoader) {
        pageLoader.classList.add("hidden");
      }
      if (pageContent) {
        pageContent.classList.remove("hidden");
      }
      updatePaymentTotalDisplay();
    },
    onPaymentCompleted: (component, paymentResponse) => {
      console.log("Payment completed: ", paymentResponse.id);
      showPaymentConfirmationModal(paymentResponse.id);
    },
    onChange: (component) => {
      const currentIsValid = component.isValid();
      const previousIsValid = componentValidityState.get(component.type);

      // Only log if validity state has changed
      if (previousIsValid !== currentIsValid) {
        console.log(
          `onChange() -> isValid: "${currentIsValid}" for "${component.type
          }"`
        );
        componentValidityState.set(component.type, currentIsValid);
      }
    },
    onCardBinChanged: async (component, cardMetadata) => {
      console.log("onCardBinChanged:", cardMetadata);

      const warningElement = document.getElementById("commercial-card-warning");

      if (cardMetadata.card_category === 'commercial') {
        // Show warning message with currency-specific symbol
        if (warningElement) {
          const symbol = getCurrencySymbol(requestPayload.currency);
          const warningText = warningElement.querySelector(".warning-text");
          if (warningText) {
            warningText.textContent = `A ${symbol}1 commercial card surcharge will be applied to this transaction.`;
          }
          warningElement.classList.remove("hidden");
        }
      } else {
        if (warningElement) {
          warningElement.classList.add("hidden");
        }
      }

      const cardCurrencyTooltip = document.getElementById("card-currency-tooltip");
      const cardCurrencyTooltipText = cardCurrencyTooltip?.querySelector(".card-currency-tooltip-text");
      if (cardMetadata.currency && cardMetadata.currency !== requestPayload.currency) {
        if (cardCurrencyTooltip && cardCurrencyTooltipText) {
          cardCurrencyTooltipText.textContent = `Your card currency is ${cardMetadata.currency}. Please note that FX fees may be applied by your bank.`;
          cardCurrencyTooltip.classList.remove("hidden");
        }
      } else {
        if (cardCurrencyTooltip) {
          cardCurrencyTooltip.classList.add("hidden");
        }
      }

      try {
        if (cardMetadata.card_category === "commercial") {
          const surchargeResult = await calculateSurcharge(cardMetadata);
          surchargeInfo = surchargeResult;
        } else {
          surchargeInfo = null;
        }
      } catch (error) {
        console.error("Failed to calculate surcharge:", error);
        surchargeInfo = null;
        if (warningElement) {
          warningElement.classList.add("hidden");
        }
      }
      updatePaymentTotalDisplay();
    },
    onSubmit: (component) => {
      console.log(`onSubmit for "${component.type}"`);
    },
    onAuthorized: (component, authorizeResult) => {
      console.log("onAuthorized:", authorizeResult);
    },
    onError: (component, error) => {
      console.log("onError", error, "Component", component.type);
    },
    onTokenized: (_self, tokenizeResult) => {
      console.log("onTokenized:", tokenizeResult);
    },
    handleSubmit: async (component, submitData) => {
      console.log("handleSubmit:", submitData);
      // Amount is calculated server-side based on stored surcharge
      const submitResponse = await submitPaymentSession(submitData);
      return submitResponse;
    }
  };
  }

  async function initCheckoutAndMountCard() {
    paymentSession = await createPaymentSessionWithPayload(requestPayload);
    console.log("Payment session created:", paymentSession);

    const checkoutConfig = buildCheckoutConfig(paymentSession);
    const appearance = getAppearance();
    if (appearance) {
      checkoutConfig.appearance = appearance;
    }

    checkout = await CheckoutWebComponents(checkoutConfig);

    const cardContainer = document.getElementById("card-container");
    cardComponent = checkout.create("card");

    if (await cardComponent.isAvailable()) {
      cardComponent.mount(cardContainer);
    }

    updatePaymentTotalDisplay();
  }

  async function switchCurrency(newCurrency) {
    const amount = CURRENCY_AMOUNTS[newCurrency];
    if (amount === undefined) return;

    const pageLoader = document.getElementById("page-loader");
    if (pageLoader) pageLoader.classList.remove("hidden");

    requestPayload.currency = newCurrency;
    requestPayload.amount = amount;
    requestPayload.reference = "ORD-" + Date.now();
    requestPayload.items[0].unit_price = amount;
    requestPayload.items[0].total_amount = amount;
    surchargeInfo = null;

    const warningEl = document.getElementById("commercial-card-warning");
    if (warningEl) warningEl.classList.add("hidden");
    const cardCurrencyTooltipEl = document.getElementById("card-currency-tooltip");
    if (cardCurrencyTooltipEl) cardCurrencyTooltipEl.classList.add("hidden");

    if (cardComponent && typeof cardComponent.unmount === "function") {
      cardComponent.unmount();
    }
    const cardContainer = document.getElementById("card-container");
    if (cardContainer) {
      cardContainer.innerHTML = "";
    }

    await initCheckoutAndMountCard();

    const select = document.getElementById("currency-select");
    if (select) select.value = newCurrency;
  }

  await initCheckoutAndMountCard();

  const currencySelect = document.getElementById("currency-select");
  if (currencySelect) {
    currencySelect.addEventListener("change", (e) => {
      const newCurrency = e.target.value;
      if (newCurrency !== requestPayload.currency) {
        switchCurrency(newCurrency);
      }
    });
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

function showPaymentConfirmationModal(paymentId) {
  const modal = document.getElementById("payment-confirmation-modal");
  const paymentIdDisplay = document.getElementById("payment-id-display");
  const dashboardLink = document.getElementById("dashboard-link");

  if (modal && paymentId) {
    if (paymentIdDisplay) {
      paymentIdDisplay.textContent = paymentId;
    }

    if (dashboardLink) {
      dashboardLink.href = `https://dashboard.sandbox.checkout.com/payments/all-payments/payment/${paymentId}`;
    }

    modal.classList.add("show");
  }
}

async function copyPaymentId() {
  const paymentIdDisplay = document.getElementById("payment-id-display");
  if (paymentIdDisplay && paymentIdDisplay.textContent) {
    try {
      // Use modern Clipboard API if available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(paymentIdDisplay.textContent);
      } else {
        // Fallback for older browsers - create temporary input
        const tempInput = document.createElement("input");
        tempInput.value = paymentIdDisplay.textContent;
        document.body.appendChild(tempInput);
        tempInput.select();
        tempInput.setSelectionRange(0, 99999);
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
    } catch (err) {
      console.error('Failed to copy payment ID:', err);
    }
  }
}
