(async () => {
  const iframe = document.getElementById("applepay-iframe");

  const config = await fetch("/config");
  const { applePayUrl } = await config.json();

  if (!applePayUrl) {
    console.error("No APPLE_PAY_URL set in .env");
    document.getElementById("config-message").classList.remove("hidden");
    iframe.classList.add("hidden");
    return;
  }

  console.log("Loading Apple Pay page:", applePayUrl);
  iframe.src = applePayUrl;
})();
