require('dotenv').config()
module.exports = {
    publicKey: process.env.PUBLIC_KEY,
    secretKey: process.env.SECRET_KEY,
    accessKeyId: process.env.ACCESS_KEY_ID,
    accessKeySecret: process.env.ACCESS_KEY_SECRET,
    processingChannelId: process.env.PROCESSING_CHANNEL_ID,
    customerId: process.env.CUSTOMER_ID,
    adyenApiKey: process.env.ADYEN_API_KEY,
    adyenMerchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
}
