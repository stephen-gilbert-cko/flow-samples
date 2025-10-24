require('dotenv').config()
module.exports = {
    publicKey: process.env.PUBLIC_KEY,
    secretKey: process.env.SECRET_KEY,
    processingChannelId: process.env.PROCESSING_CHANNEL_ID,
    customerId: process.env.CUSTOMER_ID,
}
