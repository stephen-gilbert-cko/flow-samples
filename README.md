# Flow Samples

## Get started

1. In the project root, create a `.env` file

2. In [.env](.env) set `PUBLIC_KEY` to your Checkout.com public API key (pk_...)

3. In [.env](.env) set `SECRET_KEY` to your Checkout.com secret API key (sk_...)

4. In [.env](.env) set `PROCESSING_CHANNEL_ID` to your Checkout.com processing channel ID (pc_...)

5. To test stored card flows, in [.env](.env) set `CUSTOMER_ID` to your Checkout.com customer ID (cus_...)

```
PUBLIC_KEY="pk_sbox_..."
SECRET_KEY="sk_sbox_..."
PROCESSING_CHANNEL_ID="pc_..."
CUSTOMER_ID="cus_..."
```

5. Build the server

```
npm install
```

6. Run the server

```
npm start
```

7. Go to [http://localhost:3000/](http://localhost:3000/)

## Apple Pay


