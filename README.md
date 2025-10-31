# Flow Samples

## Get started

1. In the project root, create a `.env` file.

2. In [.env](.env):
   - Set `PUBLIC_KEY` to your Checkout.com Sandbox API public key.

   - Set `ACCESS_KEY_ID` and `ACCESS_KEY_SECRET` to your Checkout.com Sandbox access key pair (**recommended**), or `SECRET_KEY` to your Checkout.com Sandbox API secret key.

   - Set `PROCESSING_CHANNEL_ID` to your Checkout.com Sandbox processing channel ID.

   ``` dotenv
   # Checkout.com
   PUBLIC_KEY="pk_sbox_..."
   ACCESS_KEY_ID="ack_..."
   ACCESS_KEY_SECRET="..."
   PROCESSING_CHANNEL_ID="pc_..."
   ```

> [!WARNING]
> Some features, such as standalone 3DS authentication, are not supported when using a static `SECRET_KEY`.

   ### Optional

   - To test stored card flows, set `CUSTOMER_ID` to your Checkout.com Sandbox customer ID.
   - To test credential forwarding, set your external provider Sandbox API credentials.

   ``` dotenv
   # Stored card payments
   CUSTOMER_ID="cus_..."
   
   # ------ Forward destinations ------
   # Stripe
   STRIPE_SECRET_KEY="sk_test_..."
   # Adyen
   ADYEN_API_KEY="..."
   ADYEN_MERCHANT_ACCOUNT="..."
   # Global Payments
   GLOBAL_PAYMENTS_APP_ID="..."
   GLOBAL_PAYMENTS_APP_KEY="..."
   ```

3. Build the server:

``` shell
npm install
```

4. Run the server:

``` shell
npm start
```

5. Go to [http://localhost:3000/](http://localhost:3000/).

> [!TIP]
> Don't like 3000? Set your own `PORT` in [.env](.env).

## Apple Pay

To test Apple Pay in Sandbox, you need to:
- Have an `https` domain with valid TLS certificate.
- Complete [domain verification](https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/web#Before_you_begin) with [this file](https://pay.checkout.com/.well-known/apple-developer-merchantid-domain-association).
- Sign in with a [Sandbox Tester](https://developer.apple.com/apple-pay/sandbox-testing/) Apple ID to add test cards to your device wallet. 

## Payment method availability

To load different payment methods you need to:
1. Ensure they are [enabled on your Sandbox account](https://dashboard.sandbox.checkout.com/settings/payment-methods).
2. Send any required data in the payment session request. You can check requirements for each payment method [here](https://www.checkout.com/docs/payments/add-payment-methods).
