# Flow Samples

## Get started

1. In the project root, create a `.env` file.

2. In [.env](.env):
   - Set `PUBLIC_KEY` to your Checkout.com public API key (pk_...).
   - Set `ACCESS_KEY_ID` (ack_...) and `ACCESS_KEY_SECRET` to your Checkout.com access key pair (**recommended**), or `SECRET_KEY` to your Checkout.com secret API key (sk_...).
   - Set `PROCESSING_CHANNEL_ID` to your Checkout.com processing channel ID (pc_...).
   - To test stored card flows, set `CUSTOMER_ID` to your Checkout.com customer ID (cus_...).

``` dotenv
PUBLIC_KEY="pk_sbox_..."
ACCESS_KEY_ID="ack_..."
ACCESS_KEY_SECRET="..."
PROCESSING_CHANNEL_ID="pc_..."
CUSTOMER_ID="cus_..."
```

> [!WARNING]
> Some features, such as standalone authentication, are not supported if using a static `SECRET_KEY`.

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
