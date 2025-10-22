require('dotenv').config()
module.exports = {
    secretKey: process.env.SECRET_KEY,
    publicKey: process.env.PUBLIC_KEY,
}
